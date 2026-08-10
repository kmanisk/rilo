use crate::models::DownloadCommand;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct DownloadJobHandle {
    pub id: String,
    pub tx: mpsc::Sender<DownloadCommand>,
    pub cancel_token: CancellationToken,
}

impl DownloadJobHandle {
    pub fn new(id: String, tx: mpsc::Sender<DownloadCommand>, cancel_token: CancellationToken) -> Self {
        Self { id, tx, cancel_token }
    }

    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }
}
