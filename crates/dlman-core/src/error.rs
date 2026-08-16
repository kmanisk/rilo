//! Error types for DLMan core

use thiserror::Error;
use uuid::Uuid;

/// Errors that can occur in DLMan core
#[derive(Debug, Error)]
pub enum DlmanError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Download not found: {0}")]
    NotFound(Uuid),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Resume not supported for this download")]
    ResumeNotSupported,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Download was cancelled")]
    Cancelled,

    #[error("Download was paused")]
    Paused,

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Download already exists: {0}")]
    AlreadyExists(Uuid),

    #[error("Server error: {status} - {message}")]
    ServerError {
        status: u16,
        message: String,
        retry_after: Option<u64>,
    },

    #[error("Authentication required for {domain} (HTTP {status})")]
    AuthenticationRequired { domain: String, url: String, status: u16 },

    #[error("Timeout")]
    Timeout,

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl DlmanError {
    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            DlmanError::Network(_) | DlmanError::Timeout => true,
            DlmanError::ServerError { status, .. } => *status == 429 || *status == 503 || *status >= 500,
            DlmanError::AuthenticationRequired { .. } => false,
            _ => false,
        }
    }

    /// Extract retry-after duration in seconds if provided by server
    pub fn retry_after(&self) -> Option<u64> {
        match self {
            DlmanError::ServerError { retry_after, .. } => *retry_after,
            _ => None,
        }
    }
}

/// Helper to parse Retry-After header from an HTTP response
pub fn parse_retry_after(response: &reqwest::Response) -> Option<u64> {
    if let Some(val) = response.headers().get(reqwest::header::RETRY_AFTER) {
        if let Ok(s) = val.to_str() {
            let s = s.trim();
            if let Ok(secs) = s.parse::<u64>() {
                return Some(secs.min(300));
            }
            if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(s) {
                let dt_utc = dt.with_timezone(&chrono::Utc);
                let now = chrono::Utc::now();
                if dt_utc > now {
                    let diff = (dt_utc - now).num_seconds();
                    if diff > 0 {
                        return Some((diff as u64).min(300));
                    }
                }
            }
        }
    }
    None
}

/// Format error details with complete source chain and classification for diagnostics
pub fn format_detailed_error(err: &DlmanError) -> String {
    let mut details = Vec::new();
    details.push(format!("Display: {}", err));
    details.push(format!("Debug: {:?}", err));

    if let DlmanError::Network(ref req_err) = err {
        details.push(format!("is_timeout: {}", req_err.is_timeout()));
        details.push(format!("is_connect: {}", req_err.is_connect()));
        details.push(format!("is_request: {}", req_err.is_request()));
        details.push(format!("is_status: {}", req_err.is_status()));
        details.push(format!("is_redirect: {}", req_err.is_redirect()));
        details.push(format!("is_body: {}", req_err.is_body()));
        details.push(format!("is_builder: {}", req_err.is_builder()));
        if let Some(status) = req_err.status() {
            details.push(format!("status: {}", status));
        }
        if let Some(url) = req_err.url() {
            details.push(format!("url: {}", url));
        }
    }

    let mut chain = Vec::new();
    let mut curr: Option<&(dyn std::error::Error + 'static)> = std::error::Error::source(err);
    while let Some(src) = curr {
        chain.push(format!("{}", src));
        curr = src.source();
    }
    if !chain.is_empty() {
        details.push(format!("Error Chain: {}", chain.join(" -> ")));
    }

    details.join(" | ")
}

// Allow converting to String for Tauri commands
impl From<DlmanError> for String {
    fn from(error: DlmanError) -> Self {
        error.to_string()
    }
}
