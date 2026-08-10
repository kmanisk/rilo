use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentProgressPayload {
    pub segment_id: usize,
    pub start_byte: u64,
    pub end_byte: u64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub progress_percent: f64,
    pub current_speed_bps: u64,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub segments: Vec<SegmentProgressPayload>,
}
