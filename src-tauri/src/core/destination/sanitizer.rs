pub fn sanitize_filename(raw_name: &str) -> String {
    let mut cleaned = raw_name.trim().to_string();

    // Remove path traversal sequences (e.g. ../ or ..\)
    while cleaned.contains("../") || cleaned.contains("..\\") {
        cleaned = cleaned.replace("../", "").replace("..\\", "");
    }

    // Replace invalid/illegal Windows and POSIX filesystem characters
    let illegal_chars = ['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>', '\0'];
    for ch in illegal_chars {
        cleaned = cleaned.replace(ch, "_");
    }

    // Trim trailing dots or spaces which cause Windows issues
    cleaned = cleaned.trim_end_matches(&['.', ' '][..]).to_string();

    if cleaned.is_empty() {
        cleaned = "download.bin".to_string();
    }

    // Prevent Windows Reserved Device Names (CON, PRN, AUX, NUL, COM1..9, LPT1..9)
    let uppercase = cleaned.to_uppercase();
    let stem = uppercase.split('.').next().unwrap_or("");
    let reserved_names = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    if reserved_names.contains(&stem) {
        cleaned = format!("file_{}", cleaned);
    }

    // Restrict filename length to 255 bytes max
    if cleaned.len() > 255 {
        if let Some(dot_idx) = cleaned.rfind('.') {
            let ext = &cleaned[dot_idx..];
            let stem_limit = 255 - ext.len();
            if stem_limit > 0 {
                cleaned = format!("{}{}", &cleaned[..stem_limit], ext);
            } else {
                cleaned.truncate(255);
            }
        } else {
            cleaned.truncate(255);
        }
    }

    cleaned
}

#[cfg(target_os = "windows")]
pub fn check_free_space(path: &std::path::Path, required_bytes: u64) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    let path_str = path.to_string_lossy();
    let wide: Vec<u16> = std::ffi::OsStr::new(path_str.as_ref())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_bytes_available: u64 = 0;
    let mut total_number_of_bytes: u64 = 0;
    let mut total_number_of_free_bytes: u64 = 0;

    let res = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes_available as *mut u64,
            &mut total_number_of_bytes as *mut u64,
            &mut total_number_of_free_bytes as *mut u64,
        )
    };

    if res != 0 && free_bytes_available > 0 && free_bytes_available < required_bytes {
        return Err(format!(
            "Insufficient disk space. Free: {} MB, Required: {} MB",
            free_bytes_available / (1024 * 1024),
            required_bytes / (1024 * 1024)
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn check_free_space(_path: &std::path::Path, _required_bytes: u64) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_sanitize_normal_filename() {
        assert_eq!(sanitize_filename("ubuntu.iso"), "ubuntu.iso");
        assert_eq!(sanitize_filename("document.pdf"), "document.pdf");
    }

    #[test]
    fn test_sanitize_path_traversal() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "etc_passwd");
        assert_eq!(sanitize_filename("..\\..\\Windows\\System32"), "Windows_System32");
    }

    #[test]
    fn test_sanitize_illegal_characters() {
        assert_eq!(sanitize_filename("file:name?.zip"), "file_name_.zip");
        assert_eq!(sanitize_filename("video<1>|2*.mp4"), "video_1__2_.mp4");
    }

    #[test]
    fn test_sanitize_reserved_windows_names() {
        assert_eq!(sanitize_filename("CON.txt"), "file_CON.txt");
        assert_eq!(sanitize_filename("aux.zip"), "file_aux.zip");
        assert_eq!(sanitize_filename("NUL"), "file_NUL");
    }

    #[test]
    fn test_sanitize_empty_and_trailing() {
        assert_eq!(sanitize_filename(""), "download.bin");
        assert_eq!(sanitize_filename("   "), "download.bin");
        assert_eq!(sanitize_filename("file.zip. . "), "file.zip");
    }
}
