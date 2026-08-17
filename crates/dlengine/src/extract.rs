//! Standalone Archive Extraction Module for DLengine
//!
//! Provides clean, secure extraction for supported archive formats (.zip, .rar, .7z, .tar, etc.)
//! with path sanitization (Zip Slip protection), error reporting, and post-cleanup options.

use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExtractError {
    #[error("Archive file not found: {0}")]
    NotFound(String),
    #[error("Unsupported archive format: {0}")]
    UnsupportedFormat(String),
    #[error("Invalid or corrupt archive: {0}")]
    CorruptArchive(String),
    #[error("Destination directory unavailable: {0}")]
    DestinationError(String),
    #[error("Security violation (Zip Slip path traversal blocked): {0}")]
    PathTraversal(String),
    #[error("I/O error during extraction: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct ExtractResult {
    pub files_extracted: usize,
    pub total_bytes: u64,
    pub target_dir: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveType {
    Zip,
    Rar,
    SevenZip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    Unknown,
}

impl ArchiveType {
    pub fn is_supported(&self) -> bool {
        matches!(self, ArchiveType::Zip)
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ArchiveType::Zip => "ZIP Archive",
            ArchiveType::Rar => "RAR Archive",
            ArchiveType::SevenZip => "7-Zip Archive",
            ArchiveType::Tar => "TAR Archive",
            ArchiveType::TarGz => "GZ TAR Archive",
            ArchiveType::TarBz2 => "BZ2 TAR Archive",
            ArchiveType::TarXz => "XZ TAR Archive",
            ArchiveType::Unknown => "Unknown Format",
        }
    }
}

pub fn detect_archive_type(path: &Path) -> ArchiveType {
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
    if filename.ends_with(".zip") {
        ArchiveType::Zip
    } else if filename.ends_with(".rar") {
        ArchiveType::Rar
    } else if filename.ends_with(".7z") {
        ArchiveType::SevenZip
    } else if filename.ends_with(".tar.gz") || filename.ends_with(".tgz") {
        ArchiveType::TarGz
    } else if filename.ends_with(".tar.bz2") || filename.ends_with(".tbz2") {
        ArchiveType::TarBz2
    } else if filename.ends_with(".tar.xz") || filename.ends_with(".txz") {
        ArchiveType::TarXz
    } else if filename.ends_with(".tar") {
        ArchiveType::Tar
    } else {
        ArchiveType::Unknown
    }
}

pub fn is_archive(path: &Path) -> bool {
    detect_archive_type(path) != ArchiveType::Unknown
}

/// Sanitize entry paths to avoid Zip Slip directory traversal vulnerabilities
pub fn sanitize_entry_path(dest_dir: &Path, entry_name: &str) -> Result<PathBuf, ExtractError> {
    let relative = Path::new(entry_name);
    for component in relative.components() {
        match component {
            std::path::Component::ParentDir => {
                return Err(ExtractError::PathTraversal(format!(
                    "Path traversal attempt detected in archive entry: {}",
                    entry_name
                )));
            }
            std::path::Component::Prefix(_) | std::path::Component::RootDir => {
                return Err(ExtractError::PathTraversal(format!(
                    "Absolute path detected in archive entry: {}",
                    entry_name
                )));
            }
            _ => {}
        }
    }

    let joined = dest_dir.join(relative);
    Ok(joined)
}

/// Extract an archive to the target directory.
pub fn extract_archive(
    file_path: &Path,
    target_dir: &Path,
    delete_after: bool,
) -> Result<ExtractResult, ExtractError> {
    if !file_path.exists() {
        return Err(ExtractError::NotFound(file_path.to_string_lossy().to_string()));
    }

    let archive_type = detect_archive_type(file_path);
    if archive_type == ArchiveType::Unknown {
        return Err(ExtractError::UnsupportedFormat(
            file_path.extension().and_then(|e| e.to_str()).unwrap_or("unknown").to_string(),
        ));
    }

    fs::create_dir_all(target_dir).map_err(|e| ExtractError::DestinationError(e.to_string()))?;

    let result = match archive_type {
        ArchiveType::Zip => extract_zip(file_path, target_dir)?,
        ArchiveType::Rar => {
            return Err(ExtractError::UnsupportedFormat(
                "RAR archives require external unrar utility".to_string(),
            ));
        }
        ArchiveType::SevenZip => {
            return Err(ExtractError::UnsupportedFormat(
                "7Z archives require 7z utility or extended backend extractor".to_string(),
            ));
        }
        _ => {
            return Err(ExtractError::UnsupportedFormat(format!(
                "Extraction for {} is not supported by basic engine",
                archive_type.display_name()
            )));
        }
    };

    if delete_after {
        let _ = fs::remove_file(file_path);
    }

    Ok(result)
}

fn extract_zip(file_path: &Path, target_dir: &Path) -> Result<ExtractResult, ExtractError> {
    let file = File::open(file_path).map_err(ExtractError::Io)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| ExtractError::CorruptArchive(e.to_string()))?;

    let mut files_extracted = 0;
    let mut total_bytes = 0;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| ExtractError::CorruptArchive(e.to_string()))?;

        let entry_name = entry.name().to_string();
        let out_path = sanitize_entry_path(target_dir, &entry_name)?;

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(ExtractError::Io)?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(ExtractError::Io)?;
            }
            let mut outfile = File::create(&out_path).map_err(ExtractError::Io)?;
            let written = io::copy(&mut entry, &mut outfile).map_err(ExtractError::Io)?;
            total_bytes += written;
            files_extracted += 1;
        }
    }

    Ok(ExtractResult {
        files_extracted,
        total_bytes,
        target_dir: target_dir.to_path_buf(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    #[test]
    fn test_detect_archive_type() {
        assert_eq!(detect_archive_type(Path::new("test.zip")), ArchiveType::Zip);
        assert_eq!(detect_archive_type(Path::new("archive.tar.gz")), ArchiveType::TarGz);
        assert_eq!(detect_archive_type(Path::new("document.pdf")), ArchiveType::Unknown);
    }

    #[test]
    fn test_zip_slip_rejection() {
        let dest = Path::new("/tmp/extract");
        assert!(sanitize_entry_path(dest, "../evil.txt").is_err());
        assert!(sanitize_entry_path(dest, "/etc/passwd").is_err());
        assert!(sanitize_entry_path(dest, "safe/nested/file.txt").is_ok());
    }

    #[test]
    fn test_extract_valid_zip() {
        let temp_dir = std::env::temp_dir().join(format!("dlengine_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let zip_path = temp_dir.join("test.zip");
        let extract_target = temp_dir.join("extracted");

        // Create a test zip file
        {
            let file = File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options = SimpleFileOptions::default();

            zip.start_file("hello.txt", options).unwrap();
            zip.write_all(b"Hello Rilo Auto Extract!").unwrap();
            zip.finish().unwrap();
        }

        let res = extract_archive(&zip_path, &extract_target, false).unwrap();
        assert_eq!(res.files_extracted, 1);
        assert!(extract_target.join("hello.txt").exists());

        let content = fs::read_to_string(extract_target.join("hello.txt")).unwrap();
        assert_eq!(content, "Hello Rilo Auto Extract!");

        let _ = fs::remove_dir_all(temp_dir);
    }
}
