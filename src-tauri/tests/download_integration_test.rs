use dlman_core::DlmanCore;
use dlman_types::DownloadStatus;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

/// Helper HTTP server for download integration tests
struct TestHttpServer {
    pub addr: String,
    pub payload_small: Vec<u8>,
    pub payload_large: Vec<u8>,
    pub fail_count: Arc<AtomicUsize>,
}

impl TestHttpServer {
    pub async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = format!("http://{}", listener.local_addr().unwrap());

        let mut payload_small = vec![0u8; 256 * 1024]; // 256 KB
        for (i, byte) in payload_small.iter_mut().enumerate() {
            *byte = (i % 251) as u8;
        }

        let mut payload_large = vec![0u8; 3 * 1024 * 1024]; // 3 MB
        for (i, byte) in payload_large.iter_mut().enumerate() {
            *byte = (i % 241) as u8;
        }

        let fail_count = Arc::new(AtomicUsize::new(0));

        let payload_small_clone = payload_small.clone();
        let payload_large_clone = payload_large.clone();
        let fail_count_clone = fail_count.clone();

        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    break;
                };
                let small = payload_small_clone.clone();
                let large = payload_large_clone.clone();
                let fail_cnt = fail_count_clone.clone();

                tokio::spawn(async move {
                    let mut buf = [0u8; 4096];
                    let Ok(n) = socket.read(&mut buf).await else {
                        return;
                    };
                    if n == 0 {
                        return;
                    }
                    let req_str = String::from_utf8_lossy(&buf[..n]);

                    let lines: Vec<&str> = req_str.lines().collect();
                    if lines.is_empty() {
                        return;
                    }
                    let first_line = lines[0];
                    let parts: Vec<&str> = first_line.split_whitespace().collect();
                    if parts.len() < 2 {
                        return;
                    }
                    let method = parts[0];
                    let path = parts[1];

                    // Extract Range header if present
                    let mut range_header = None;
                    for line in &lines {
                        if line.to_lowercase().starts_with("range:") {
                            range_header = Some(line[6..].trim().to_string());
                        }
                    }

                    if path.starts_with("/404") {
                        let res = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                        let _ = socket.write_all(res.as_bytes()).await;
                        return;
                    }

                    if path.starts_with("/rate_limit") {
                        let count = fail_cnt.fetch_add(1, Ordering::SeqCst);
                        if count < 2 {
                            let res = "HTTP/1.1 429 Too Many Requests\r\nRetry-After: 1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                            let _ = socket.write_all(res.as_bytes()).await;
                            return;
                        }
                    }

                    if path.starts_with("/fail_once") {
                        let count = fail_cnt.fetch_add(1, Ordering::SeqCst);
                        if count == 0 {
                            let res = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                            let _ = socket.write_all(res.as_bytes()).await;
                            return;
                        }
                    }

                    let (target_payload, is_norange) = if path.starts_with("/norange") {
                        (&small, true)
                    } else if path.starts_with("/large") {
                        (&large, false)
                    } else {
                        (&small, false)
                    };

                    let total_len = target_payload.len();

                    if is_norange {
                        if method == "HEAD" {
                            let res = format!(
                                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nAccept-Ranges: none\r\nConnection: close\r\n\r\n",
                                total_len
                            );
                            let _ = socket.write_all(res.as_bytes()).await;
                        } else {
                            let header = format!(
                                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nAccept-Ranges: none\r\nConnection: close\r\n\r\n",
                                total_len
                            );
                            let _ = socket.write_all(header.as_bytes()).await;
                            let _ = socket.write_all(target_payload).await;
                        }
                        return;
                    }

                    if method == "HEAD" {
                        let cd_header = if path.starts_with("/cd_test") {
                            "Content-Disposition: attachment; filename=\"authoritative_archive.rar\"\r\n"
                        } else {
                            ""
                        };
                        let res = format!(
                            "HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\nAccept-Ranges: bytes\r\nConnection: close\r\n\r\n",
                            cd_header, total_len
                        );
                        let _ = socket.write_all(res.as_bytes()).await;
                        return;
                    }

                    if let Some(ref range) = range_header {
                        if let Some(spec) = range.strip_prefix("bytes=") {
                            let range_parts: Vec<&str> = spec.split('-').collect();
                            let start: usize = range_parts[0].parse().unwrap_or(0);
                            let end: usize = if range_parts.len() > 1 && !range_parts[1].is_empty() {
                                range_parts[1].parse().unwrap_or(total_len - 1)
                            } else {
                                total_len - 1
                            };

                            let end = end.min(total_len - 1);
                            if start <= end {
                                let chunk = &target_payload[start..=end];
                                let header = format!(
                                    "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {}-{}/{}\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\nConnection: close\r\n\r\n",
                                    start, end, total_len, chunk.len()
                                );
                                let _ = socket.write_all(header.as_bytes()).await;
                                let _ = socket.write_all(chunk).await;
                                return;
                            }
                        }
                    }

                    let header = format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\nConnection: close\r\n\r\n",
                        total_len
                    );
                    let _ = socket.write_all(header.as_bytes()).await;
                    let _ = socket.write_all(target_payload).await;
                });
            }
        });

        Self {
            addr,
            payload_small,
            payload_large,
            fail_count,
        }
    }
}

async fn wait_for_status(core: &DlmanCore, id: Uuid, expected: DownloadStatus, timeout_secs: u64) -> bool {
    let start = std::time::Instant::now();
    while start.elapsed().as_secs() < timeout_secs {
        if let Ok(dl) = core.get_download(id).await {
            if dl.status == expected {
                return true;
            }
        }
        sleep(Duration::from_millis(100)).await;
    }
    false
}

#[tokio::test]
async fn test_normal_single_download_and_bytes_match() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/single.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core
        .add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true)
        .await
        .unwrap();

    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 15).await;
    assert!(completed, "Download failed to complete within timeout");

    let final_record = core.get_download(download.id).await.unwrap();
    let output_file = dest_dir.join(&final_record.filename);
    assert!(output_file.exists(), "Downloaded file does not exist on disk");

    let downloaded_bytes = std::fs::read(&output_file).unwrap();
    assert_eq!(
        downloaded_bytes.len(),
        server.payload_small.len(),
        "Downloaded byte length mismatch"
    );
    assert_eq!(
        downloaded_bytes, server.payload_small,
        "Downloaded byte content mismatch"
    );
}

#[tokio::test]
async fn test_no_range_support_single_stream_download() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/norange.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_norange");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core
        .add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true)
        .await
        .unwrap();

    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 15).await;
    assert!(completed, "No-range download failed to complete");

    let final_record = core.get_download(download.id).await.unwrap();
    let output_file = dest_dir.join(&final_record.filename);
    let downloaded_bytes = std::fs::read(&output_file).unwrap();
    assert_eq!(downloaded_bytes, server.payload_small);
}

#[tokio::test]
async fn test_multi_segment_download_and_bytes_match() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/large.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_large");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core
        .add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true)
        .await
        .unwrap();

    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 20).await;
    assert!(completed, "Multi-segment download failed to complete");

    let final_record = core.get_download(download.id).await.unwrap();
    let output_file = dest_dir.join(&final_record.filename);
    let downloaded_bytes = std::fs::read(&output_file).unwrap();

    assert_eq!(
        downloaded_bytes.len(),
        server.payload_large.len(),
        "Large file size mismatch"
    );
    assert_eq!(
        downloaded_bytes, server.payload_large,
        "Large file content mismatch"
    );
}

#[tokio::test]
async fn test_multiple_simultaneous_downloads() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let dest_dir = temp_dir.path().join("dest_simultaneous");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let url1 = format!("{}/single.bin?id=1", server.addr);
    let url2 = format!("{}/single.bin?id=2", server.addr);
    let url3 = format!("{}/single.bin?id=3", server.addr);

    let d1 = core.add_download(&url1, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let d2 = core.add_download(&url2, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let d3 = core.add_download(&url3, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();

    let c1 = wait_for_status(&core, d1.id, DownloadStatus::Completed, 15).await;
    let c2 = wait_for_status(&core, d2.id, DownloadStatus::Completed, 15).await;
    let c3 = wait_for_status(&core, d3.id, DownloadStatus::Completed, 15).await;

    assert!(c1 && c2 && c3, "Not all simultaneous downloads completed");

    let f1 = std::fs::read(dest_dir.join(core.get_download(d1.id).await.unwrap().filename)).unwrap();
    let f2 = std::fs::read(dest_dir.join(core.get_download(d2.id).await.unwrap().filename)).unwrap();
    let f3 = std::fs::read(dest_dir.join(core.get_download(d3.id).await.unwrap().filename)).unwrap();

    assert_eq!(f1, server.payload_small);
    assert_eq!(f2, server.payload_small);
    assert_eq!(f3, server.payload_small);
}

#[tokio::test]
async fn test_pause_and_resume_download() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/large.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_pause");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    
    sleep(Duration::from_millis(50)).await;
    let _ = core.pause_download(download.id).await;

    let paused = wait_for_status(&core, download.id, DownloadStatus::Paused, 5).await;
    assert!(paused, "Download failed to pause");

    let _ = core.resume_download(download.id).await;
    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 15).await;
    assert!(completed, "Resumed download failed to complete");

    let output_file = dest_dir.join(core.get_download(download.id).await.unwrap().filename);
    let downloaded_bytes = std::fs::read(&output_file).unwrap();
    assert_eq!(downloaded_bytes, server.payload_large);
}

#[tokio::test]
async fn test_cancel_download() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/large.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_cancel");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let _ = core.cancel_download(download.id).await;

    let cancelled = wait_for_status(&core, download.id, DownloadStatus::Cancelled, 5).await;
    assert!(cancelled, "Download failed to cancel");
}

#[tokio::test]
async fn test_retry_transient_failure() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/fail_once.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_retry");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 15).await;
    assert!(completed, "Download with retry failed to complete");

    let output_file = dest_dir.join(core.get_download(download.id).await.unwrap().filename);
    let downloaded_bytes = std::fs::read(&output_file).unwrap();
    assert_eq!(downloaded_bytes, server.payload_small);
}

#[tokio::test]
async fn test_http_404_failure() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/404.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_404");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let failed = wait_for_status(&core, download.id, DownloadStatus::Failed, 10).await;
    assert!(failed, "404 download did not transition to Failed");
}

#[tokio::test]
async fn test_fresh_database_initialization_succeeds() {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("fresh_downloads.db");
    
    let db = dlman_core::DownloadDatabase::new(&db_path).await;
    assert!(db.is_ok(), "Fresh database initialization failed: {:?}", db.err());
}

#[tokio::test]
async fn test_legacy_rilo_database_migration_succeeds() {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("legacy_downloads.db");

    // Construct legacy SQLite schema matching old Rilo
    let options = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);
    let pool = sqlx::SqlitePool::connect_with(options).await.unwrap();

    sqlx::query(
        r#"
        CREATE TABLE downloads (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            redirect_url TEXT NOT NULL DEFAULT '',
            save_path TEXT NOT NULL,
            total_bytes INTEGER NOT NULL DEFAULT 0,
            downloaded_bytes INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT '',
            completed_at TEXT NOT NULL DEFAULT '',
            threads INTEGER NOT NULL DEFAULT 4,
            etag TEXT NOT NULL DEFAULT '',
            last_modified TEXT NOT NULL DEFAULT '',
            mime_type TEXT NOT NULL DEFAULT '',
            accept_ranges TEXT NOT NULL DEFAULT '',
            resumable INTEGER NOT NULL DEFAULT 1,
            retry_count INTEGER NOT NULL DEFAULT 0,
            auto_extract INTEGER NOT NULL DEFAULT 0,
            extract_dir TEXT NOT NULL DEFAULT '',
            delete_archive_after_extract INTEGER NOT NULL DEFAULT 0,
            extraction_state TEXT NOT NULL DEFAULT 'Pending',
            speed_limit_kbps INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT INTO downloads (id, filename, url, save_path, total_bytes, downloaded_bytes, status, created_at)
        VALUES ('11111111-1111-1111-1111-111111111111', 'test.zip', 'https://example.com/test.zip', '/downloads/test.zip', 1000, 500, 'Completed', '2026-08-01T00:00:00Z');

        INSERT INTO settings (key, value) VALUES ('theme', 'rilo-default');
        "#,
    )
    .execute(&pool)
    .await
    .unwrap();
    pool.close().await;

    // Run DLMan database initialization on legacy DB
    let db = dlman_core::DownloadDatabase::new(&db_path).await.expect("Legacy migration failed");

    // Verify queue_id exists and legacy download was migrated
    let loaded = db.load_download(uuid::Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()).await.unwrap();
    assert!(loaded.is_some(), "Legacy download was lost during migration");

    let download = loaded.unwrap();
    assert_eq!(download.filename, "test.zip");
    assert_eq!(download.size, Some(1000));
    assert_eq!(download.queue_id, uuid::Uuid::nil());

    // Verify key-value setting was migrated to kv_settings
    let setting = db.get_setting("theme").await.unwrap();
    assert_eq!(setting, Some("rilo-default".to_string()));
}

#[tokio::test]
async fn test_download_manager_startup_runtime_initialization_succeeds() {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_mgr.db");
    let config_path = temp_dir.path().join("config.json");
    let data_dir = temp_dir.path().to_path_buf();

    let db = downloader_lib::db::Database::init(&db_path).await.unwrap();
    let config = downloader_lib::config::AppConfig::default();

    let manager = downloader_lib::download::manager::DownloadManager::new(
        db,
        config,
        config_path,
        data_dir,
    )
    .await;

    let all = manager.core.get_all_downloads().await;
    assert!(all.is_ok(), "Failed getting all downloads from initialized DlmanCore");
}

#[tokio::test]
async fn test_download_manager_start_download_end_to_end() {
    let server = TestHttpServer::start().await;
    let expected_data = server.payload_small.clone();

    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_mgr_e2e.db");
    let config_path = temp_dir.path().join("config.json");
    let data_dir = temp_dir.path().to_path_buf();
    let save_dir = temp_dir.path().join("downloads");
    std::fs::create_dir_all(&save_dir).unwrap();

    let db = downloader_lib::db::Database::init(&db_path).await.unwrap();
    let config = downloader_lib::config::AppConfig::default();

    let manager = downloader_lib::download::manager::DownloadManager::new(
        db,
        config,
        config_path,
        data_dir,
    )
    .await;

    let record = manager
        .start_download(
            None,
            format!("{}/small.bin", server.addr),
            Some(save_dir.to_string_lossy().to_string()),
            None,
            Some(4),
            false,
        )
        .await
        .unwrap();

    assert_ne!(record.id, "");

    let download_id = uuid::Uuid::parse_str(&record.id).unwrap();
    let mut completed = false;
    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if let Ok(dl) = manager.core.get_download(download_id).await {
            if dl.status == dlman_types::DownloadStatus::Completed {
                completed = true;
                break;
            }
        }
    }

    assert!(completed, "Download did not complete in time");

    let downloaded_file = save_dir.join(&record.filename);
    assert!(downloaded_file.exists(), "Downloaded file missing");
    let contents = std::fs::read(&downloaded_file).unwrap();
    assert_eq!(contents.len(), expected_data.len());
    assert_eq!(contents, expected_data);
}

#[tokio::test]
async fn test_real_external_download_hetzner() {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_hetzner.db");
    let config_path = temp_dir.path().join("config.json");
    let data_dir = temp_dir.path().to_path_buf();
    let save_dir = temp_dir.path().join("downloads");
    std::fs::create_dir_all(&save_dir).unwrap();

    let db = downloader_lib::db::Database::init(&db_path).await.unwrap();
    let config = downloader_lib::config::AppConfig::default();

    let manager = downloader_lib::download::manager::DownloadManager::new(
        db,
        config,
        config_path,
        data_dir,
    )
    .await;

    let record = manager
        .start_download(
            None,
            "https://ash-speed.hetzner.com/100MB.bin".to_string(),
            Some(save_dir.to_string_lossy().to_string()),
            None,
            Some(4),
            false,
        )
        .await;

    assert!(record.is_ok(), "Failed starting download: {:?}", record.err());
    let record = record.unwrap();

    let download_id = uuid::Uuid::parse_str(&record.id).unwrap();
    let mut bytes_downloaded = 0u64;
    for _ in 0..100 {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        if let Ok(dl) = manager.core.get_download(download_id).await {
            bytes_downloaded = dl.downloaded;
            if dl.downloaded > 0 {
                // Successfully started receiving bytes from Hetzner!
                break;
            }
        }
    }

    assert!(bytes_downloaded > 0, "Failed to download actual bytes from Hetzner (0 B downloaded)");
}

#[tokio::test]
async fn test_requested_segment_counts_8_and_16() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_seg_counts.db");
    let config_path = temp_dir.path().join("config.json");
    let data_dir = temp_dir.path().to_path_buf();
    let save_dir = temp_dir.path().join("downloads");
    std::fs::create_dir_all(&save_dir).unwrap();

    let db = downloader_lib::db::Database::init(&db_path).await.unwrap();
    let config = downloader_lib::config::AppConfig::default();
    let manager = downloader_lib::download::manager::DownloadManager::new(db, config, config_path, data_dir).await;

    // Test 8 segments
    let rec8 = manager
        .start_download(
            None,
            format!("{}/large.bin", server.addr),
            Some(save_dir.to_string_lossy().to_string()),
            None,
            Some(8),
            false,
        )
        .await
        .unwrap();

    let id8 = uuid::Uuid::parse_str(&rec8.id).unwrap();
    let mut dl8_segments = 0;
    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if let Ok(dl) = manager.core.get_download(id8).await {
            if !dl.segments.is_empty() {
                dl8_segments = dl.segments.len();
                break;
            }
        }
    }
    assert_eq!(dl8_segments, 8, "Expected 8 segments for requested 8 connections");

    // Test 16 segments
    let rec16 = manager
        .start_download(
            None,
            format!("{}/large.bin?t=16", server.addr),
            Some(save_dir.to_string_lossy().to_string()),
            None,
            Some(16),
            false,
        )
        .await
        .unwrap();

    let id16 = uuid::Uuid::parse_str(&rec16.id).unwrap();
    let mut dl16_segments = 0;
    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if let Ok(dl) = manager.core.get_download(id16).await {
            if !dl.segments.is_empty() {
                dl16_segments = dl.segments.len();
                break;
            }
        }
    }
    assert_eq!(dl16_segments, 16, "Expected 16 segments for requested 16 connections");
}

#[tokio::test]
async fn test_three_concurrent_downloads_and_failure_isolation() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_3_dl.db");
    let config_path = temp_dir.path().join("config.json");
    let data_dir = temp_dir.path().to_path_buf();
    let save_dir = temp_dir.path().join("downloads");
    std::fs::create_dir_all(&save_dir).unwrap();

    let db = downloader_lib::db::Database::init(&db_path).await.unwrap();
    let config = downloader_lib::config::AppConfig::default();
    let manager = downloader_lib::download::manager::DownloadManager::new(db, config, config_path, data_dir).await;

    // Start 3 downloads simultaneously: 2 valid, 1 invalid (404)
    let rec1 = manager.start_download(None, format!("{}/small.bin?dl=1", server.addr), Some(save_dir.to_string_lossy().to_string()), None, Some(4), false).await.unwrap();
    let rec2 = manager.start_download(None, format!("{}/small.bin?dl=2", server.addr), Some(save_dir.to_string_lossy().to_string()), None, Some(4), false).await.unwrap();
    let rec_fail = manager.start_download(None, format!("{}/404.bin", server.addr), Some(save_dir.to_string_lossy().to_string()), None, Some(4), false).await.unwrap();

    let id1 = uuid::Uuid::parse_str(&rec1.id).unwrap();
    let id2 = uuid::Uuid::parse_str(&rec2.id).unwrap();
    let id_fail = uuid::Uuid::parse_str(&rec_fail.id).unwrap();

    let mut comp1 = false;
    let mut comp2 = false;
    let mut fail_ok = false;
    for _ in 0..60 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        if let Ok(dl) = manager.core.get_download(id1).await {
            if dl.status == dlman_types::DownloadStatus::Completed { comp1 = true; }
        }
        if let Ok(dl) = manager.core.get_download(id2).await {
            if dl.status == dlman_types::DownloadStatus::Completed { comp2 = true; }
        }
        if let Ok(dl) = manager.core.get_download(id_fail).await {
            if dl.status == dlman_types::DownloadStatus::Failed { fail_ok = true; }
        }
        if comp1 && comp2 && fail_ok { break; }
    }

    assert!(comp1, "Download 1 failed to complete concurrently");
    assert!(comp2, "Download 2 failed to complete concurrently");
    assert!(fail_ok, "Failed download did not transition to Failed status");
}

#[tokio::test]
async fn test_429_rate_limit_probe_retry_and_success() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/rate_limit.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_429");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 20).await;
    assert!(completed, "Download with 429 rate limit retry failed to complete");

    let output_file = dest_dir.join(core.get_download(download.id).await.unwrap().filename);
    let downloaded_bytes = std::fs::read(&output_file).unwrap();
    assert_eq!(downloaded_bytes, server.payload_small);
}

#[tokio::test]
async fn test_sha256_hash_verification() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/large.bin", server.addr);
    let dest_dir = temp_dir.path().join("dest_hash");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 15).await;
    assert!(completed, "Download for hash verification failed");

    let output_file = dest_dir.join(core.get_download(download.id).await.unwrap().filename);
    let downloaded_bytes = std::fs::read(&output_file).unwrap();

    assert_eq!(downloaded_bytes.len(), server.payload_large.len(), "Payload length mismatch");
    assert_eq!(downloaded_bytes, server.payload_large, "Downloaded payload bytes do not match original source");
}

#[tokio::test]
async fn test_content_disposition_filename_resolution() {
    let server = TestHttpServer::start().await;
    let temp_dir = tempfile::tempdir().unwrap();
    let data_dir = temp_dir.path().to_path_buf();
    let core = DlmanCore::new(data_dir.clone()).await.unwrap();

    let url = format!("{}/cd_test/opaque_id_12345", server.addr);
    let dest_dir = temp_dir.path().join("dest_cd");
    tokio::fs::create_dir_all(&dest_dir).await.unwrap();

    let download = core.add_download(&url, dest_dir.clone(), Uuid::nil(), None, None, true).await.unwrap();
    let completed = wait_for_status(&core, download.id, DownloadStatus::Completed, 15).await;
    assert!(completed, "Download for Content-Disposition resolution failed");

    let updated_dl = core.get_download(download.id).await.unwrap();
    assert_eq!(updated_dl.filename, "authoritative_archive.rar", "Filename was not updated from Content-Disposition header");

    let output_file = dest_dir.join(&updated_dl.filename);
    assert!(output_file.exists(), "Final file with resolved filename does not exist");
}
