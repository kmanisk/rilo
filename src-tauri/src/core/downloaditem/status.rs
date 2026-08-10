use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadJobStatus {
    Queued,
    Preparing,
    Downloading,
    Reconnecting,
    Restarting,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl DownloadJobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Preparing => "preparing",
            Self::Downloading => "downloading",
            Self::Reconnecting => "reconnecting",
            Self::Restarting => "restarting",
            Self::Paused => "paused",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}
