use crate::config::AppConfig;
use crate::db::Database;
use crate::models::{DownloadProgressPayload, DownloadRecord};
use dlman_core::DlmanCore;
use dlman_types::{CoreEvent, Download, DownloadStatus};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

pub fn download_to_record(d: &Download) -> DownloadRecord {
    let save_path = d.destination.join(&d.filename).to_string_lossy().to_string();
    let status_str = match d.status {
        DownloadStatus::Pending => "Pending",
        DownloadStatus::Downloading => "Downloading",
        DownloadStatus::Paused => "Paused",
        DownloadStatus::Completed => "Completed",
        DownloadStatus::Failed => "Failed",
        DownloadStatus::Queued => "Queued",
        DownloadStatus::Cancelled => "Cancelled",
        DownloadStatus::Deleted => "Deleted",
    }
    .to_string();

    DownloadRecord {
        id: d.id.to_string(),
        filename: d.filename.clone(),
        url: d.url.clone(),
        redirect_url: d.final_url.clone().unwrap_or_else(|| d.url.clone()),
        save_path,
        total_bytes: d.size.unwrap_or(0),
        downloaded_bytes: d.downloaded,
        status: status_str,
        created_at: d.created_at.to_rfc3339(),
        updated_at: d.created_at.to_rfc3339(),
        completed_at: d.completed_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        threads: if d.segments.is_empty() { 4 } else { d.segments.len() as u32 },
        etag: String::new(),
        last_modified: String::new(),
        mime_type: String::new(),
        accept_ranges: if d.segments.len() > 1 { "bytes".to_string() } else { String::new() },
        resumable: true,
        retry_count: d.retry_count,
        auto_extract: false,
        extract_dir: String::new(),
        delete_archive_after_extract: false,
        extraction_state: "Pending".to_string(),
        speed_limit_kbps: d.speed_limit.map(|s| s / 1024).unwrap_or(0),
    }
}

pub fn resolve_unique_filename(
    save_dir: &Path,
    filename: &str,
    existing_downloads: &[Download],
    current_id: Option<Uuid>,
) -> String {
    let sanitized = crate::core::destination::sanitize_filename(filename);
    let path_obj = Path::new(&sanitized);
    let stem = path_obj.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("");

    let existing_paths: Vec<String> = existing_downloads
        .iter()
        .filter(|d| current_id.map(|id| d.id != id).unwrap_or(true))
        .map(|d| d.destination.join(&d.filename).to_string_lossy().to_string())
        .collect();

    for count in 0..1000 {
        let candidate_name = if count == 0 {
            sanitized.clone()
        } else if ext.is_empty() {
            format!("{} ({})", stem, count)
        } else {
            format!("{} ({}).{}", stem, count, ext)
        };

        let candidate_path = save_dir.join(&candidate_name);
        let candidate_path_str = candidate_path.to_string_lossy().to_string();

        if !candidate_path.exists() && !existing_paths.contains(&candidate_path_str) {
            return candidate_name;
        }
    }
    sanitized
}

#[derive(Clone)]
pub struct DownloadManager {
    pub core: DlmanCore,
    pub db: Database,
    pub config_path: PathBuf,
    pub app_config: Arc<Mutex<AppConfig>>,
}

impl DownloadManager {
    pub async fn new(
        db: Database,
        app_config: AppConfig,
        config_path: PathBuf,
        data_dir: PathBuf,
    ) -> Self {
        let core = DlmanCore::new(data_dir)
            .await
            .expect("Failed initializing DlmanCore engine");

        Self {
            core,
            db,
            config_path,
            app_config: Arc::new(Mutex::new(app_config)),
        }
    }

    pub fn listen_events<R: tauri::Runtime>(&self, app_handle: AppHandle<R>) {
        let mut rx = self.core.subscribe();
        let db = self.db.inner.clone();

        tauri::async_runtime::spawn(async move {
            struct CachedDlMeta {
                filename: String,
                save_path: String,
                segments_count: u32,
                status_str: String,
                error: Option<String>,
                segments: Vec<crate::core::monitor::payload::SegmentProgressPayload>,
            }
            let mut meta_cache: std::collections::HashMap<Uuid, CachedDlMeta> = std::collections::HashMap::new();

            while let Ok(event) = rx.recv().await {
                match event {
                    CoreEvent::DownloadProgress { id, downloaded, total, speed, eta } => {
                        if let Some(cached) = meta_cache.get(&id) {
                            let payload = DownloadProgressPayload {
                                download_id: id.to_string(),
                                bytes_downloaded: downloaded,
                                total_bytes: total.unwrap_or(0),
                                status: cached.status_str.clone(),
                                error_message: cached.error.clone(),
                                filename: cached.filename.clone(),
                                save_path: cached.save_path.clone(),
                                speed_bps: speed,
                                eta_seconds: eta,
                                active_threads: cached.segments_count,
                                resumable: true,
                                etag: String::new(),
                                last_modified: String::new(),
                                mime_type: String::new(),
                                segments: cached.segments.clone(),
                            };
                            let _ = app_handle.emit("download-progress", payload);
                        } else if let Ok(Some(d)) = db.load_download(id).await {
                            let save_path = d.destination.join(&d.filename).to_string_lossy().to_string();
                            let status_str = match d.status {
                                DownloadStatus::Downloading => "downloading",
                                DownloadStatus::Paused => "paused",
                                DownloadStatus::Completed => "completed",
                                DownloadStatus::Failed => "error",
                                DownloadStatus::Cancelled => "cancelled",
                                DownloadStatus::Queued => "queued",
                                _ => "downloading",
                            };

                            let segment_payloads: Vec<_> = d.segments.iter().map(|s| {
                                crate::core::monitor::payload::SegmentProgressPayload {
                                    segment_id: (s.index + 1) as usize,
                                    start_byte: s.start,
                                    end_byte: s.end,
                                    downloaded_bytes: s.downloaded,
                                    total_bytes: s.size(),
                                    progress_percent: s.progress(),
                                    current_speed_bps: 0,
                                    state: if s.complete { "completed" } else if status_str == "downloading" { "downloading" } else { "pending" }.to_string(),
                                }
                            }).collect();

                            meta_cache.insert(id, CachedDlMeta {
                                filename: d.filename.clone(),
                                save_path: save_path.clone(),
                                segments_count: if d.segments.is_empty() { 1 } else { d.segments.len() as u32 },
                                status_str: status_str.to_string(),
                                error: d.error.clone(),
                                segments: segment_payloads.clone(),
                            });

                            let payload = DownloadProgressPayload {
                                download_id: id.to_string(),
                                bytes_downloaded: downloaded,
                                total_bytes: total.unwrap_or(0),
                                status: status_str.to_string(),
                                error_message: d.error.clone(),
                                filename: d.filename.clone(),
                                save_path,
                                speed_bps: speed,
                                eta_seconds: eta,
                                active_threads: if d.segments.is_empty() { 1 } else { d.segments.len() as u32 },
                                resumable: true,
                                etag: String::new(),
                                last_modified: String::new(),
                                mime_type: String::new(),
                                segments: segment_payloads,
                            };
                            let _ = app_handle.emit("download-progress", payload);
                        }
                    }
                    CoreEvent::DownloadStatusChanged { id, status, error } => {
                        let status_str = match status {
                            DownloadStatus::Downloading => "downloading",
                            DownloadStatus::Paused => "paused",
                            DownloadStatus::Completed => "completed",
                            DownloadStatus::Failed => "error",
                            DownloadStatus::Cancelled => "cancelled",
                            DownloadStatus::Queued => "queued",
                            _ => "downloading",
                        };

                        if let Some(cached) = meta_cache.get_mut(&id) {
                            cached.status_str = status_str.to_string();
                            if error.is_some() { cached.error = error.clone(); }
                        }

                        if let Ok(Some(d)) = db.load_download(id).await {
                            let save_path = d.destination.join(&d.filename).to_string_lossy().to_string();
                            let payload = DownloadProgressPayload {
                                download_id: id.to_string(),
                                bytes_downloaded: d.downloaded,
                                total_bytes: d.size.unwrap_or(d.downloaded),
                                status: status_str.to_string(),
                                error_message: error.or(d.error),
                                filename: d.filename.clone(),
                                save_path: save_path.clone(),
                                speed_bps: 0,
                                eta_seconds: None,
                                active_threads: 0,
                                resumable: true,
                                etag: String::new(),
                                last_modified: String::new(),
                                mime_type: String::new(),
                                segments: vec![],
                            };
                            let _ = app_handle.emit("download-progress", payload);

                            if status == DownloadStatus::Completed {
                                meta_cache.remove(&id);
                                if let Ok(Some(action_str)) = db.get_setting("post_download_action").await {
                                    let custom_cmd = db.get_setting("custom_command").await.ok().flatten().unwrap_or_default();
                                    let action = crate::core::post_action::PostDownloadAction::parse(&action_str, &custom_cmd);
                                    action.execute();
                                }
                            }
                        }
                    }
                    CoreEvent::DownloadAdded { download } | CoreEvent::DownloadUpdated { download } => {
                        let id = download.id;
                        let save_path = download.destination.join(&download.filename).to_string_lossy().to_string();
                        let status_str = match download.status {
                            DownloadStatus::Downloading => "downloading",
                            DownloadStatus::Paused => "paused",
                            DownloadStatus::Completed => "completed",
                            DownloadStatus::Failed => "error",
                            DownloadStatus::Cancelled => "cancelled",
                            DownloadStatus::Queued => "queued",
                            _ => "downloading",
                        };

                        let segment_payloads: Vec<_> = download.segments.iter().map(|s| {
                            crate::core::monitor::payload::SegmentProgressPayload {
                                segment_id: (s.index + 1) as usize,
                                start_byte: s.start,
                                end_byte: s.end,
                                downloaded_bytes: s.downloaded,
                                total_bytes: s.size(),
                                progress_percent: s.progress(),
                                current_speed_bps: 0,
                                state: if s.complete {
                                    "completed"
                                } else if status_str == "downloading" {
                                    "downloading"
                                } else {
                                    "pending"
                                }.to_string(),
                            }
                        }).collect();

                        meta_cache.insert(id, CachedDlMeta {
                            filename: download.filename.clone(),
                            save_path: save_path.clone(),
                            segments_count: if download.segments.is_empty() { 1 } else { download.segments.len() as u32 },
                            status_str: status_str.to_string(),
                            error: download.error.clone(),
                            segments: segment_payloads.clone(),
                        });

                        let payload = DownloadProgressPayload {
                            download_id: download.id.to_string(),
                            bytes_downloaded: download.downloaded,
                            total_bytes: download.size.unwrap_or(0),
                            status: status_str.to_string(),
                            error_message: download.error.clone(),
                            filename: download.filename.clone(),
                            save_path,
                            speed_bps: 0,
                            eta_seconds: None,
                            active_threads: if download.segments.is_empty() { 1 } else { download.segments.len() as u32 },
                            resumable: true,
                            etag: String::new(),
                            last_modified: String::new(),
                            mime_type: String::new(),
                            segments: segment_payloads,
                        };
                        let _ = app_handle.emit("download-progress", payload);
                    }
                    CoreEvent::DownloadRemoved { id } => {
                        meta_cache.remove(&id);
                    }
                    CoreEvent::SegmentProgress { download_id, segment_index, downloaded } => {
                        if let Some(cached) = meta_cache.get_mut(&download_id) {
                            // Segment IDs in SegmentProgressPayload are 1-based (segment_id = index + 1),
                            // while segment_index here is 0-based. Match by segment_id = segment_index + 1.
                            let target_id = (segment_index + 1) as usize;
                            if let Some(seg) = cached.segments.iter_mut().find(|s| s.segment_id == target_id) {
                                seg.downloaded_bytes = downloaded;
                                let progress = if seg.total_bytes > 0 {
                                    (downloaded as f64 / seg.total_bytes as f64) * 100.0
                                } else {
                                    0.0
                                };
                                seg.progress_percent = progress;
                                // Mark as actively downloading (not pending) once bytes are flowing
                                if seg.state != "completed" {
                                    seg.state = "downloading".to_string();
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        });
    }

    pub async fn start_download(
        &self,
        download_id: Option<String>,
        url: String,
        custom_path: Option<String>,
        speed_limit: Option<u64>,
        num_connections: Option<u32>,
        is_resume: bool,
    ) -> Result<DownloadRecord, String> {
        if is_resume {
            if let Some(ref id_str) = download_id {
                if let Ok(uuid) = Uuid::parse_str(id_str) {
                    if let Ok(Some(dl)) = self.db.inner.load_download(uuid).await {
                        if let Some(limit) = speed_limit {
                            let _ = self.core.update_download_speed_limit(uuid, Some(limit)).await;
                        }
                        self.core.resume_download_with_options(uuid, num_connections).await.map_err(|e| e.to_string())?;
                        return Ok(download_to_record(&dl));
                    }
                }
            }
        }

        let cfg = self.app_config.lock().await.clone();

        // Determine base save directory
        let base_dir = if let Some(ref path_str) = custom_path {
            let p = PathBuf::from(path_str);
            if p.is_file() || p.extension().is_some() {
                p.parent().map(|parent| parent.to_path_buf()).unwrap_or(p)
            } else {
                p
            }
        } else if !cfg.download.download_directory.trim().is_empty() {
            PathBuf::from(&cfg.download.download_directory)
        } else {
            dirs::download_dir().unwrap_or_else(|| PathBuf::from("."))
        };

        let use_category = cfg.download.use_category_by_default && custom_path.is_none();
        let temp_download_id = uuid::Uuid::new_v4();
        let init_resolved = dlman_core::resolve_authoritative_filename(temp_download_id, None, None, &url);
        let final_save_dir = dlman_core::resolve_final_download_dir(&base_dir, use_category, &init_resolved.resolved_filename);

        let _ = tokio::fs::create_dir_all(&final_save_dir).await;

        let category_name = if use_category { dlman_core::get_category_folder_name(&init_resolved.resolved_filename) } else { "none" };
        eprintln!(
            "[DOWNLOAD-PATH] url={} filename=\"{}\" category=\"{}\" base_dir={:?} use_category={} final_dir={:?}",
            url, init_resolved.resolved_filename, category_name, base_dir, use_category, final_save_dir
        );

        let queue_id = Uuid::nil();
        let download = self
            .core
            .add_download(&url, final_save_dir, queue_id, None, None, false)
            .await
            .map_err(|e| {
                eprintln!("[ERROR] add_download failed: {}", e);
                e.to_string()
            })?;

        if let Some(limit) = speed_limit {
            let _ = self.core.update_download_speed_limit(download.id, Some(limit)).await;
        }

        eprintln!("[START-TASK] id={} num_connections={:?}", download.id, num_connections);
        self.core.resume_download_with_options(download.id, num_connections).await.map_err(|e| {
            eprintln!("[ERROR] resume_download failed: {}", e);
            e.to_string()
        })?;

        let updated_dl = self.core.get_download(download.id).await.unwrap_or(download);
        eprintln!("[STATUS] id={} status={:?}", updated_dl.id, updated_dl.status);

        Ok(download_to_record(&updated_dl))
    }

    pub async fn pause_download(&self, download_id: String) -> Result<(), String> {
        let uuid = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
        self.core.pause_download(uuid).await.map_err(|e| e.to_string())
    }

    pub async fn resume_download(&self, download_id: String) -> Result<(), String> {
        let uuid = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
        self.core.resume_download(uuid).await.map_err(|e| e.to_string())
    }

    pub async fn cancel_download(&self, download_id: String) -> Result<(), String> {
        let uuid = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
        self.core.cancel_download(uuid).await.map_err(|e| e.to_string())
    }

    pub async fn delete_download(&self, download_id: String, delete_file: bool) -> Result<(), String> {
        let uuid = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
        self.core.delete_download(uuid, delete_file).await.map_err(|e| e.to_string())
    }
}
