use super::error::ExtractionError;
use std::path::{Component, Path, PathBuf};

pub fn sanitize_entry_path(dest_dir: &Path, entry_path: &Path) -> Result<PathBuf, ExtractionError> {
    // 1. Reject empty entry paths
    if entry_path.as_os_str().is_empty() {
        return Err(ExtractionError::PathTraversal("Empty archive entry path".into()));
    }

    // 2. Reject entry paths with parent directory components (..) or root/prefix components
    let mut safe_components = Vec::new();

    for comp in entry_path.components() {
        match comp {
            Component::Prefix(p) => {
                return Err(ExtractionError::PathTraversal(format!(
                    "Drive prefix or UNC path traversal rejected: {:?}",
                    p
                )));
            }
            Component::RootDir => {
                return Err(ExtractionError::PathTraversal(format!(
                    "Absolute root path in archive entry rejected: {:?}",
                    entry_path
                )));
            }
            Component::ParentDir => {
                return Err(ExtractionError::PathTraversal(format!(
                    "Zip Slip parent directory traversal (..) rejected: {:?}",
                    entry_path
                )));
            }
            Component::CurDir => {
                // Ignore '.'
            }
            Component::Normal(c) => {
                safe_components.push(c);
            }
        }
    }

    if safe_components.is_empty() {
        return Err(ExtractionError::PathTraversal("Archive entry path resolved to root".into()));
    }

    let mut rel_path = PathBuf::new();
    for c in safe_components {
        rel_path.push(c);
    }

    let target_path = dest_dir.join(&rel_path);

    // 3. Verify destination prefix containment
    let canonical_dest = dest_dir.canonicalize().unwrap_or_else(|_| dest_dir.to_path_buf());

    if !target_path.starts_with(dest_dir) && !target_path.starts_with(&canonical_dest) {
        return Err(ExtractionError::PathTraversal(format!(
            "Path traversal escape detected for entry: {:?}",
            entry_path
        )));
    }

    Ok(target_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_valid_entry_path() {
        let dest = PathBuf::from("C:\\Downloads\\Extract");
        let entry = PathBuf::from("images/photo.jpg");
        let res = sanitize_entry_path(&dest, &entry).unwrap();
        assert_eq!(res, PathBuf::from("C:\\Downloads\\Extract\\images\\photo.jpg"));
    }

    #[test]
    fn test_parent_dir_zip_slip_rejected() {
        let dest = PathBuf::from("C:\\Downloads\\Extract");
        let entry = PathBuf::from("../../Windows/System32/malicious.exe");
        let res = sanitize_entry_path(&dest, &entry);
        assert!(res.is_err());
    }

    #[test]
    fn test_absolute_path_rejected() {
        let dest = PathBuf::from("C:\\Downloads\\Extract");
        let entry = PathBuf::from("/etc/passwd");
        let res = sanitize_entry_path(&dest, &entry);
        assert!(res.is_err());
    }

    #[test]
    fn test_drive_letter_path_rejected() {
        let dest = PathBuf::from("C:\\Downloads\\Extract");
        let entry = PathBuf::from("D:\\file.txt");
        let res = sanitize_entry_path(&dest, &entry);
        assert!(res.is_err());
    }
}
