use std::path::{Path, PathBuf};

pub fn get_part_file_path(target_file: &Path, part_index: usize) -> PathBuf {
    target_file.with_extension(format!("part{}", part_index))
}

pub async fn cleanup_part_files(target_file: &Path, max_parts: usize) {
    for i in 0..max_parts {
        let p = get_part_file_path(target_file, i);
        let _ = tokio::fs::remove_file(p).await;
    }
}
