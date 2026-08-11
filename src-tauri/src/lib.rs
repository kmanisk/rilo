pub mod commands;
pub mod config;
pub mod core;
pub mod db;
pub mod download;
pub mod models;
pub mod native_host;

use config::AppConfig;
use db::Database;
use download::DownloadManager;
use models::DownloadCommand;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tokio::time::{sleep, Duration};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let is_native_host = args.iter().any(|arg| arg == "--native-host")
        || (args.len() > 1 && (args[1].starts_with("chrome-extension://") || args[1].starts_with("moz-extension://") || args[1].ends_with(".json")));

    if is_native_host {
        native_host::run_native_host();
        return;
    }

    // Suppress Edge Sidebar, PDF tools, and browser chrome inside WebView2
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--disable-features=msWebOOUI,msPdfOOUI,msEdgeSidebar --disable-context-menu",
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if args.len() > 1 {
                let potential_url = &args[1];
                if potential_url.starts_with("http://") || potential_url.starts_with("https://") {
                    let _ = app.emit("extension-download", crate::core::server::browser_server::ExtensionDownloadPayload {
                        url: potential_url.to_string(),
                        filename: None,
                        referrer: None,
                    });
                }
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            #[cfg(target_os = "windows")]
            native_host::register_production_native_host(&app_data_dir);

            let db_path = app_data_dir.join("downloads.db");

            // Windows AppData Roaming configuration directory (%APPDATA%\downloader\config.json)
            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| app_data_dir.join("config"));
            let config_path = config_dir.join("config.json");

            let app_config = AppConfig::load_or_create(&config_path);

            let db = Database::init(&db_path).expect("Failed to initialize SQLite database");
            let manager = DownloadManager::new(db.clone(), app_config, config_path);
            app.manage(manager);

            // Start Queue Scheduler
            let scheduler = core::queue::QueueScheduler::new();
            scheduler.start(Some(db));

            // Start Local Browser Extension Integration Server on port 7899
            core::server::start_browser_extension_server(app.handle().clone(), 7899);

            let show_item = MenuItem::with_id(app, "show", "Show App", true, None::<&str>)?;
            let pause_all_item = MenuItem::with_id(app, "pause_all", "Pause All", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &pause_all_item, &quit_item])?;

            if let Some(icon) = app.default_window_icon() {
                let _ = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&menu)
                    .on_menu_event(|app_handle, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "pause_all" => {
                            let state = app_handle.state::<DownloadManager>();
                            let active_map = Arc::clone(&state.active_downloads);
                            tauri::async_runtime::spawn(async move {
                                let active = active_map.lock().await;
                                for (tx, _token) in active.values() {
                                    let _ = tx.send(DownloadCommand::Pause).await;
                                }
                            });
                        }
                        "quit" => {
                            let state = app_handle.state::<DownloadManager>();
                            let active_map = Arc::clone(&state.active_downloads);
                            let app_clone = app_handle.clone();
                            tauri::async_runtime::spawn(async move {
                                let active = active_map.lock().await;
                                for (tx, _token) in active.values() {
                                    let _ = tx.send(DownloadCommand::Pause).await;
                                }
                                sleep(Duration::from_millis(300)).await;
                                app_clone.exit(0);
                            });
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            ..
                        } = event
                        {
                            let app_handle = tray.app_handle();
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app);
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_download,
            commands::resume_download,
            commands::pause_download,
            commands::pause_all_downloads,
            commands::cancel_download,
            commands::set_speed_limit,
            commands::update_download_url,
            commands::get_download_history,
            commands::delete_download_history,
            commands::delete_download_file,
            commands::check_file_exists,
            commands::get_app_config,
            commands::update_app_config,
            commands::reset_app_config,
            commands::get_config_path,
            commands::get_setting,
            commands::save_setting,
            commands::open_file,
            commands::open_folder_location,
            commands::extract_archive,
            commands::cancel_extraction,
            commands::get_archive_info,
            commands::update_download_extraction_config,
            commands::execute_system_action,
            commands::cancel_system_shutdown,
            commands::open_details_window,
            commands::open_completion_window,
            commands::open_test_window,
            commands::start_file_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
