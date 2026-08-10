use std::path::Path;
use tokio::io::{AsyncWriteExt, Result};

pub async fn merge_parts_to_destination(target_file: &Path, num_parts: usize) -> Result<()> {
    let mut final_file = tokio::fs::File::create(target_file).await?;

    for i in 0..num_parts {
        let part_path = super::segmented::get_part_file_path(target_file, i);
        if let Ok(mut part_file) = tokio::fs::File::open(&part_path).await {
            let _ = tokio::io::copy(&mut part_file, &mut final_file).await;
        }
        let _ = tokio::fs::remove_file(part_path).await;
    }

    final_file.flush().await?;
    Ok(())
}
