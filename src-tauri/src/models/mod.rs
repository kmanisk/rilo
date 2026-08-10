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

pub enum DownloadCommand {
    Pause,
    Cancel,
    SetSpeedLimit(u64),
}
