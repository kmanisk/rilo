use super::detector::{detect_archive_format, ArchiveFormat};
use super::disk_space::check_extraction_space;
use super::error::ExtractionError;
use super::payload::ExtractionProgressPayload;
use super::security::sanitize_entry_path;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Emitter;

pub struct ExtractionOptions {
    pub archive_path: PathBuf,
    pub dest_dir: PathBuf,
    pub password: Option<String>,
    pub delete_after: bool,
}

pub fn extract_archive(
    app: AppHandle,
    download_id: String,
    options: ExtractionOptions,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), ExtractionError> {
    if !options.archive_path.exists() {
        return Err(ExtractionError::ArchiveNotFound(
            options.archive_path.to_string_lossy().to_string(),
        ));
    }

    let format = detect_archive_format(&options.archive_path.to_string_lossy());
    if !format.is_supported() {
        if format == ArchiveFormat::Rar {
            return Err(ExtractionError::UnsupportedFormat(
                "Password-protected or proprietary RAR extraction requires an external unrar tool; supported formats include ZIP, 7Z, TAR, TAR.GZ, TAR.BZ2, TAR.XZ".to_string(),
            ));
        }
        return Err(ExtractionError::UnsupportedFormat(format.display_name().to_string()));
    }

    // Ensure destination directory exists
    if let Err(err) = fs::create_dir_all(&options.dest_dir) {
        return Err(ExtractionError::DestinationUnavailable(err.to_string()));
    }

    // Pre-check disk space
    check_extraction_space(&options.archive_path, &options.dest_dir, 0)?;

    // Emit initial progress
    emit_extraction_progress(
        &app,
        &download_id,
        "Extracting",
        0.0,
        0,
        0,
        "",
        None,
    );

    let result = match format {
        ArchiveFormat::Zip => extract_zip(&app, &download_id, &options, &cancel_flag),
        ArchiveFormat::SevenZip => extract_7z(&app, &download_id, &options, &cancel_flag),
        ArchiveFormat::Tar => extract_tar(&app, &download_id, &options, None, &cancel_flag),
        ArchiveFormat::TarGz => extract_tar(&app, &download_id, &options, Some("gz"), &cancel_flag),
        ArchiveFormat::TarBz2 => extract_tar(&app, &download_id, &options, Some("bz2"), &cancel_flag),
        ArchiveFormat::TarXz => extract_tar(&app, &download_id, &options, Some("xz"), &cancel_flag),
        _ => Err(ExtractionError::UnsupportedFormat("Unsupported archive format".to_string())),
    };

    match result {
        Ok(()) => {
            if options.delete_after {
                let _ = fs::remove_file(&options.archive_path);
            }
            emit_extraction_progress(
                &app,
                &download_id,
                "Extracted",
                100.0,
                0,
                0,
                "",
                None,
            );
            Ok(())
        }
        Err(err) => {
            let state_str = if matches!(err, ExtractionError::Cancelled) {
                "Cancelled"
            } else {
                "ExtractionFailed"
            };
            emit_extraction_progress(
                &app,
                &download_id,
                state_str,
                0.0,
                0,
                0,
                "",
                Some(err.to_string()),
            );
            Err(err)
        }
    }
}

fn emit_extraction_progress(
    app: &AppHandle,
    download_id: &str,
    state: &str,
    progress_percent: f64,
    extracted_files: u64,
    total_files: u64,
    current_file: &str,
    error_message: Option<String>,
) {
    let payload = ExtractionProgressPayload {
        download_id: download_id.to_string(),
        state: state.to_string(),
        progress_percent: progress_percent.clamp(0.0, 100.0),
        extracted_files,
        total_files,
        current_file: current_file.to_string(),
        error_message,
    };
    let _ = app.emit("extraction-progress", payload);
}

fn extract_zip(
    app: &AppHandle,
    download_id: &str,
    options: &ExtractionOptions,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(), ExtractionError> {
    let file = File::open(&options.archive_path).map_err(|e| ExtractionError::IoError(e.to_string()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| ExtractionError::InvalidArchive(e.to_string()))?;
    let total_files = zip.len() as u64;

    for i in 0..zip.len() {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err(ExtractionError::Cancelled);
        }

        let zip_file_result = match &options.password {
            Some(pwd) => zip.by_index_decrypt(i, pwd.as_bytes()).map_err(|e| match e {
                zip::result::ZipError::InvalidPassword => ExtractionError::WrongPassword,
                zip::result::ZipError::UnsupportedArchive(_) => ExtractionError::MissingPassword,
                _ => ExtractionError::InvalidArchive(e.to_string()),
            }),
            None => zip.by_index(i).map_err(|e| match e {
                zip::result::ZipError::InvalidPassword => ExtractionError::MissingPassword,
                zip::result::ZipError::UnsupportedArchive(_) => ExtractionError::MissingPassword,
                _ => ExtractionError::InvalidArchive(e.to_string()),
            }),
        };

        let mut zip_file = zip_file_result?;

        let enclosed_name = zip_file.enclosed_name().ok_or_else(|| {
            ExtractionError::PathTraversal(format!("Unenclosed or suspicious zip entry path: {}", zip_file.name()))
        })?;

        let target_path = sanitize_entry_path(&options.dest_dir, &enclosed_name)?;

        if zip_file.name().ends_with('/') || zip_file.is_dir() {
            fs::create_dir_all(&target_path).map_err(|e| ExtractionError::IoError(e.to_string()))?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|e| ExtractionError::IoError(e.to_string()))?;
            }
            let mut out_file = File::create(&target_path).map_err(|e| ExtractionError::IoError(e.to_string()))?;
            io::copy(&mut zip_file, &mut out_file).map_err(|e| ExtractionError::IoError(e.to_string()))?;
        }

        let pct = if total_files > 0 {
            ((i + 1) as f64 / total_files as f64) * 100.0
        } else {
            100.0
        };

        emit_extraction_progress(
            app,
            download_id,
            "Extracting",
            pct,
            (i + 1) as u64,
            total_files,
            zip_file.name(),
            None,
        );
    }

    Ok(())
}

fn extract_7z(
    _app: &AppHandle,
    _download_id: &str,
    options: &ExtractionOptions,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(), ExtractionError> {
    let password = options.password.as_deref().unwrap_or("");

    let result = sevenz_rust::decompress_file_with_extract_fn(
        &options.archive_path,
        &options.dest_dir,
        |entry, reader, target_dir| {
            let target_path = sanitize_entry_path(target_dir, PathBuf::from(entry.name()).as_path())
                .map_err(|e| sevenz_rust::Error::other(e.to_string()))?;
            if entry.is_directory() {
                fs::create_dir_all(&target_path).map_err(sevenz_rust::Error::io)?;
            } else {
                if let Some(parent) = target_path.parent() {
                    fs::create_dir_all(parent).map_err(sevenz_rust::Error::io)?;
                }
                let mut out_file = File::create(&target_path).map_err(sevenz_rust::Error::io)?;
                io::copy(reader, &mut out_file).map_err(sevenz_rust::Error::io)?;
            }
            Ok(true)
        },
    );

    if cancel_flag.load(Ordering::Relaxed) {
        return Err(ExtractionError::Cancelled);
    }

    match result {
        Ok(_) => Ok(()),
        Err(e) => {
            let err_msg = e.to_string();
            if err_msg.contains("Password") || err_msg.contains("encrypted") || err_msg.contains("CRC") {
                if password.is_empty() {
                    Err(ExtractionError::MissingPassword)
                } else {
                    Err(ExtractionError::WrongPassword)
                }
            } else {
                Err(ExtractionError::InvalidArchive(err_msg))
            }
        }
    }
}

fn extract_tar(
    app: &AppHandle,
    download_id: &str,
    options: &ExtractionOptions,
    compression: Option<&str>,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(), ExtractionError> {
    let file = File::open(&options.archive_path).map_err(|e| ExtractionError::IoError(e.to_string()))?;

    let mut reader: Box<dyn Read> = match compression {
        Some("gz") => Box::new(flate2::read::GzDecoder::new(file)),
        Some("bz2") => Box::new(bzip2::read::BzDecoder::new(file)),
        Some("xz") => Box::new(xz2::read::XzDecoder::new(file)),
        _ => Box::new(file),
    };

    let mut archive = tar::Archive::new(&mut reader);
    let entries = archive.entries().map_err(|e| ExtractionError::InvalidArchive(e.to_string()))?;

    let mut count = 0u64;
    for entry_res in entries {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err(ExtractionError::Cancelled);
        }

        let mut entry = entry_res.map_err(|e| ExtractionError::InvalidArchive(e.to_string()))?;
        let entry_path = entry.path().map_err(|e| ExtractionError::InvalidArchive(e.to_string()))?.to_path_buf();
        let target_path = sanitize_entry_path(&options.dest_dir, &entry_path)?;

        let is_dir = entry.header().entry_type().is_dir();

        if is_dir {
            fs::create_dir_all(&target_path).map_err(|e| ExtractionError::IoError(e.to_string()))?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|e| ExtractionError::IoError(e.to_string()))?;
            }
            let mut out_file = File::create(&target_path).map_err(|e| ExtractionError::IoError(e.to_string()))?;
            io::copy(&mut entry, &mut out_file).map_err(|e| ExtractionError::IoError(e.to_string()))?;
        }

        count += 1;
        emit_extraction_progress(
            app,
            download_id,
            "Extracting",
            0.0,
            count,
            0,
            &entry_path.to_string_lossy(),
            None,
        );
    }

    Ok(())
}
