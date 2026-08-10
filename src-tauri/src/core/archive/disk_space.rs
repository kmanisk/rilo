use super::error::ExtractionError;
use std::path::Path;

pub fn get_available_disk_space(dir: &Path) -> std::io::Result<u64> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

        let path = if dir.exists() {
            dir.to_path_buf()
        } else if let Some(parent) = dir.parent() {
            parent.to_path_buf()
        } else {
            std::path::PathBuf::from("C:\\")
        };

        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let mut free_bytes_avail: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free_bytes: u64 = 0;

        let res = unsafe {
            GetDiskFreeSpaceExW(
                wide.as_ptr(),
                &mut free_bytes_avail,
                &mut total_bytes,
                &mut total_free_bytes,
            )
        };

        if res != 0 {
            Ok(free_bytes_avail)
        } else {
            Err(std::io::Error::last_os_error())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(u64::MAX)
    }
}

pub fn check_extraction_space(
    archive_path: &Path,
    dest_dir: &Path,
    required_space: u64,
) -> Result<(), ExtractionError> {
    let archive_size = std::fs::metadata(archive_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // If required_space is 0 or less than archive_size, estimate 2.5x archive size as conservative overhead
    let estimated_required = if required_space > 0 {
        required_space
    } else {
        archive_size.saturating_mul(2) + 10 * 1024 * 1024
    };

    if let Ok(available) = get_available_disk_space(dest_dir) {
        if available < estimated_required {
            return Err(ExtractionError::InsufficientDiskSpace {
                required: estimated_required,
                available,
                dest: dest_dir.to_string_lossy().to_string(),
            });
        }
    }

    Ok(())
}
