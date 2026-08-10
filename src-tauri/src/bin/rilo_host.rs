use downloader_lib::native_host::{
    read_native_message, validate_download_url, write_native_message, NativeMessageResponse, PROTOCOL_VERSION,
};
use serde_json::json;
use std::io::{self, Write as StdWrite};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();

    let mut stdin_lock = stdin.lock();
    let mut stdout_lock = stdout.lock();

    while let Ok(Some(request)) = read_native_message(&mut stdin_lock) {
        match request.msg_type.as_str() {
            "ping" => {
                let mut is_running = check_rilo_running();
                if !is_running {
                    if let Some(rilo_exe) = find_rilo_executable() {
                        let _ = launch_rilo_and_wait(&rilo_exe, 10);
                        is_running = check_rilo_running();
                    }
                }

                let response = NativeMessageResponse {
                    version: PROTOCOL_VERSION,
                    success: is_running,
                    download_id: None,
                    message: if is_running {
                        "Rilo desktop application is active and connected".to_string()
                    } else {
                        "Rilo desktop application is unavailable".to_string()
                    },
                };
                let _ = write_native_message(&mut stdout_lock, &response);
            }
            "download" | "download_request" => {
                let raw_url = request.url.unwrap_or_default();
                match validate_download_url(&raw_url) {
                    Ok(parsed_url) => {
                        let target_url = parsed_url.to_string();
                        let filename = request.filename.clone();
                        let referrer = request.referrer.clone();

                        // 1. Check if Rilo is already running
                        let mut is_running = check_rilo_running();

                        // 2. If Rilo is not running, launch it and wait for IPC server readiness
                        if !is_running {
                            if let Some(rilo_exe) = find_rilo_executable() {
                                if let Err(launch_err) = launch_rilo_and_wait(&rilo_exe, 15) {
                                    let response = NativeMessageResponse {
                                        version: PROTOCOL_VERSION,
                                        success: false,
                                        download_id: None,
                                        message: launch_err,
                                    };
                                    let _ = write_native_message(&mut stdout_lock, &response);
                                    continue;
                                }
                                is_running = check_rilo_running();
                            } else {
                                let response = NativeMessageResponse {
                                    version: PROTOCOL_VERSION,
                                    success: false,
                                    download_id: None,
                                    message: "Rilo executable not found on host system".to_string(),
                                };
                                let _ = write_native_message(&mut stdout_lock, &response);
                                continue;
                            }
                        }

                        // 3. Forward request to Rilo IPC server
                        if is_running && send_to_rilo_server(&target_url, filename.as_deref(), referrer.as_deref()) {
                            let download_id = format!("dl_{}_ext", chrono_timestamp());
                            let response = NativeMessageResponse {
                                version: PROTOCOL_VERSION,
                                success: true,
                                download_id: Some(download_id),
                                message: format!("Download request accepted for {}", target_url),
                            };
                            let _ = write_native_message(&mut stdout_lock, &response);
                        } else {
                            let response = NativeMessageResponse {
                                version: PROTOCOL_VERSION,
                                success: false,
                                download_id: None,
                                message: "Failed forwarding download request to Rilo IPC server".to_string(),
                            };
                            let _ = write_native_message(&mut stdout_lock, &response);
                        }
                    }
                    Err(err_msg) => {
                        let response = NativeMessageResponse {
                            version: PROTOCOL_VERSION,
                            success: false,
                            download_id: None,
                            message: err_msg,
                        };
                        let _ = write_native_message(&mut stdout_lock, &response);
                    }
                }
            }
            _ => {
                let response = NativeMessageResponse {
                    version: PROTOCOL_VERSION,
                    success: false,
                    download_id: None,
                    message: format!("Unknown native message type: '{}'", request.msg_type),
                };
                let _ = write_native_message(&mut stdout_lock, &response);
            }
        }
    }
}

fn check_rilo_running() -> bool {
    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:7899") {
        let req = "GET /health HTTP/1.1\r\nHost: 127.0.0.1:7899\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(req.as_bytes());
        return true;
    }
    false
}

fn send_to_rilo_server(url: &str, filename: Option<&str>, referrer: Option<&str>) -> bool {
    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:7899") {
        let payload = json!({
            "url": url,
            "filename": filename,
            "referrer": referrer,
        });

        let json_body = payload.to_string();
        let http_req = format!(
            "POST /api/download HTTP/1.1\r\nHost: 127.0.0.1:7899\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            json_body.len(),
            json_body
        );

        if stream.write_all(http_req.as_bytes()).is_ok() {
            return true;
        }
    }
    false
}

fn find_rilo_executable() -> Option<PathBuf> {
    // 1. Check APPDATA marker file created by Rilo desktop app
    if let Ok(appdata) = std::env::var("APPDATA") {
        let marker = PathBuf::from(appdata).join("Rilo").join("rilo_exe_path.txt");
        if marker.exists() {
            if let Ok(content) = std::fs::read_to_string(&marker) {
                let path = PathBuf::from(content.trim());
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    // 2. Check directory where rilo-host.exe resides
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let candidate_downloader = parent.join("downloader.exe");
            if candidate_downloader.exists() {
                return Some(candidate_downloader);
            }
            let candidate_rilo = parent.join("rilo.exe");
            if candidate_rilo.exists() {
                return Some(candidate_rilo);
            }
        }
    }

    // 3. Check current working directory
    let cwd_downloader = PathBuf::from("downloader.exe");
    if cwd_downloader.exists() {
        return Some(cwd_downloader.canonicalize().unwrap_or(cwd_downloader));
    }

    None
}

fn launch_rilo_and_wait(rilo_exe: &Path, max_wait_secs: u64) -> Result<(), String> {
    // Atomic file lock to serialize process startup across concurrent native host invocations
    let lock_dir = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = std::fs::create_dir_all(lock_dir.join("Rilo"));
    let lock_file_path = lock_dir.join("Rilo").join("rilo_launch.lock");

    let _lock_file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .open(&lock_file_path);

    // Double check if Rilo started while acquiring lock
    if check_rilo_running() {
        return Ok(());
    }

    if !rilo_exe.exists() {
        return Err(format!("Rilo executable not found at path: {}", rilo_exe.display()));
    }

    // Launch process natively without shell wrapping (handles spaces in path safely)
    std::process::Command::new(rilo_exe)
        .spawn()
        .map_err(|e| format!("Failed to start Rilo application: {}", e))?;

    // Wait for server endpoint to become ready
    let start_time = Instant::now();
    let timeout = Duration::from_secs(max_wait_secs);

    while start_time.elapsed() < timeout {
        if check_rilo_running() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    Err(format!("Rilo startup timed out after {} seconds", max_wait_secs))
}

fn chrono_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
