use crate::core::connection::probe_url;
use crate::core::destination::{cleanup_part_files, get_part_file_path, merge_parts_to_destination, open_append_file};
use crate::core::monitor::{emit_progress_event, DownloadProgressPayload};
use crate::core::part::{run_part_worker, split_into_parts};
use crate::download::DownloadManager;
use crate::models::{DownloadCommand, DownloadRecord};
use futures_util::StreamExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;
use tokio::sync::{mpsc, Mutex};
use tokio::time::{sleep, Duration, Instant};
use tokio_util::sync::CancellationToken;

pub async fn execute_download(
    app: AppHandle,
    manager: DownloadManager,
    download_id: String,
    url: String,
    custom_path: Option<String>,
    speed_limit: Option<u64>,
    num_connections: Option<u32>,
    is_resume: bool,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<DownloadCommand>(10);
    let cancel_token = CancellationToken::new();

    {
        let mut active = manager.active_downloads.lock().await;
        active.insert(download_id.clone(), (tx, cancel_token.clone()));
    }

    let active_downloads_map = Arc::clone(&manager.active_downloads);
    let db = manager.db.clone();
    let semaphore = Arc::clone(&manager.semaphore);
    let client = manager.http_client.clone();

    tokio::spawn(async move {
        let parsed_url = match reqwest::Url::parse(&url) {
            Ok(u) => u,
            Err(e) => {
                emit_error(&app, &download_id, "", "", format!("Invalid URL: {}", e));
                cleanup_active(&active_downloads_map, &download_id).await;
                return;
            }
        };

        let raw_filename = parsed_url
            .path_segments()
            .and_then(|segments| segments.last())
            .filter(|name| !name.is_empty())
            .unwrap_or("download.bin");

        let filename = crate::core::destination::sanitize_filename(raw_filename);

        let save_dir = if let Some(ref path_str) = custom_path {
            let p = PathBuf::from(path_str);
            if p.is_file() || p.extension().is_some() {
                p.parent().map(|parent| parent.to_path_buf()).unwrap_or(p)
            } else {
                p
            }
        } else {
            match app.path().download_dir() {
                Ok(path) => path,
                Err(_) => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            }
        };

        let file_path = save_dir.join(&filename);
        let save_path_str = file_path.to_string_lossy().to_string();

        if let Some(parent) = file_path.parent() {
            if let Err(e) = tokio::fs::create_dir_all(parent).await {
                emit_error(
                    &app,
                    &download_id,
                    &filename,
                    &save_path_str,
                    format!("Failed creating directory: {}", e),
                );
                cleanup_active(&active_downloads_map, &download_id).await;
                return;
            }
        }

        let created_at = chrono_now();
        let target_connections = num_connections.unwrap_or(4).clamp(1, 16);

        if !is_resume {
            if let Some(ref db_conn) = db {
                let _ = db_conn.insert_or_update(&DownloadRecord {
                    id: download_id.clone(),
                    filename: filename.clone(),
                    url: url.clone(),
                    redirect_url: url.clone(),
                    save_path: save_path_str.clone(),
                    total_bytes: 0,
                    downloaded_bytes: 0,
                    status: "Queued".to_string(),
                    created_at: created_at.clone(),
                    updated_at: created_at.clone(),
                    completed_at: String::new(),
                    threads: target_connections,
                    etag: String::new(),
                    last_modified: String::new(),
                    mime_type: String::new(),
                    accept_ranges: "bytes".to_string(),
                    resumable: true,
                    retry_count: 0,
                    auto_extract: false,
                    extract_dir: String::new(),
                    delete_archive_after_extract: false,
                    extraction_state: "Pending".to_string(),
                });
            }

            emit_payload(
                &app,
                DownloadProgressPayload {
                    download_id: download_id.clone(),
                    bytes_downloaded: 0,
                    total_bytes: 0,
                    status: "queued".to_string(),
                    error_message: None,
                    filename: filename.clone(),
                    save_path: save_path_str.clone(),
                    speed_bps: 0,
                    eta_seconds: None,
                    active_threads: 0,
                    resumable: true,
                    etag: String::new(),
                    last_modified: String::new(),
                    mime_type: String::new(),
                    segments: vec![],
                },
            );
        }

        let _permit = tokio::select! {
            res = semaphore.acquire() => match res {
                Ok(p) => p,
                Err(e) => {
                    emit_error(&app, &download_id, &filename, &save_path_str, format!("Queue semaphore error: {}", e));
                    cleanup_active(&active_downloads_map, &download_id).await;
                    return;
                },
            },
            _ = cancel_token.cancelled() => {
                cleanup_part_files(&file_path, target_connections as usize).await;
                emit_cancelled(&app, &download_id, &filename, &save_path_str);
                cleanup_active(&active_downloads_map, &download_id).await;
                return;
            }
        };

        if let Some(ref db_conn) = db {
            let _ = db_conn.update_progress(&download_id, 0, 0, "Downloading");
        }

        // Use core::connection::probe_url for Range probing, metadata, and Content-Disposition filename resolution
        let probe = probe_url(&client, &url).await;
        let total_bytes = probe.total_bytes;
        let etag = probe.etag;
        let last_modified = probe.last_modified;
        let mime_type = probe.mime_type;
        let accept_ranges = probe.accept_ranges;
        let redirect_url = probe.redirect_url;
        let supports_range = probe.supports_range;

        // Resolve final filename from Content-Disposition / redirected URL path
        let resolved_filename = if let Some(suggested) = probe.suggested_filename {
            crate::core::destination::sanitize_filename(&suggested)
        } else {
            filename.clone()
        };

        let file_path = save_dir.join(&resolved_filename);
        let save_path_str = file_path.to_string_lossy().to_string();

        if let Some(ref db_conn) = db {
            let _ = db_conn.update_metadata(
                &download_id,
                &redirect_url,
                &etag,
                &last_modified,
                &mime_type,
                &accept_ranges,
                supports_range,
            );
            if resolved_filename != filename {
                let _ = db_conn.update_filename(&download_id, &resolved_filename, &save_path_str);
            }
        }

        // Rilo Dynamic Segment Sizing:
        // Calculate optimal segment count based on Content-Length and Range support
        let dynamic_segment_count = crate::core::part::calculate_dynamic_segments(total_bytes, num_connections) as u32;

        if supports_range && total_bytes > 0 && dynamic_segment_count > 1 {
            execute_multipart_download(
                app,
                active_downloads_map,
                db,
                client,
                download_id,
                redirect_url,
                resolved_filename,
                file_path,
                save_path_str,
                total_bytes,
                dynamic_segment_count,
                speed_limit,
                rx,
                cancel_token,
                is_resume,
                etag,
                last_modified,
                mime_type,
                supports_range,
            )
            .await;
        } else {
            execute_singlepart_download(
                app,
                active_downloads_map,
                db,
                client,
                download_id,
                redirect_url,
                resolved_filename,
                file_path,
                save_path_str,
                speed_limit,
                is_resume,
                rx,
                cancel_token,
                etag,
                last_modified,
                mime_type,
                supports_range,
            )
            .await;
        }
    });

    Ok(())
}

async fn execute_multipart_download(
    app: AppHandle,
    active_map: Arc<Mutex<std::collections::HashMap<String, (mpsc::Sender<DownloadCommand>, CancellationToken)>>>,
    db: Option<crate::db::Database>,
    client: reqwest::Client,
    download_id: String,
    url: String,
    filename: String,
    file_path: PathBuf,
    save_path_str: String,
    total_bytes: u64,
    connections: u32,
    speed_limit: Option<u64>,
    mut rx: mpsc::Receiver<DownloadCommand>,
    cancel_token: CancellationToken,
    _is_resume: bool,
    etag: String,
    last_modified: String,
    mime_type: String,
    resumable: bool,
) {
    let num_parts = connections as usize;
    let mut parts = split_into_parts(total_bytes, num_parts);
    let downloaded_atomic = Arc::new(AtomicU64::new(0));
    let pause_flag = Arc::new(AtomicBool::new(false));
    let error_flag = Arc::new(AtomicBool::new(false));
    let done_flag = Arc::new(AtomicBool::new(false));

    // Rilo Step 2: Create Token Bucket Rate Limiter
    let rate_limiter = crate::core::connection::RateLimiter::new(speed_limit.unwrap_or(0));

    // Rilo Step 4: Spawn 100ms dedicated UI progress monitor
    let app_monitor = app.clone();
    let id_monitor = download_id.clone();
    let name_monitor = filename.clone();
    let path_monitor = save_path_str.clone();
    let counter_monitor = Arc::clone(&downloaded_atomic);
    let done_monitor = Arc::clone(&done_flag);
    let etag_m = etag.clone();
    let lm_m = last_modified.clone();
    let mime_m = mime_type.clone();

    let parts_m = parts.clone();
    let file_path_m = file_path.clone();

    tokio::spawn(async move {
        crate::core::monitor::monitor::run_100ms_progress_monitor(
            app_monitor,
            id_monitor,
            name_monitor,
            path_monitor,
            total_bytes,
            counter_monitor,
            done_monitor,
            connections,
            resumable,
            etag_m,
            lm_m,
            mime_m,
            parts_m,
            file_path_m,
        )
        .await;
    });

    let mut tasks = Vec::new();

    for i in 0..num_parts {
        let part_file_path = get_part_file_path(&file_path, i);

        let mut existing_part_bytes: u64 = 0;
        if let Ok(meta) = tokio::fs::metadata(&part_file_path).await {
            existing_part_bytes = meta.len();
        }
        parts[i].downloaded_bytes = existing_part_bytes;
        downloaded_atomic.fetch_add(existing_part_bytes, Ordering::Relaxed);

        if parts[i].is_completed() {
            continue;
        }

        let client_clone = client.clone();
        let url_clone = url.clone();
        let atomic_counter = Arc::clone(&downloaded_atomic);
        let pause_clone = Arc::clone(&pause_flag);
        let error_clone = Arc::clone(&error_flag);
        let token_clone = cancel_token.clone();
        let etag_clone = etag.clone();
        let part_item = parts[i].clone();
        let limiter_clone = rate_limiter.clone();

        let task = tokio::spawn(async move {
            run_part_worker(
                client_clone,
                url_clone,
                part_item,
                &part_file_path,
                atomic_counter,
                pause_clone,
                error_clone,
                token_clone,
                etag_clone,
                limiter_clone,
            )
            .await
        });

        tasks.push(task);
    }

    let mut last_speed_check = Instant::now();
    let mut last_db_update = Instant::now();
    let mut last_downloaded_val = downloaded_atomic.load(Ordering::Relaxed);
    let mut current_speed_bps = 0u64;
    let limit_bps = speed_limit.unwrap_or(0);

    loop {
        if cancel_token.is_cancelled() {
            break;
        }

        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                DownloadCommand::Pause => {
                    pause_flag.store(true, Ordering::Relaxed);
                }
                DownloadCommand::Cancel => {
                    cancel_token.cancel();
                }
                DownloadCommand::SetSpeedLimit(_) => {}
            }
        }

        let downloaded_now = downloaded_atomic.load(Ordering::Relaxed);
        let elapsed = last_speed_check.elapsed();

        if elapsed >= Duration::from_millis(300) {
            let elapsed_secs = elapsed.as_secs_f64();
            if elapsed_secs > 0.0 {
                let diff = downloaded_now.saturating_sub(last_downloaded_val);
                current_speed_bps = (diff as f64 / elapsed_secs) as u64;
            }
            last_downloaded_val = downloaded_now;
            last_speed_check = Instant::now();

            // Throttle SQLite DB progress writes to once every 2000ms (matching DLMan standard)
            if last_db_update.elapsed() >= Duration::from_millis(2000) {
                if let Some(ref db_conn) = db {
                    let _ = db_conn.update_progress(&download_id, downloaded_now, total_bytes, "Downloading");
                }
                last_db_update = Instant::now();
            }
        }

        if limit_bps > 0 && current_speed_bps > limit_bps {
            sleep(Duration::from_millis(50)).await;
        } else {
            sleep(Duration::from_millis(50)).await;
        }

        if error_flag.load(Ordering::Relaxed) {
            break;
        }

        let mut all_done = true;
        for t in &tasks {
            if !t.is_finished() {
                all_done = false;
                break;
            }
        }

        if all_done {
            break;
        }
    }

    done_flag.store(true, Ordering::Relaxed);

    if cancel_token.is_cancelled() {
        cleanup_part_files(&file_path, num_parts).await;
        if let Some(ref db_conn) = db {
            let _ = db_conn.update_progress(&download_id, 0, 0, "Cancelled");
        }
        emit_cancelled(&app, &download_id, &filename, &save_path_str);
        cleanup_active(&active_map, &download_id).await;
        return;
    }

    if error_flag.load(Ordering::Relaxed) {
        cleanup_part_files(&file_path, num_parts).await;
        if let Some(ref db_conn) = db {
            let _ = db_conn.update_progress(&download_id, 0, total_bytes, "Failed");
        }
        emit_error(
            &app,
            &download_id,
            &filename,
            &save_path_str,
            "Multi-part download chunk error occurred.".to_string(),
        );
        cleanup_active(&active_map, &download_id).await;
        return;
    }

    if pause_flag.load(Ordering::Relaxed) {
        let final_downloaded = downloaded_atomic.load(Ordering::Relaxed);
        if let Some(ref db_conn) = db {
            let _ = db_conn.update_progress(&download_id, final_downloaded, total_bytes, "Paused");
        }
        emit_payload(
            &app,
            DownloadProgressPayload {
                download_id: download_id.clone(),
                bytes_downloaded: final_downloaded,
                total_bytes,
                status: "paused".to_string(),
                error_message: None,
                filename,
                save_path: save_path_str,
                speed_bps: 0,
                eta_seconds: None,
                active_threads: connections,
                resumable,
                etag,
                last_modified,
                mime_type,
                segments: vec![],
            },
        );
        cleanup_active(&active_map, &download_id).await;
        return;
    }

    // Merge segment files using core::destination::merge_parts_to_destination
    if let Err(e) = merge_parts_to_destination(&file_path, num_parts).await {
        emit_error(&app, &download_id, &filename, &save_path_str, format!("Merge error: {}", e));
        cleanup_active(&active_map, &download_id).await;
        return;
    }

    if let Some(ref db_conn) = db {
        let _ = db_conn.update_progress(&download_id, total_bytes, total_bytes, "Completed");
        trigger_post_download_extraction(app.clone(), Some(db_conn), download_id.clone(), file_path.clone(), filename.clone());
    }

    emit_payload(
        &app,
        DownloadProgressPayload {
            download_id: download_id.clone(),
            bytes_downloaded: total_bytes,
            total_bytes,
            status: "completed".to_string(),
            error_message: None,
            filename,
            save_path: save_path_str,
            speed_bps: 0,
            eta_seconds: None,
            active_threads: 0,
            resumable,
            etag,
            last_modified,
            mime_type,
            segments: vec![],
        },
    );

    cleanup_active(&active_map, &download_id).await;
}

async fn execute_singlepart_download(
    app: AppHandle,
    active_map: Arc<Mutex<std::collections::HashMap<String, (mpsc::Sender<DownloadCommand>, CancellationToken)>>>,
    db: Option<crate::db::Database>,
    client: reqwest::Client,
    download_id: String,
    url: String,
    filename: String,
    file_path: PathBuf,
    save_path_str: String,
    speed_limit: Option<u64>,
    _is_resume: bool,
    mut rx: mpsc::Receiver<DownloadCommand>,
    cancel_token: CancellationToken,
    etag: String,
    last_modified: String,
    mime_type: String,
    resumable: bool,
) {
    let mut existing_bytes: u64 = 0;
    if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
        existing_bytes = metadata.len();
    }

    let mut req = client.get(&url);
    if existing_bytes > 0 {
        req = req.header(reqwest::header::RANGE, format!("bytes={}-", existing_bytes));
    }

    let response = match req.send().await {
        Ok(res) => res,
        Err(e) => {
            emit_error(&app, &download_id, &filename, &save_path_str, format!("HTTP request failed: {}", e));
            if let Some(ref db_conn) = db {
                let _ = db_conn.update_progress(&download_id, existing_bytes, 0, "Failed");
            }
            cleanup_active(&active_map, &download_id).await;
            return;
        }
    };

    let status_code = response.status();
    let mut actual_existing_bytes = existing_bytes;

    if status_code == reqwest::StatusCode::PARTIAL_CONTENT {
        // Range accepted
    } else if status_code.is_success() {
        actual_existing_bytes = 0;
    } else {
        emit_error(
            &app,
            &download_id,
            &filename,
            &save_path_str,
            format!("Server returned HTTP {}", status_code),
        );
        if let Some(ref db_conn) = db {
            let _ = db_conn.update_progress(&download_id, existing_bytes, 0, "Failed");
        }
        cleanup_active(&active_map, &download_id).await;
        return;
    }

    let content_length = response.content_length().unwrap_or(0);
    let total_bytes = if content_length > 0 {
        actual_existing_bytes + content_length
    } else {
        0
    };

    let mut file = match open_append_file(&file_path, actual_existing_bytes > 0).await {
        Ok(f) => f,
        Err(e) => {
            emit_error(&app, &download_id, &filename, &save_path_str, format!("Failed opening destination file: {}", e));
            if let Some(ref db_conn) = db {
                let _ = db_conn.update_progress(&download_id, existing_bytes, total_bytes, "Failed");
            }
            cleanup_active(&active_map, &download_id).await;
            return;
        }
    };

    let mut bytes_downloaded = actual_existing_bytes;
    let mut last_speed_check = Instant::now();
    let mut last_db_update = Instant::now();
    let mut bytes_since_last_check: u64 = 0;
    let mut current_speed_bps: u64 = 0;
    let singlepart_limiter = crate::core::connection::RateLimiter::new(speed_limit.unwrap_or(0));

    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        if cancel_token.is_cancelled() {
            let _ = file.flush().await;
            drop(file);
            let _ = tokio::fs::remove_file(&file_path).await;
            if let Some(ref db_conn) = db {
                let _ = db_conn.update_progress(&download_id, 0, 0, "Cancelled");
            }
            emit_cancelled(&app, &download_id, &filename, &save_path_str);
            cleanup_active(&active_map, &download_id).await;
            return;
        }

        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                DownloadCommand::Pause => {
                    let _ = file.flush().await;
                    if let Some(ref db_conn) = db {
                        let _ = db_conn.update_progress(&download_id, bytes_downloaded, total_bytes, "Paused");
                    }
                    emit_payload(
                        &app,
                        DownloadProgressPayload {
                            download_id: download_id.clone(),
                            bytes_downloaded,
                            total_bytes,
                            status: "paused".to_string(),
                            error_message: None,
                            filename: filename.clone(),
                            save_path: save_path_str.clone(),
                            speed_bps: 0,
                            eta_seconds: None,
                            active_threads: 1,
                            resumable,
                            etag,
                            last_modified,
                            mime_type,
                            segments: vec![],
                        },
                    );
                    cleanup_active(&active_map, &download_id).await;
                    return;
                }
                DownloadCommand::Cancel => {
                    cancel_token.cancel();
                }
                DownloadCommand::SetSpeedLimit(limit) => {
                    singlepart_limiter.set_limit(limit).await;
                }
            }
        }

        let chunk = match chunk_result {
            Ok(c) => c,
            Err(e) => {
                emit_error(&app, &download_id, &filename, &save_path_str, format!("Network stream error: {}", e));
                if let Some(ref db_conn) = db {
                    let _ = db_conn.update_progress(&download_id, bytes_downloaded, total_bytes, "Failed");
                }
                cleanup_active(&active_map, &download_id).await;
                return;
            }
        };

        let chunk_len = chunk.len() as u64;

        singlepart_limiter.acquire(chunk_len).await;

        if let Err(e) = file.write_all(&chunk).await {
            emit_error(&app, &download_id, &filename, &save_path_str, format!("File write error: {}", e));
            if let Some(ref db_conn) = db {
                let _ = db_conn.update_progress(&download_id, bytes_downloaded, total_bytes, "Failed");
            }
            cleanup_active(&active_map, &download_id).await;
            return;
        }

        bytes_downloaded += chunk_len;
        bytes_since_last_check += chunk_len;

        let elapsed = last_speed_check.elapsed();
        if elapsed >= Duration::from_millis(300) {
            let elapsed_secs = elapsed.as_secs_f64();
            if elapsed_secs > 0.0 {
                current_speed_bps = (bytes_since_last_check as f64 / elapsed_secs) as u64;
            }
            bytes_since_last_check = 0;
            last_speed_check = Instant::now();

            let eta_seconds = if current_speed_bps > 0 && total_bytes > bytes_downloaded {
                Some((total_bytes - bytes_downloaded) / current_speed_bps)
            } else {
                None
            };

            // Throttle SQLite DB writes to once every 2000ms
            if last_db_update.elapsed() >= Duration::from_millis(2000) {
                if let Some(ref db_conn) = db {
                    let _ = db_conn.update_progress(&download_id, bytes_downloaded, total_bytes, "Downloading");
                }
                last_db_update = Instant::now();
            }

            emit_payload(
                &app,
                DownloadProgressPayload {
                    download_id: download_id.clone(),
                    bytes_downloaded,
                    total_bytes,
                    status: "downloading".to_string(),
                    error_message: None,
                    filename: filename.clone(),
                    save_path: save_path_str.clone(),
                    speed_bps: current_speed_bps,
                    eta_seconds,
                    active_threads: 1,
                    resumable,
                    etag: etag.clone(),
                    last_modified: last_modified.clone(),
                    mime_type: mime_type.clone(),
                    segments: vec![],
                },
            );
        }
    }

    let _ = file.flush().await;

    let final_total = if total_bytes == 0 {
        bytes_downloaded
    } else {
        total_bytes
    };

    if let Some(ref db_conn) = db {
        let _ = db_conn.update_progress(&download_id, bytes_downloaded, final_total, "Completed");
        trigger_post_download_extraction(app.clone(), Some(db_conn), download_id.clone(), file_path.clone(), filename.clone());
    }

    emit_payload(
        &app,
        DownloadProgressPayload {
            download_id: download_id.clone(),
            bytes_downloaded,
            total_bytes: final_total,
            status: "completed".to_string(),
            error_message: None,
            filename,
            save_path: save_path_str,
            speed_bps: 0,
            eta_seconds: None,
            active_threads: 0,
            resumable,
            etag,
            last_modified,
            mime_type,
            segments: vec![],
        },
    );

    cleanup_active(&active_map, &download_id).await;
}

async fn cleanup_active(
    active_map: &Arc<Mutex<std::collections::HashMap<String, (mpsc::Sender<DownloadCommand>, CancellationToken)>>>,
    download_id: &str,
) {
    let mut active = active_map.lock().await;
    active.remove(download_id);
}

fn emit_payload(app: &AppHandle, payload: DownloadProgressPayload) {
    emit_progress_event(app, payload);
}

fn emit_cancelled(app: &AppHandle, download_id: &str, filename: &str, save_path: &str) {
    emit_payload(
        app,
        DownloadProgressPayload {
            download_id: download_id.to_string(),
            bytes_downloaded: 0,
            total_bytes: 0,
            status: "cancelled".to_string(),
            error_message: None,
            filename: filename.to_string(),
            save_path: save_path.to_string(),
            speed_bps: 0,
            eta_seconds: None,
            active_threads: 0,
            resumable: true,
            etag: String::new(),
            last_modified: String::new(),
            mime_type: String::new(),
            segments: vec![],
        },
    );
}

fn emit_error(
    app: &AppHandle,
    download_id: &str,
    filename: &str,
    save_path: &str,
    message: String,
) {
    emit_payload(
        app,
        DownloadProgressPayload {
            download_id: download_id.to_string(),
            bytes_downloaded: 0,
            total_bytes: 0,
            status: "error".to_string(),
            error_message: Some(message),
            filename: filename.to_string(),
            save_path: save_path.to_string(),
            speed_bps: 0,
            eta_seconds: None,
            active_threads: 0,
            resumable: false,
            etag: String::new(),
            last_modified: String::new(),
            mime_type: String::new(),
            segments: vec![],
        },
    );
}

fn chrono_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn trigger_post_download_extraction(
    app: AppHandle,
    db: Option<&crate::db::Database>,
    download_id: String,
    file_path: PathBuf,
    filename: String,
) {
    if !crate::core::archive::is_archive_filename(&filename) {
        return;
    }

    if let Some(db_conn) = db {
        if let Ok(Some(rec)) = db_conn.get_by_id(&download_id) {
            if rec.auto_extract {
                let dest = if rec.extract_dir.is_empty() {
                    file_path.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
                } else {
                    PathBuf::from(&rec.extract_dir)
                };

                let cancel_flag = Arc::new(AtomicBool::new(false));
                let options = crate::core::archive::ExtractionOptions {
                    archive_path: file_path.clone(),
                    dest_dir: dest,
                    password: None,
                    delete_after: rec.delete_archive_after_extract,
                };

                let app_handle = app.clone();
                let dl_id = download_id.clone();
                let db_c = db_conn.clone();
                let _ = db_conn.update_extraction_state(&download_id, "Extracting");

                tokio::task::spawn_blocking(move || {
                    let res = crate::core::archive::extract_archive(app_handle, dl_id.clone(), options, cancel_flag);
                    match res {
                        Ok(()) => {
                            let _ = db_c.update_extraction_state(&dl_id, "Extracted");
                        }
                        Err(e) => {
                            let state_str = if matches!(e, crate::core::archive::ExtractionError::Cancelled) {
                                "Cancelled"
                            } else {
                                "ExtractionFailed"
                            };
                            let _ = db_c.update_extraction_state(&dl_id, state_str);
                        }
                    }
                });
            }
        }
    }
}

