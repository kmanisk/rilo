use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileCategory {
    Videos,
    Music,
    Documents,
    Archives,
    Programs,
    General,
}

impl FileCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileCategory::Videos => "Videos",
            FileCategory::Music => "Music",
            FileCategory::Documents => "Documents",
            FileCategory::Archives => "Archives",
            FileCategory::Programs => "Programs",
            FileCategory::General => "General",
        }
    }

    pub fn auto_detect(filename_or_url: &str) -> Self {
        let ext = Path::new(filename_or_url)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "wmv" | "m4v" => FileCategory::Videos,
            "mp3" | "wav" | "aac" | "flac" | "ogg" | "m4a" | "wma" => FileCategory::Music,
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "csv" => FileCategory::Documents,
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => FileCategory::Archives,
            "exe" | "msi" | "apk" | "dmg" | "iso" | "app" | "bat" | "cmd" => FileCategory::Programs,
            _ => FileCategory::General,
        }
    }

    pub fn get_target_save_path(&self, default_download_dir: &Path, filename: &str) -> PathBuf {
        let category_folder = default_download_dir.join(self.as_str());
        let _ = std::fs::create_dir_all(&category_folder);
        category_folder.join(filename)
    }
}
