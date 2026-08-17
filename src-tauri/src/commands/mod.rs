use crate::config::AppConfig;
use crate::download::DownloadManager;
use crate::models::{DownloadRecord, DuplicateDownloadInfo};
use std::path::Path;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn check_duplicate_download(
    state: State<'_, DownloadManager>,
    url: String,
) -> Result<Option<DuplicateDownloadInfo>, String> {
    state.check_duplicate(&url).await
}

#[tauri::command]
pub async fn start_download(
    _app: AppHandle,
    state: State<'_, DownloadManager>,
    download_id: Option<String>,
    url: String,
    custom_path: Option<String>,
    speed_limit: Option<u64>,
    num_connections: Option<u32>,
    allow_duplicate: Option<bool>,
) -> Result<DownloadRecord, String> {
    eprintln!("[CREATE] url={} custom_path={:?} allow_duplicate={:?}", url, custom_path, allow_duplicate);

    if let Err(e) = reqwest::Url::parse(&url) {
        eprintln!("[ERROR] invalid url address: {}", e);
        return Err(format!("Invalid URL address: {}", e));
    }

    state
        .start_download(
            download_id,
            url,
            custom_path,
            speed_limit,
            num_connections,
            false,
            allow_duplicate.unwrap_or(false),
        )
        .await
}

#[tauri::command]
pub async fn resume_download(
    _app: AppHandle,
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

    state
        .start_download(
            Some(download_id),
            url,
            custom_path,
            speed_limit,
            num_connections,
            true,
            true,
        )
        .await
        .map(|_| ())
}

#[tauri::command]
pub async fn pause_download(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    state.pause_download(download_id).await
}

#[tauri::command]
pub async fn pause_all_downloads(
    state: State<'_, DownloadManager>,
) -> Result<(), String> {
    if let Ok(records) = state.db.get_all().await {
        for r in records {
            if r.status.to_lowercase() == "downloading" {
                let _ = state.pause_download(r.id).await;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    state.cancel_download(download_id).await
}

#[tauri::command]
pub async fn set_speed_limit(
    state: State<'_, DownloadManager>,
    download_id: String,
    speed_limit: u64,
) -> Result<(), String> {
    let uuid = uuid::Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
    state
        .core
        .update_download_speed_limit(uuid, Some(speed_limit))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_download_url(
    _state: State<'_, DownloadManager>,
    _download_id: String,
    new_url: String,
) -> Result<(), String> {
    if let Err(e) = reqwest::Url::parse(&new_url) {
        return Err(format!("Invalid URL address: {}", e));
    }
    Ok(())
}

#[tauri::command]
pub async fn get_download_history(
    state: State<'_, DownloadManager>,
) -> Result<Vec<DownloadRecord>, String> {
    state.db.get_all().await
}

#[tauri::command]
pub async fn delete_download_history(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    state.delete_download(download_id, false).await
}

#[tauri::command]
pub async fn delete_download_file(
    state: State<'_, DownloadManager>,
    download_id: String,
) -> Result<(), String> {
    state.delete_download(download_id, true).await
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
    let mut cfg = state.app_config.lock().await;
    if cfg.download.download_directory.trim().is_empty() {
        if let Some(user_downloads) = dirs::download_dir() {
            cfg.download.download_directory = user_downloads.to_string_lossy().to_string();
        }
    }
    eprintln!("[SETTINGS-LOAD] default_download_folder={}", cfg.download.download_directory);
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn update_app_config(
    state: State<'_, DownloadManager>,
    mut config: AppConfig,
) -> Result<(), String> {
    config.validate();
    if config.download.download_directory.trim().is_empty() {
        if let Some(user_downloads) = dirs::download_dir() {
            config.download.download_directory = user_downloads.to_string_lossy().to_string();
        }
    }
    {
        let mut cfg = state.app_config.lock().await;
        *cfg = config.clone();
    }

    if let Some(parent) = state.config_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    if let Ok(json) = serde_json::to_string_pretty(&config) {
        let _ = tokio::fs::write(&state.config_path, json).await;
    }

    if config.download.global_speed_limit_kbps > 0 {
        state.core.download_manager.set_global_speed_limit(config.download.global_speed_limit_kbps * 1024).await;
    } else {
        state.core.download_manager.set_global_speed_limit(0).await;
    }

    eprintln!(
        "[SETTINGS-SAVE] default_download_folder={} use_category={}",
        config.download.download_directory,
        config.download.use_category_by_default
    );

    Ok(())
}

#[tauri::command]
pub async fn reset_app_config(
    state: State<'_, DownloadManager>,
) -> Result<AppConfig, String> {
    let mut default_config = AppConfig::default();
    if let Some(user_downloads) = dirs::download_dir() {
        default_config.download.download_directory = user_downloads.to_string_lossy().to_string();
    }
    let mut cfg = state.app_config.lock().await;
    *cfg = default_config.clone();

    if let Ok(json) = serde_json::to_string_pretty(&default_config) {
        let _ = tokio::fs::write(&state.config_path, json).await;
    }

    eprintln!("[SETTINGS-RESET] default_download_folder={}", default_config.download.download_directory);
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
    state.db.get_setting(&key).await
}

#[tauri::command]
pub async fn save_setting(
    state: State<'_, DownloadManager>,
    key: String,
    value: String,
) -> Result<(), String> {
    state.db.save_setting(&key, &value).await
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
use std::sync::{Arc, LazyLock, Mutex};

static ACTIVE_EXTRACTIONS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub async fn extract_archive(
    app: AppHandle,
    archive_path: String,
    output_dir: Option<String>,
    delete_after: Option<bool>,
) -> Result<(), String> {
    let path = Path::new(&archive_path);
    if !path.exists() {
        return Err(format!("Archive file not found: {}", archive_path));
    }

    let out_dir = output_dir.unwrap_or_else(|| {
        path.parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut map = ACTIVE_EXTRACTIONS.lock().unwrap();
        map.insert(archive_path.clone(), cancel_flag.clone());
    }

    let archive_path_clone = archive_path.clone();
    let delete_archive = delete_after.unwrap_or(false);

    tauri::async_runtime::spawn(async move {
        let opts = ExtractionOptions {
            archive_path: std::path::PathBuf::from(&archive_path_clone),
            dest_dir: std::path::PathBuf::from(out_dir),
            password: None,
            delete_after: delete_archive,
        };

        let result = archive::extract_archive(app, archive_path_clone.clone(), opts, cancel_flag);

        {
            let mut map = ACTIVE_EXTRACTIONS.lock().unwrap();
            map.remove(&archive_path_clone);
        }

        if let Err(e) = result {
            eprintln!("Extraction error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_extraction(archive_path: String) -> Result<(), String> {
    let map = ACTIVE_EXTRACTIONS.lock().unwrap();
    if let Some(flag) = map.get(&archive_path) {
        flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err("No active extraction found for this file".to_string())
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
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

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
    state.db.save_setting(&format!("extract_auto_{}", download_id), if auto_extract { "true" } else { "false" }).await?;
    if let Some(dir) = extract_dir {
        state.db.save_setting(&format!("extract_dir_{}", download_id), &dir).await?;
    }
    if let Some(del) = delete_after {
        state.db.save_setting(&format!("extract_delete_{}", download_id), if del { "true" } else { "false" }).await?;
    }
    Ok(())
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
    state: State<'_, DownloadManager>,
    download_id: String,
    title: String,
) -> Result<(), String> {
    let is_completed = if let Ok(records) = state.db.get_all().await {
        if let Some(r) = records.iter().find(|r| r.id == download_id) {
            r.status == "completed"
        } else {
            return Err("Download is no longer available".to_string());
        }
    } else {
        false
    };

    let clean_id = download_id.replace(['-', ' '], "_");
    let label = format!("rilo-download-details-{}", clean_id);

    if let Some(existing_win) = app.get_webview_window(&label) {
        let _ = existing_win.show();
        let _ = existing_win.unminimize();
        let _ = existing_win.set_focus();
        return Ok(());
    }

    let url = format!("index.html?window=details&details_id={}", download_id);
    let (width, height, min_w, min_h, resizable) = if is_completed {
        (430.0, 160.0, 360.0, 140.0, false)
    } else {
        (560.0, 440.0, 360.0, 140.0, true)
    };

    let builder =
        tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
            .title(format!("Download Details — {}", title))
            .inner_size(width, height)
            .min_inner_size(min_w, min_h)
            .decorations(false)
            .visible(false)
            .center()
            .resizable(resizable)
            .focused(true);

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_completion_window(
    app: AppHandle,
    download_id: String,
    title: Option<String>,
) -> Result<(), String> {
    let clean_id = download_id.replace(['-', ' '], "_");
    let label = format!("rilo-completion-{}", clean_id);

    if let Some(existing_win) = app.get_webview_window(&label) {
        let _ = existing_win.show();
        let _ = existing_win.unminimize();
        let _ = existing_win.set_focus();
        return Ok(());
    }

    let url = format!("index.html?window=completion&completion_id={}", download_id);
    let window_title = format!("Completed — {}", title.unwrap_or_else(|| download_id.clone()));
    let builder =
        tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
            .title(window_title)
            .inner_size(460.0, 180.0)
            .min_inner_size(380.0, 140.0)
            .decorations(false)
            .visible(false)
            .center()
            .resizable(false)
            .focused(true);

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_test_window(app: AppHandle) -> Result<(), String> {
    let label = "rilo-test-window";

    if let Some(existing_win) = app.get_webview_window(label) {
        let _ = existing_win.show();
        let _ = existing_win.unminimize();
        let _ = existing_win.set_focus();
        return Ok(());
    }

    let url = "index.html?window=test";
    let builder =
        tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(url.into()))
            .title("Test Window")
            .inner_size(600.0, 420.0)
            .min_inner_size(460.0, 320.0)
            .decorations(false)
            .visible(false)
            .center()
            .resizable(true)
            .focused(true);

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_file_drag(app: AppHandle, file_path: String) -> Result<(), String> {
    let path_buf = std::path::PathBuf::from(&file_path);
    if !path_buf.exists() {
        return Err("File does not exist on disk".to_string());
    }

    if let Some(window) = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().values().next().cloned())
    {
        let _ = drag::start_drag(
            &window,
            drag::DragItem::Files(vec![path_buf]),
            drag::Image::Raw(vec![]),
            |_result, _pos| {},
            drag::Options::default(),
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn get_site_credentials(
    manager: State<'_, DownloadManager>,
) -> Result<Vec<crate::models::SiteCredential>, String> {
    manager.db.get_site_credentials().await
}

#[tauri::command]
pub async fn save_site_credential(
    cred: crate::models::SiteCredential,
    manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    manager.db.save_site_credential(&cred).await
}

#[tauri::command]
pub async fn delete_site_credential(
    id: String,
    manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    manager.db.delete_site_credential(&id).await
}

#[tauri::command]
pub async fn test_proxy_connection(proxy_url: String) -> Result<bool, String> {
    let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| format!("Invalid proxy URL: {}", e))?;
    let client = reqwest::Client::builder()
        .proxy(proxy)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed creating HTTP client: {}", e))?;

    match client.get("https://httpbin.org/ip").send().await {
        Ok(res) => Ok(res.status().is_success()),
        Err(e) => Err(format!("Proxy test failed: {}", e)),
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UrlMetadata {
    pub size: Option<u64>,
    pub filename: Option<String>,
    pub content_type: Option<String>,
    pub accept_ranges: bool,
    pub resumable: bool,
}

#[tauri::command]
pub async fn fetch_url_metadata(
    url: String,
    manager: State<'_, DownloadManager>,
) -> Result<UrlMetadata, String> {
    let info = manager.probe_link(&url).await?;

    let filename = if info.filename.is_empty() || info.filename == "download" || info.filename == "unknown" {
        None
    } else {
        Some(info.filename)
    };

    Ok(UrlMetadata {
        size: info.size,
        filename,
        content_type: info.content_type,
        accept_ranges: info.resumable,
        resumable: info.resumable,
    })
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_probe_hetzner_metadata() {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .unwrap();

        // Use Range GET fallback for resilient probing
        let res = client
            .get("https://ash-speed.hetzner.com/100MB.bin")
            .header(reqwest::header::RANGE, "bytes=0-0")
            .send()
            .await
            .unwrap();
        assert!(res.status().is_success() || res.status() == reqwest::StatusCode::PARTIAL_CONTENT);
        let cr = res.headers().get(reqwest::header::CONTENT_RANGE).unwrap().to_str().unwrap();
        let total_part = cr.split('/').last().unwrap();
        let size = total_part.parse::<u64>().unwrap();
        assert_eq!(size, 104_857_600);
    }
}
