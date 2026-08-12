use std::path::{Path, PathBuf};

pub fn get_part_file_path(target_file: &Path, part_index: usize) -> PathBuf {
    let file_name = target_file.file_name().unwrap_or_default().to_string_lossy();
    let part_name = format!("{}.rilo.part{}", file_name, part_index);
    target_file.with_file_name(part_name)
}

pub async fn cleanup_part_files(target_file: &Path, max_parts: usize) {
    for i in 0..max_parts {
        let p = get_part_file_path(target_file, i);
        let _ = tokio::fs::remove_file(p).await;
    }
}
