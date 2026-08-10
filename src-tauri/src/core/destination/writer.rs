use std::path::Path;
use tokio::fs::OpenOptions;
use tokio::io::Result;

pub async fn open_append_file(path: &Path, append_mode: bool) -> Result<tokio::fs::File> {
    OpenOptions::new()
        .create(true)
        .write(true)
        .read(true)
        .append(append_mode)
        .truncate(!append_mode)
        .open(path)
        .await
}
