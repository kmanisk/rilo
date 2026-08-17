use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRecord {
    pub id: String,
    pub filename: String,
    pub url: String,
    pub redirect_url: String,
    pub save_path: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: String,
    pub threads: u32,
    pub etag: String,
    pub last_modified: String,
    pub mime_type: String,
    pub accept_ranges: String,
    pub resumable: bool,
    pub retry_count: u32,
    pub auto_extract: bool,
    pub extract_dir: String,
    pub delete_archive_after_extract: bool,
    pub extraction_state: String,
    pub speed_limit_kbps: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub download_id: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub status: String,
    pub error_message: Option<String>,
    pub filename: String,
    pub save_path: String,
    pub speed_bps: u64,
    pub eta_seconds: Option<u64>,
    pub active_threads: u32,
    pub resumable: bool,
    pub etag: String,
    pub last_modified: String,
    pub mime_type: String,
    pub segments: Vec<crate::core::monitor::payload::SegmentProgressPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateDownloadInfo {
    pub id: String,
    pub filename: String,
    pub url: String,
    pub status: String,
    pub save_path: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub file_exists_on_disk: bool,
}

pub enum DownloadCommand {
    Pause,
    Cancel,
    SetSpeedLimit(u64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteCredential {
    pub id: String,
    pub domain: String,
    pub protocol: String,
    pub username: String,
    pub password: String,
    pub enabled: bool,
    pub created_at: String,
    pub last_used_at: Option<String>,
    pub notes: Option<String>,
}

impl SiteCredential {
    pub fn matches_url(&self, url_str: &str) -> bool {
        if !self.enabled {
            return false;
        }
        let parsed = match reqwest::Url::parse(url_str) {
            Ok(u) => u,
            Err(_) => return false,
        };
        let host = match parsed.host_str() {
            Some(h) => h.to_lowercase(),
            None => return false,
        };
        let scheme = parsed.scheme().to_lowercase();

        if self.protocol != "any" && self.protocol.to_lowercase() != scheme {
            return false;
        }

        let domain = self.domain.to_lowercase();
        if domain.starts_with("*.") {
            let suffix = &domain[2..];
            return host == suffix || host.ends_with(&format!(".{}", suffix));
        }

        host == domain || host.ends_with(&format!(".{}", domain))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_site_credential_domain_matching() {
        let cred = SiteCredential {
            id: "cred1".to_string(),
            domain: "example.com".to_string(),
            protocol: "https".to_string(),
            username: "user".to_string(),
            password: "pass".to_string(),
            enabled: true,
            created_at: "2026-01-01".to_string(),
            last_used_at: None,
            notes: None,
        };

        assert!(cred.matches_url("https://example.com/file.zip"));
        assert!(cred.matches_url("https://sub.example.com/file.zip"));
        assert!(!cred.matches_url("http://example.com/file.zip"));
        assert!(!cred.matches_url("https://otherdomain.com/file.zip"));
    }
}
