use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub const NATIVE_HOST_NAME: &str = "com.rilo.downloader";
pub const PROTOCOL_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeMessageRequest {
    pub version: Option<u32>,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub url: Option<String>,
    pub filename: Option<String>,
    pub referrer: Option<String>,
    pub page_url: Option<String>,
    pub num_connections: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeMessageResponse {
    pub version: u32,
    pub success: bool,
    pub download_id: Option<String>,
    pub message: String,
}

pub fn read_native_message<R: Read>(mut reader: R) -> io::Result<Option<NativeMessageRequest>> {
    let mut length_bytes = [0u8; 4];
    match reader.read_exact(&mut length_bytes) {
        Ok(_) => {}
        Err(ref e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }

    let length = u32::from_ne_bytes(length_bytes) as usize;
    if length == 0 || length > 1024 * 1024 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Native message length out of safe bounds (0..1MB)",
        ));
    }

    let mut buffer = vec![0u8; length];
    reader.read_exact(&mut buffer)?;

    let request: NativeMessageRequest = serde_json::from_slice(&buffer)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    Ok(Some(request))
}

pub fn write_native_message<W: Write>(mut writer: W, response: &NativeMessageResponse) -> io::Result<()> {
    let json_bytes = serde_json::to_vec(response)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    let length = json_bytes.len() as u32;
    writer.write_all(&length.to_ne_bytes())?;
    writer.write_all(&json_bytes)?;
    writer.flush()?;

    Ok(())
}

pub fn validate_download_url(url_str: &str) -> Result<reqwest::Url, String> {
    let trimmed = url_str.trim();
    if trimmed.is_empty() {
        return Err("Download URL cannot be empty".to_string());
    }

    let url = reqwest::Url::parse(trimmed).map_err(|e| format!("Invalid URL: {}", e))?;
    let scheme = url.scheme().to_lowercase();
    if scheme != "http" && scheme != "https" {
        return Err(format!("Unsupported URL scheme: '{}'. Only HTTP/HTTPS are supported.", scheme));
    }
    Ok(url)
}

pub fn run_native_host() {
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

                        let mut is_running = check_rilo_running();

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

pub fn check_rilo_running() -> bool {
    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:7899") {
        let req = "GET /health HTTP/1.1\r\nHost: 127.0.0.1:7899\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(req.as_bytes());
        return true;
    }
    false
}

pub fn send_to_rilo_server(url: &str, filename: Option<&str>, referrer: Option<&str>) -> bool {
    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:7899") {
        let payload = serde_json::json!({
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

pub fn find_rilo_executable() -> Option<PathBuf> {
    if let Ok(current_exe) = std::env::current_exe() {
        if current_exe.exists() {
            return Some(current_exe);
        }
    }

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

    let cwd_downloader = PathBuf::from("downloader.exe");
    if cwd_downloader.exists() {
        return Some(cwd_downloader.canonicalize().unwrap_or(cwd_downloader));
    }

    let cwd_rilo = PathBuf::from("rilo.exe");
    if cwd_rilo.exists() {
        return Some(cwd_rilo.canonicalize().unwrap_or(cwd_rilo));
    }

    None
}

pub fn launch_rilo_and_wait(rilo_exe: &Path, max_wait_secs: u64) -> Result<(), String> {
    let lock_dir = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = std::fs::create_dir_all(lock_dir.join("Rilo"));
    let lock_file_path = lock_dir.join("Rilo").join("rilo_launch.lock");

    let _lock_file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .open(&lock_file_path);

    if check_rilo_running() {
        return Ok(());
    }

    if !rilo_exe.exists() {
        return Err(format!("Rilo executable not found at path: {}", rilo_exe.display()));
    }

    std::process::Command::new(rilo_exe)
        .spawn()
        .map_err(|e| format!("Failed to start Rilo application: {}", e))?;

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

/// Dynamically registers Chrome & Firefox Native Messaging Host JSON manifests in Windows Registry (%APPDATA%\Rilo\native-host\)
#[cfg(target_os = "windows")]
pub fn register_production_native_host(app_data_dir: &Path) {
    use std::fs;
    use std::process::Command;

    let host_dir = app_data_dir.join("native-host");
    let _ = fs::create_dir_all(&host_dir);

    let current_exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let current_exe_str = current_exe.to_string_lossy().replace('\\', "\\\\");

    let exe_marker_path = app_data_dir.join("rilo_exe_path.txt");
    let _ = fs::write(&exe_marker_path, current_exe.to_string_lossy().as_bytes());

    let chrome_manifest_path = host_dir.join("com.rilo.downloader.chrome.json");
    let chrome_json = serde_json::json!({
        "name": NATIVE_HOST_NAME,
        "description": "Rilo Native Messaging Host for Chrome",
        "path": current_exe_str,
        "type": "stdio",
        "allowed_origins": ["chrome-extension://*/"]
    });
    let _ = fs::write(&chrome_manifest_path, chrome_json.to_string());

    let firefox_manifest_path = host_dir.join("com.rilo.downloader.firefox.json");
    let firefox_json = serde_json::json!({
        "name": NATIVE_HOST_NAME,
        "description": "Rilo Native Messaging Host for Firefox",
        "path": current_exe_str,
        "type": "stdio",
        "allowed_extensions": ["rilo-extension@rilo.com"]
    });
    let _ = fs::write(&firefox_manifest_path, firefox_json.to_string());

    let _ = Command::new("reg")
        .args([
            "add",
            &format!("HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\{}", NATIVE_HOST_NAME),
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            &chrome_manifest_path.to_string_lossy(),
            "/f",
        ])
        .output();

    let _ = Command::new("reg")
        .args([
            "add",
            &format!("HKCU\\Software\\Mozilla\\NativeMessagingHosts\\{}", NATIVE_HOST_NAME),
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            &firefox_manifest_path.to_string_lossy(),
            "/f",
        ])
        .output();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_native_message_serialization_roundtrip() {
        let _req = NativeMessageRequest {
            version: Some(1),
            msg_type: "download_request".to_string(),
            url: Some("https://example.com/archive.zip".to_string()),
            filename: Some("archive.zip".to_string()),
            referrer: Some("https://example.com/".to_string()),
            page_url: Some("https://example.com/downloads".to_string()),
            num_connections: Some(8),
        };

        let res = NativeMessageResponse {
            version: PROTOCOL_VERSION,
            success: true,
            download_id: Some("dl_12345".to_string()),
            message: "Download queued in Rilo".to_string(),
        };

        let mut buf = Vec::new();
        write_native_message(&mut buf, &res).expect("Write failed");

        let mut cursor = std::io::Cursor::new(buf);
        let mut length_bytes = [0u8; 4];
        cursor.read_exact(&mut length_bytes).unwrap();
        let len = u32::from_ne_bytes(length_bytes) as usize;

        let mut payload = vec![0u8; len];
        cursor.read_exact(&mut payload).unwrap();
        let decoded: NativeMessageResponse = serde_json::from_slice(&payload).unwrap();

        assert_eq!(decoded.version, 1);
        assert!(decoded.success);
        assert_eq!(decoded.download_id, Some("dl_12345".to_string()));
    }

    #[test]
    fn test_url_security_validation() {
        assert!(validate_download_url("https://example.com/file.zip").is_ok());
        assert!(validate_download_url("http://example.com/file.zip").is_ok());
        assert!(validate_download_url("javascript:alert(1)").is_err());
        assert!(validate_download_url("file:///C:/Windows/System32/calc.exe").is_err());
        assert!(validate_download_url("data:text/html,hack").is_err());
    }
}
