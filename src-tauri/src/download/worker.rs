//! Download worker adapter module for Rilo.
//! Download tasks are executed directly by `dlengine::engine::DownloadTask`.

use crate::download::DownloadManager;
use tauri::AppHandle;

pub async fn execute_download<R: tauri::Runtime>(
    _app: AppHandle<R>,
    manager: DownloadManager,
    download_id: String,
    url: String,
    custom_path: Option<String>,
    speed_limit: Option<u64>,
    num_connections: Option<u32>,
    is_resume: bool,
) -> Result<(), String> {
    manager
        .start_download(
            Some(download_id),
            url,
            custom_path,
            speed_limit,
            num_connections,
            is_resume,
            true,
        )
        .await
        .map(|_| ())
}
