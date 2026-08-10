use crate::config::AppConfig;
use crate::download::{worker, DownloadManager};
use crate::models::{DownloadCommand, DownloadRecord};
use std::path::Path;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, DownloadManager>,
    download_id: String,
    url: String,
    custom_path: Option<String>,
    speed_limit: Option<u64>,
    num_connections: Option<u32>,
) -> Result<(), String> {
    if download_id.trim().is_empty() {
        return Err("Download ID cannot be empty".to_string());
    }

    if let Err(e) = reqwest::Url::parse(&url) {
        return Err(format!("Invalid URL address: {}", e));
    }

    let requested_connections = num_connections.map(|c| c.clamp(1, 32));

    worker::execute_download(
        app,
        state.inner().clone(),
        download_id,
        url,
        custom_path,
        speed_limit,
        requested_connections,
        false,
    )
    .await
}

#[tauri::command]
pub async fn resume_download(
    app: AppHandle,
    state: State<'_, DownloadManager>,
    download_id: String,
    url: String,
    custom_path: Option<String>,
    speed_limit: Option<u64>,
    num_connections: Option<u32>,
) -> Result<(), String> {
    if download_id.trim().is_empty() {
        return Err("Download ID cannot be empty".to_string());
    }

    if let Err(e) = reqwest::Url::parse(&url) {
        return Err(format!("Invalid URL address: {}", e));
    }

    let requested_connections = num_connections.map(|c| c.clamp(1, 32));

    worker::execute_download(
        app,
        state.inner().clone(),
        download_id,
        url,
        custom_path,
        speed_limit,
        requested_connections,
        true,
    )
    .await
}

#[tauri::command]
pub async fn pause_download(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    let downloads = state.active_downloads.lock().await;
    if let Some((tx, _token)) = downloads.get(&download_id) {
        let _ = tx.send(DownloadCommand::Pause).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn pause_all_downloads(
    state: State<'_, DownloadManager>,
) -> Result<(), String> {
    let downloads = state.active_downloads.lock().await;
    for (tx, _token) in downloads.values() {
        let _ = tx.send(DownloadCommand::Pause).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    let downloads = state.active_downloads.lock().await;
    if let Some((tx, token)) = downloads.get(&download_id) {
        token.cancel();
        let _ = tx.send(DownloadCommand::Cancel).await;
    }
    if let Some(ref db) = state.db {
        let _ = db.update_progress(&download_id, 0, 0, "Cancelled");
    }
    Ok(())
}

#[tauri::command]
pub async fn set_speed_limit(
    state: State<'_, DownloadManager>,
    download_id: String,
    speed_limit: u64,
) -> Result<(), String> {
    let downloads = state.active_downloads.lock().await;
    if let Some((tx, _token)) = downloads.get(&download_id) {
        let _ = tx.send(DownloadCommand::SetSpeedLimit(speed_limit)).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn update_download_url(
    state: State<'_, DownloadManager>,
    download_id: String,
    new_url: String,
) -> Result<(), String> {
    if let Err(e) = reqwest::Url::parse(&new_url) {
        return Err(format!("Invalid URL address: {}", e));
    }

    if let Some(ref db) = state.db {
        db.update_url(&download_id, &new_url)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_download_history(
    state: State<'_, DownloadManager>,
) -> Result<Vec<DownloadRecord>, String> {
    if let Some(ref db) = state.db {
        db.get_all().map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn delete_download_history(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    {
        let downloads = state.active_downloads.lock().await;
        if let Some((tx, token)) = downloads.get(&download_id) {
            token.cancel();
            let _ = tx.send(DownloadCommand::Cancel).await;
        }
    }
    if let Some(ref db) = state.db {
        db.delete(&download_id).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_download_file(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    if download_id.trim().is_empty() {
        return Err("Download ID cannot be empty".to_string());
    }

    // 1. Cancel active download task if running
    {
        let downloads = state.active_downloads.lock().await;
        if let Some((tx, token)) = downloads.get(&download_id) {
            token.cancel();
            let _ = tx.send(DownloadCommand::Cancel).await;
        }
    }

    // 2. Fetch record from SQLite DB to get authoritative save_path
    let record = if let Some(ref db) = state.db {
        db.get_by_id(&download_id).map_err(|e| e.to_string())?
    } else {
        None
    };

    if let Some(rec) = record {
        let path = Path::new(&rec.save_path);

        // Path safety check: Ensure it is a regular file on disk
        if path.is_absolute() && path.exists() && path.is_file() {
            if let Err(e) = std::fs::remove_file(path) {
                return Err(format!("Failed to delete file from disk: {}. The file may be in use by another application.", e));
            }
        }

        // Clean up associated .part files (.part0, .part1, ...)
        let num_parts = rec.threads.clamp(1, 32);
        for i in 0..num_parts {
            let part_path = crate::core::destination::get_part_file_path(path, i as usize);
            if part_path.exists() && part_path.is_file() {
                let _ = std::fs::remove_file(part_path);
            }
        }

        // Remove SQLite DB record
        if let Some(ref db) = state.db {
            db.delete(&download_id).map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        Err("Download record not found".to_string())
    }
}

#[tauri::command]
pub async fn check_file_exists(path: String) -> Result<bool, String> {
    if path.trim().is_empty() {
        return Ok(false);
    }
    let p = Path::new(&path);
    Ok(p.exists() && p.is_file())
}

#[tauri::command]
pub async fn get_app_config(
    state: State<'_, DownloadManager>,
) -> Result<AppConfig, String> {
    Ok(state.get_config().await)
}

#[tauri::command]
pub async fn update_app_config(
    state: State<'_, DownloadManager>,
    config: AppConfig,
) -> Result<(), String> {
    state.update_config(config).await
}

#[tauri::command]
pub async fn reset_app_config(
    state: State<'_, DownloadManager>,
) -> Result<AppConfig, String> {
    let default_config = AppConfig::default();
    state.update_config(default_config.clone()).await?;
    Ok(default_config)
}

#[tauri::command]
pub async fn get_config_path(
    state: State<'_, DownloadManager>,
) -> Result<String, String> {
    Ok(state.config_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_setting(
    state: State<'_, DownloadManager>,
    key: String,
) -> Result<Option<String>, String> {
    if let Some(ref db) = state.db {
        db.get_setting(&key).map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn save_setting(
    state: State<'_, DownloadManager>,
    key: String,
    value: String,
) -> Result<(), String> {
    if let Some(ref db) = state.db {
        db.save_setting(&key, &value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File does not exist on disk".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_folder_location(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let target = path.clone();

    #[cfg(target_os = "windows")]
    {
        if p.exists() && p.is_file() {
            std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&target)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else if let Some(parent) = p.parent() {
            std::process::Command::new("explorer")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(target_os = "macos")]
    {
        if p.exists() && p.is_file() {
            std::process::Command::new("open")
                .arg("-R")
                .arg(&target)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(target_os = "linux")]
    {
        let folder = if p.is_file() {
            p.parent().unwrap_or(p)
        } else {
            p
        };
        std::process::Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

use crate::core::archive::{self, ArchiveInfo, ExtractionOptions};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, LazyLock};

static ACTIVE_EXTRACTIONS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub async fn extract_archive(
    app: AppHandle,
    state: State<'_, DownloadManager>,
    download_id: String,
    archive_path: String,
    extract_dir: Option<String>,
    password: Option<String>,
    delete_after: Option<bool>,
) -> Result<(), String> {
    if download_id.trim().is_empty() {
        return Err("Download ID cannot be empty".to_string());
    }

    let arch_path = Path::new(&archive_path);
    if !arch_path.exists() {
        return Err(format!("Archive file not found: {}", archive_path));
    }

    let destination = if let Some(dir) = extract_dir {
        if dir.trim().is_empty() {
            arch_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
        } else {
            Path::new(&dir).to_path_buf()
        }
    } else {
        arch_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
    };

    let delete_after_flag = delete_after.unwrap_or(false);
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut map = ACTIVE_EXTRACTIONS.lock().unwrap();
        map.insert(download_id.clone(), cancel_flag.clone());
    }

    let db = state.db.clone();
    if let Some(ref db_conn) = db {
        let _ = db_conn.update_extraction_state(&download_id, "Extracting");
        let _ = db_conn.update_extraction_config(
            &download_id,
            true,
            &destination.to_string_lossy(),
            delete_after_flag,
        );
    }

    let options = ExtractionOptions {
        archive_path: arch_path.to_path_buf(),
        dest_dir: destination,
        password,
        delete_after: delete_after_flag,
    };

    let dl_id = download_id.clone();
    let db_clone = db.clone();

    tokio::task::spawn_blocking(move || {
        let res = archive::extract_archive(app, dl_id.clone(), options, cancel_flag);
        {
            let mut map = ACTIVE_EXTRACTIONS.lock().unwrap();
            map.remove(&dl_id);
        }
        if let Some(ref db_conn) = db_clone {
            match res {
                Ok(()) => {
                    let _ = db_conn.update_extraction_state(&dl_id, "Extracted");
                }
                Err(e) => {
                    let state_name = if matches!(e, archive::ExtractionError::Cancelled) {
                        "Cancelled"
                    } else {
                        "ExtractionFailed"
                    };
                    let _ = db_conn.update_extraction_state(&dl_id, state_name);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_extraction(download_id: String) -> Result<(), String> {
    let map = ACTIVE_EXTRACTIONS.lock().unwrap();
    if let Some(flag) = map.get(&download_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err("No active extraction found for this download".to_string())
    }
}

#[tauri::command]
pub async fn get_archive_info(archive_path: String) -> Result<ArchiveInfo, String> {
    let path = Path::new(&archive_path);
    if !path.exists() {
        return Err(format!("Archive file not found: {}", archive_path));
    }
    let format = archive::detect_archive_format(&archive_path);
    let is_supported = format.is_supported();
    let filename = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

    Ok(ArchiveInfo {
        filename,
        format: format.display_name().to_string(),
        is_supported,
        total_files: 0,
        uncompressed_size: 0,
        is_encrypted: false,
    })
}

#[tauri::command]
pub async fn update_download_extraction_config(
    state: State<'_, DownloadManager>,
    download_id: String,
    auto_extract: bool,
    extract_dir: Option<String>,
    delete_after: Option<bool>,
) -> Result<(), String> {
    let dir = extract_dir.unwrap_or_default();
    let del = delete_after.unwrap_or(false);
    if let Some(ref db_conn) = state.db {
        db_conn.update_extraction_config(&download_id, auto_extract, &dir, del)
            .map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn execute_system_action(action: String, force: Option<bool>) -> Result<(), String> {
    let act = action.to_lowercase();
    let is_force = force.unwrap_or(false);

    #[cfg(target_os = "windows")]
    {
        match act.as_str() {
            "shutdown" => {
                let mut cmd = std::process::Command::new("shutdown");
                if is_force {
                    cmd.args(["/f", "/s", "/t", "0"]);
                } else {
                    cmd.args(["/s", "/t", "0"]);
                }
                cmd.spawn().map_err(|e| e.to_string())?;
            }
            "sleep" => {
                std::process::Command::new("rundll32.exe")
                    .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
            "hibernate" => {
                std::process::Command::new("shutdown")
                    .args(["/h"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
            _ => {}
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_system_shutdown() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("shutdown").arg("/a").spawn();
    }
    Ok(())
}

#[tauri::command]
pub async fn open_details_window(
    app: AppHandle,
    download_id: String,
    title: String,
) -> Result<(), String> {
    let clean_id = download_id.replace(['-', ' '], "_");
    let label = format!("details_{}", clean_id);

    if let Some(existing_win) = app.get_webview_window(&label) {
        let _ = existing_win.show();
        let _ = existing_win.set_focus();
        return Ok(());
    }

    let url = format!("index.html?details_id={}", download_id);
    let builder = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
        .title(format!("Rilo — Download Details — {}", title))
        .inner_size(740.0, 580.0)
        .min_inner_size(620.0, 480.0)
        .resizable(true)
        .focused(true);

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}



