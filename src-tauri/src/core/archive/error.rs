use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "details")]
pub enum ExtractionError {
    UnsupportedFormat(String),
    InvalidArchive(String),
    WrongPassword,
    MissingPassword,
    InsufficientDiskSpace {
        required: u64,
        available: u64,
        dest: String,
    },
    DestinationUnavailable(String),
    PermissionDenied(String),
    PathTraversal(String),
    IoError(String),
    ArchiveNotFound(String),
    Cancelled,
}

impl fmt::Display for ExtractionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExtractionError::UnsupportedFormat(msg) => write!(f, "Unsupported archive format: {}", msg),
            ExtractionError::InvalidArchive(msg) => write!(f, "Invalid or corrupt archive: {}", msg),
            ExtractionError::WrongPassword => write!(f, "Incorrect password provided for encrypted archive"),
            ExtractionError::MissingPassword => write!(f, "Archive is password protected. Please provide a valid password."),
            ExtractionError::InsufficientDiskSpace { required, available, dest } => write!(
                f,
                "Not enough disk space to extract archive at {}. Available: {} bytes, Required: {} bytes",
                dest, available, required
            ),
            ExtractionError::DestinationUnavailable(msg) => write!(f, "Destination directory unavailable: {}", msg),
            ExtractionError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            ExtractionError::PathTraversal(msg) => write!(f, "Security violation (Zip Slip path traversal blocked): {}", msg),
            ExtractionError::IoError(msg) => write!(f, "Extraction I/O error: {}", msg),
            ExtractionError::ArchiveNotFound(msg) => write!(f, "Archive file missing or deleted: {}", msg),
            ExtractionError::Cancelled => write!(f, "Extraction cancelled by user"),
        }
    }
}

impl std::error::Error for ExtractionError {}
