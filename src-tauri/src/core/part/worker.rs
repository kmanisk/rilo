use super::model::DownloadPart;
use crate::core::connection::RateLimiter;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::time::{sleep, Duration};
use tokio_util::sync::CancellationToken;

/// Calculate backoff with ±10% random jitter (Rilo Engine Standard)
fn get_backoff_with_jitter(attempt: u32) -> Duration {
    // Delays: 1s, 2s, 4s, 8s, 16s
    let base_secs = match attempt {
        1 => 1.0,
        2 => 2.0,
        3 => 4.0,
        4 => 8.0,
        _ => 16.0,
    };

    // Simple deterministic pseudo-jitter (±10%) using system timestamp nanos
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(500_000_000);
    
    // Scale nanos into range [-0.10, +0.10]
    let jitter_factor = 0.90 + (nanos as f64 / 1_000_000_000.0) * 0.20;
    let final_secs = base_secs * jitter_factor;

    Duration::from_secs_f64(final_secs)
}

pub async fn run_part_worker(
    client: reqwest::Client,
    url: String,
    part: DownloadPart,
    part_file_path: &Path,
    downloaded_atomic: Arc<AtomicU64>,
    pause_flag: Arc<AtomicBool>,
    error_flag: Arc<AtomicBool>,
    cancel_token: CancellationToken,
    _etag: String,
    rate_limiter: RateLimiter,
) -> bool {
    let mut retries: u32 = 0;
    const MAX_RETRIES: u32 = 5;

    loop {
        if cancel_token.is_cancelled() || pause_flag.load(Ordering::Relaxed) {
            eprintln!("[RILO WORKER {}] Paused or cancelled.", part.index);
            return true;
        }

        // Check actual disk offset for this part to prevent duplicate byte appends on retry
        let existing_disk_bytes = match tokio::fs::metadata(part_file_path).await {
            Ok(m) => m.len(),
            Err(_) => 0,
        };

        let current_start = part.start_byte + existing_disk_bytes;
        if current_start > part.end_byte {
            eprintln!("[RILO WORKER {}] Part fully written to disk ({}>={}).", part.index, current_start, part.end_byte);
            return true;
        }

        let range_header = format!("bytes={}-{}", current_start, part.end_byte);
        eprintln!(
            "[RILO WORKER {}] (Attempt {}) Disk Bytes={}. Requesting Range: {}",
            part.index,
            retries + 1,
            existing_disk_bytes,
            range_header
        );

        let req = client
            .get(&url)
            .header(reqwest::header::RANGE, &range_header);

        let res = match req.send().await {
            Ok(r) => r,
            Err(err) => {
                retries += 1;
                eprintln!("[RILO WORKER {}] HTTP send error (Attempt {}/{}): {:?}", part.index, retries, MAX_RETRIES, err);
                if retries > MAX_RETRIES {
                    error_flag.store(true, Ordering::Relaxed);
                    return false;
                }
                let delay = get_backoff_with_jitter(retries);
                sleep(delay).await;
                continue;
            }
        };

        let status = res.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
            retries += 1;
            let delay = get_backoff_with_jitter(retries);
            eprintln!("[RILO WORKER {}] HTTP {} - Backing off for {:?}...", part.index, status, delay);
            if retries > MAX_RETRIES {
                error_flag.store(true, Ordering::Relaxed);
                return false;
            }
            sleep(delay).await;
            continue;
        }

        // For partial segment range requests (index > 0 or start > 0), server MUST return 206 Partial Content.
        // If server returns 200 OK, it ignored Range header and is attempting to send the full file.
        if (part.index > 0 || current_start > 0) && status != reqwest::StatusCode::PARTIAL_CONTENT {
            eprintln!("[RILO WORKER {}] Server ignored Range request (HTTP status: {}). Aborting segment worker.", part.index, status);
            error_flag.store(true, Ordering::Relaxed);
            return false;
        }

        if !status.is_success() && status != reqwest::StatusCode::PARTIAL_CONTENT {
            eprintln!("[RILO WORKER {}] HTTP status failed: {}", part.index, status);
            error_flag.store(true, Ordering::Relaxed);
            return false;
        }

        // Reset retries on successful connection establishment
        retries = 0;

        let mut file = match crate::core::destination::open_append_file(part_file_path, true).await {
            Ok(f) => f,
            Err(err) => {
                eprintln!("[RILO WORKER {}] Failed to open part file {:?}: {:?}", part.index, part_file_path, err);
                error_flag.store(true, Ordering::Relaxed);
                return false;
            }
        };

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        let mut part_completed_normally = false;

        while let Some(chunk_res) = stream.next().await {
            if cancel_token.is_cancelled() || pause_flag.load(Ordering::Relaxed) {
                let _ = file.flush().await;
                eprintln!("[RILO WORKER {}] Paused or cancelled during stream.", part.index);
                return true;
            }

            match chunk_res {
                Ok(chunk) => {
                    let chunk_len = chunk.len() as u64;

                    // Rilo Step 2: Token Bucket Rate Limiting per 8KB payload chunk
                    rate_limiter.acquire(chunk_len).await;

                    if let Err(err) = file.write_all(&chunk).await {
                        eprintln!("[RILO WORKER {}] File write error: {:?}", part.index, err);
                        error_flag.store(true, Ordering::Relaxed);
                        return false;
                    }

                    downloaded_atomic.fetch_add(chunk_len, Ordering::Relaxed);
                }
                Err(err) => {
                    eprintln!("[RILO WORKER {}] Stream error mid-download: {:?}", part.index, err);
                    break;
                }
            }
        }

        let _ = file.flush().await;

        // Check if part file reached expected size
        if let Ok(m) = tokio::fs::metadata(part_file_path).await {
            if m.len() >= part.expected_size() {
                part_completed_normally = true;
            }
        }

        if part_completed_normally {
            eprintln!("[RILO WORKER {}] Segment complete.", part.index);
            return true;
        }

        retries += 1;
        if retries > MAX_RETRIES {
            error_flag.store(true, Ordering::Relaxed);
            return false;
        }
        let delay = get_backoff_with_jitter(retries);
        sleep(delay).await;
    }
}
