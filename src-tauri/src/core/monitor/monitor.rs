use super::payload::{DownloadProgressPayload, SegmentProgressPayload};
use crate::core::destination::get_part_file_path;
use crate::core::part::model::DownloadPart;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration, Instant};

pub const EMA_ALPHA: f64 = 0.25;
pub const WARMUP_SAMPLES: usize = 20; // 20 samples @ 100ms = 2.0s warmup before displaying ETA
pub const UI_EMIT_INTERVAL_MS: u64 = 1000; // Throttle UI progress emission to once per second (1000ms)

pub fn emit_progress_event<R: tauri::Runtime>(app: &AppHandle<R>, payload: DownloadProgressPayload) {
    let _ = app.emit("download-progress", payload);
}

/// Rilo Core Monitor: Smoothed Speed, Segment Breakdown & ETA Monitor Task
pub async fn run_100ms_progress_monitor<R: tauri::Runtime>(
    app: AppHandle<R>,
    download_id: String,
    filename: String,
    save_path: String,
    total_bytes: u64,
    downloaded_atomic: Arc<AtomicU64>,
    done_flag: Arc<AtomicBool>,
    active_threads: u32,
    resumable: bool,
    etag: String,
    last_modified: String,
    mime_type: String,
    parts: Vec<DownloadPart>,
    file_path: PathBuf,
) {
    let mut last_check = Instant::now();
    let mut last_emit = Instant::now();
    let mut last_bytes = downloaded_atomic.load(Ordering::Relaxed);

    let mut smoothed_speed_bps: f64 = 0.0;
    let mut sample_count: usize = 0;

    let num_parts = parts.len();
    let mut last_part_bytes: Vec<u64> = vec![0; num_parts];

    while !done_flag.load(Ordering::Relaxed) {
        sleep(Duration::from_millis(100)).await;

        let downloaded_now = downloaded_atomic.load(Ordering::Relaxed);
        let elapsed = last_check.elapsed();

        if elapsed >= Duration::from_millis(100) {
            let elapsed_secs = elapsed.as_secs_f64();
            if elapsed_secs > 0.0 {
                let diff = downloaded_now.saturating_sub(last_bytes);
                let instantaneous_speed = diff as f64 / elapsed_secs;

                if sample_count == 0 {
                    smoothed_speed_bps = instantaneous_speed;
                } else {
                    smoothed_speed_bps = (EMA_ALPHA * instantaneous_speed) + ((1.0 - EMA_ALPHA) * smoothed_speed_bps);
                }
                sample_count += 1;
            }
            last_bytes = downloaded_now;
            last_check = Instant::now();

            // Emit to UI at 1000ms cadence to prevent UI lag and jitter
            if last_emit.elapsed() >= Duration::from_millis(UI_EMIT_INTERVAL_MS) || downloaded_now >= total_bytes {
                last_emit = Instant::now();

                let current_speed_u64 = smoothed_speed_bps as u64;

                let eta_seconds = if sample_count >= WARMUP_SAMPLES && current_speed_u64 > 0 && total_bytes > downloaded_now {
                    Some((total_bytes - downloaded_now) / current_speed_u64)
                } else {
                    None
                };

                // Compute real authoritative per-segment progress payloads
                let mut segment_payloads = Vec::with_capacity(num_parts);
                for (idx, part) in parts.iter().enumerate() {
                    let part_file_path = get_part_file_path(&file_path, idx);
                    let part_downloaded = if let Ok(meta) = tokio::fs::metadata(&part_file_path).await {
                        meta.len()
                    } else {
                        part.downloaded_bytes
                    };

                    let part_total = part.expected_size();
                    let part_pct = if part_total > 0 {
                        ((part_downloaded as f64 / part_total as f64) * 100.0).clamp(0.0, 100.0)
                    } else {
                        0.0
                    };

                    let part_diff = part_downloaded.saturating_sub(last_part_bytes[idx]);
                    let part_speed = if elapsed_secs > 0.0 {
                        (part_diff as f64 / elapsed_secs) as u64
                    } else {
                        0
                    };
                    last_part_bytes[idx] = part_downloaded;

                    let part_state = if part_downloaded >= part_total && part_total > 0 {
                        "completed".to_string()
                    } else if part_downloaded > 0 {
                        "downloading".to_string()
                    } else {
                        "pending".to_string()
                    };

                    segment_payloads.push(SegmentProgressPayload {
                        segment_id: idx + 1,
                        start_byte: part.start_byte,
                        end_byte: part.end_byte,
                        downloaded_bytes: part_downloaded,
                        total_bytes: part_total,
                        progress_percent: part_pct,
                        current_speed_bps: part_speed,
                        state: part_state,
                    });
                }

                emit_progress_event(
                    &app,
                    DownloadProgressPayload {
                        download_id: download_id.clone(),
                        bytes_downloaded: downloaded_now,
                        total_bytes,
                        status: "downloading".to_string(),
                        error_message: None,
                        filename: filename.clone(),
                        save_path: save_path.clone(),
                        speed_bps: current_speed_u64,
                        eta_seconds,
                        active_threads,
                        resumable,
                        etag: etag.clone(),
                        last_modified: last_modified.clone(),
                        mime_type: mime_type.clone(),
                        segments: segment_payloads,
                    },
                );
            }
        }
    }
}
