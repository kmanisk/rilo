use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadItemModel {
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
}
