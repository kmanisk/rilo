use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionProgressPayload {
    pub download_id: String,
    pub state: String, // "Pending" | "Extracting" | "Extracted" | "ExtractionFailed" | "Cancelled"
    pub progress_percent: f64,
    pub extracted_files: u64,
    pub total_files: u64,
    pub current_file: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveInfo {
    pub filename: String,
    pub format: String,
    pub is_supported: bool,
    pub total_files: u64,
    pub uncompressed_size: u64,
    pub is_encrypted: bool,
}
