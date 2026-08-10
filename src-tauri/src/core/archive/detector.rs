use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArchiveFormat {
    Zip,
    SevenZip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    Rar,
    Unknown,
}

impl ArchiveFormat {
    pub fn is_supported(&self) -> bool {
        matches!(
            self,
            ArchiveFormat::Zip
                | ArchiveFormat::SevenZip
                | ArchiveFormat::Tar
                | ArchiveFormat::TarGz
                | ArchiveFormat::TarBz2
                | ArchiveFormat::TarXz
        )
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ArchiveFormat::Zip => "ZIP Archive",
            ArchiveFormat::SevenZip => "7-Zip Archive",
            ArchiveFormat::Tar => "TAR Archive",
            ArchiveFormat::TarGz => "TAR.GZ Archive",
            ArchiveFormat::TarBz2 => "TAR.BZ2 Archive",
            ArchiveFormat::TarXz => "TAR.XZ Archive",
            ArchiveFormat::Rar => "RAR Archive (Unsupported)",
            ArchiveFormat::Unknown => "Unknown Format",
        }
    }
}

pub fn detect_archive_format(filename_or_path: &str) -> ArchiveFormat {
    let lower = filename_or_path.to_lowercase();
    if lower.ends_with(".zip") {
        ArchiveFormat::Zip
    } else if lower.ends_with(".7z") {
        ArchiveFormat::SevenZip
    } else if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        ArchiveFormat::TarGz
    } else if lower.ends_with(".tar.bz2") || lower.ends_with(".tbz2") {
        ArchiveFormat::TarBz2
    } else if lower.ends_with(".tar.xz") || lower.ends_with(".txz") {
        ArchiveFormat::TarXz
    } else if lower.ends_with(".tar") {
        ArchiveFormat::Tar
    } else if lower.ends_with(".rar") {
        ArchiveFormat::Rar
    } else {
        ArchiveFormat::Unknown
    }
}

pub fn is_archive_filename(filename: &str) -> bool {
    let fmt = detect_archive_format(filename);
    fmt.is_supported() || fmt == ArchiveFormat::Rar
}
