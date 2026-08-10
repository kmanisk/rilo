use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionDownloadPayload {
    pub url: String,
    pub filename: Option<String>,
    pub referrer: Option<String>,
}

/// Local Extension Server listening on 127.0.0.1:7899
/// Receives download links from Chrome/Firefox/Edge browser extensions
/// and emits 'extension-download' events to the Preact UI.
pub fn start_browser_extension_server(app: AppHandle, port: u16) {
    tauri::async_runtime::spawn(async move {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let listener = match TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(err) => {
                eprintln!("[EXTENSION SERVER] Failed to bind to 127.0.0.1:{}: {:?}", port, err);
                return;
            }
        };

        eprintln!("[EXTENSION SERVER] Listening on http://127.0.0.1:{}", port);

        loop {
            let (mut socket, _) = match listener.accept().await {
                Ok(conn) => conn,
                Err(_) => continue,
            };

            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let mut buffer = [0u8; 4096];
                let bytes_read = match socket.read(&mut buffer).await {
                    Ok(n) if n > 0 => n,
                    _ => return,
                };

                let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                // Handle CORS Options preflight request
                if request.starts_with("OPTIONS") {
                    let response = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n";
                    let _ = socket.write_all(response.as_bytes()).await;
                    return;
                }

                // Handle GET /health and /api/ping check
                if request.starts_with("GET /health") || request.starts_with("GET /api/ping") {
                    let body = r#"{"status":"ok","app":"Downloader"}"#;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = socket.write_all(response.as_bytes()).await;
                    return;
                }

                // Handle POST /api/download from browser extension
                if request.starts_with("POST /api/download") || request.starts_with("POST /download") {
                    if let Some(body_idx) = request.find("\r\n\r\n") {
                        let json_str = &request[body_idx + 4..];
                        if let Ok(payload) = serde_json::from_str::<ExtensionDownloadPayload>(json_str.trim()) {
                            eprintln!("[EXTENSION SERVER] Received download link: {}", payload.url);
                            let _ = app_handle.emit("extension-download", payload);
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }

                    let body = r#"{"success":true}"#;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = socket.write_all(response.as_bytes()).await;
                    return;
                }

                // Default 404 response
                let body = r#"{"error":"Not Found"}"#;
                let response = format!(
                    "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(response.as_bytes()).await;
            });
        }
    });
}
