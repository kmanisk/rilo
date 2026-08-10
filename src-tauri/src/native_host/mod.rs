use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use std::path::Path;

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
    let exe_dir = current_exe.parent().unwrap_or(app_data_dir);
    let rilo_host_exe = exe_dir.join("rilo-host.exe");

    let rilo_host_str = rilo_host_exe.to_string_lossy().replace('\\', "\\\\");

    let exe_marker_path = app_data_dir.join("rilo_exe_path.txt");
    let _ = fs::write(&exe_marker_path, current_exe.to_string_lossy().as_bytes());

    let chrome_manifest_path = host_dir.join("com.rilo.downloader.chrome.json");
    let chrome_json = serde_json::json!({
        "name": NATIVE_HOST_NAME,
        "description": "Rilo Native Messaging Host for Chrome",
        "path": rilo_host_str,
        "type": "stdio",
        "allowed_origins": ["chrome-extension://*/"]
    });
    let _ = fs::write(&chrome_manifest_path, chrome_json.to_string());

    let firefox_manifest_path = host_dir.join("com.rilo.downloader.firefox.json");
    let firefox_json = serde_json::json!({
        "name": NATIVE_HOST_NAME,
        "description": "Rilo Native Messaging Host for Firefox",
        "path": rilo_host_str,
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
