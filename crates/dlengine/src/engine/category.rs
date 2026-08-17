use std::path::{Path, PathBuf};

/// Returns the authoritative category folder name based on filename extension.
pub fn get_category_folder_name(filename: &str) -> &'static str {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "img" | "tgz"
        | "zst" | "cab" | "arj" | "lzh" | "ace" | "uue" | "bz" | "lz" | "lzma"
        | "lzo" | "rz" | "sfark" | "sz" | "z" | "7-zip" => "Compressed",

        "exe" | "msi" | "msix" | "appx" | "apk" | "deb" | "rpm" | "dmg" | "pkg"
        | "bin" | "bat" | "cmd" | "sh" | "app" | "gadget" | "com" | "cpl" | "inf"
        | "ins" | "inum" | "isu" | "job" | "jse" | "lnk" | "msc" | "msp" | "mst"
        | "paf" | "pif" | "ps1" | "reg" | "rgs" | "scr" | "sct" | "shb" | "shs"
        | "u3p" | "vb" | "vbe" | "vbs" | "vbscript" | "ws" | "wsf" | "wsh" => "Programs",

        "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "m4v" | "wmv" | "mpg"
        | "mpeg" | "m2v" | "3gp" | "3g2" | "ogv" | "vob" | "mts" | "m2ts" | "ts"
        | "divx" | "xvid" | "rm" | "rmvb" | "asf" => "Videos",

        "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac" | "opus" | "wma" | "alac"
        | "aiff" | "ape" | "mid" | "midi" | "mka" | "pcm" | "ra" => "Music",

        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "tiff" | "tif"
        | "avif" | "ico" | "heic" | "heif" | "raw" | "cr2" | "nef" | "arw" | "psd"
        | "ai" | "eps" => "Pictures",

        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "csv"
        | "epub" | "rtf" | "odt" | "ods" | "odp" | "md" | "log" | "xml" | "json"
        | "yaml" | "yml" | "mobi" | "azw" | "azw3" | "djvu" => "Documents",

        _ => "Other",
    }
}

/// Resolves the final destination directory for a download.
/// If `use_category` is true, nests the download inside `Rilo/<Category>` under `base_dir`.
pub fn resolve_final_download_dir(base_dir: &Path, use_category: bool, filename: &str) -> PathBuf {
    if use_category {
        let cat = get_category_folder_name(filename);
        let base_str = base_dir.to_string_lossy().to_lowercase();
        if base_str.ends_with("rilo") || base_str.ends_with("rilo/") || base_str.ends_with("rilo\\") {
            base_dir.join(cat)
        } else {
            base_dir.join("Rilo").join(cat)
        }
    } else {
        base_dir.to_path_buf()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_category_folder_mapping() {
        assert_eq!(get_category_folder_name("archive.zip"), "Compressed");
        assert_eq!(get_category_folder_name("setup.exe"), "Programs");
        assert_eq!(get_category_folder_name("movie.mkv"), "Videos");
        assert_eq!(get_category_folder_name("song.flac"), "Music");
        assert_eq!(get_category_folder_name("photo.png"), "Pictures");
        assert_eq!(get_category_folder_name("document.pdf"), "Documents");
        assert_eq!(get_category_folder_name("unknown.dat"), "Other");
        assert_eq!(get_category_folder_name("noextension"), "Other");
    }

    #[test]
    fn test_resolve_final_download_dir() {
        let base = PathBuf::from("C:\\Downloads");
        assert_eq!(
            resolve_final_download_dir(&base, true, "archive.zip"),
            base.join("Rilo").join("Compressed")
        );
        assert_eq!(
            resolve_final_download_dir(&base, false, "archive.zip"),
            base
        );
    }
}
