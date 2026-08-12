//! Authoritative Filename Resolution Module
//!
//! Provides RFC 5987 / RFC 6266 compliant Content-Disposition parsing,
//! robust URL basename fallback, and Windows-safe filename sanitization.

use tracing::info;
use url::Url;

/// Detail result of filename resolution including candidate metadata and selected source
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilenameResolveResult {
    pub resolved_filename: String,
    pub source: String,
    pub raw_candidate: String,
    pub content_disposition_star: Option<String>,
    pub content_disposition_name: Option<String>,
    pub url_basename: Option<String>,
}

/// Parse Content-Disposition header according to RFC 6266 & RFC 5987
/// Returns (filename_star, filename)
pub fn parse_content_disposition(header_val: &str) -> (Option<String>, Option<String>) {
    let mut filename_star = None;
    let mut filename = None;

    // Split parameters by semicolon
    for part in header_val.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }

        if let Some(eq_idx) = part.find('=') {
            let key = part[..eq_idx].trim();
            let val = part[eq_idx + 1..].trim();

            if key.eq_ignore_ascii_case("filename*") {
                if let Some(parsed) = parse_rfc5987_value(val) {
                    filename_star = Some(parsed);
                }
            } else if key.eq_ignore_ascii_case("filename") {
                let unquoted = unquote_and_unescape(val);
                if !unquoted.is_empty() {
                    filename = Some(unquoted);
                }
            }
        }
    }

    (filename_star, filename)
}

/// Parse RFC 5987 encoded value format: charset'lang'percent_encoded_value
fn parse_rfc5987_value(raw_val: &str) -> Option<String> {
    let val = raw_val.trim_matches('"');
    let mut parts = val.splitn(3, '\'');

    let _charset = parts.next()?;
    let _lang = parts.next()?;
    let encoded_text = parts.next()?;

    let decoded = urlencoding::decode(encoded_text).ok()?;
    let clean = decoded.trim();
    if clean.is_empty() {
        None
    } else {
        Some(clean.to_string())
    }
}

/// Unquote and unescape backslash sequences in header parameter values
fn unquote_and_unescape(val: &str) -> String {
    let trimmed = val.trim();
    let unquoted = if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        &trimmed[1..trimmed.len() - 1]
    } else {
        trimmed
    };

    let mut result = String::with_capacity(unquoted.len());
    let mut chars = unquoted.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next_c) = chars.peek() {
                result.push(next_c);
                chars.next();
                continue;
            }
        }
        result.push(c);
    }

    // Try decoding percent-encoding if present (e.g. filename="foo%20bar.rar")
    let final_decoded = urlencoding::decode(&result)
        .map(|s| s.into_owned())
        .unwrap_or(result);

    final_decoded.trim().to_string()
}

/// Extract basename candidate from a URL string
pub fn extract_url_basename(url_str: &str) -> Option<String> {
    let parsed = Url::parse(url_str).ok()?;
    let segments = parsed.path_segments()?;
    let last = segments.last()?.trim();
    if last.is_empty() {
        return None;
    }

    let decoded = urlencoding::decode(last).ok()?;
    let clean = decoded.trim();
    if clean.is_empty() || clean == "." || clean == ".." {
        None
    } else {
        Some(clean.to_string())
    }
}

/// Sanitize filename for Windows filesystem safety and security
pub fn sanitize_filename(name: &str) -> String {
    let mut sanitized = String::with_capacity(name.len());

    for c in name.chars() {
        match c {
            // Replace Windows reserved characters
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => sanitized.push('_'),
            // Skip ASCII control characters
            c if (c as u32) < 32 => continue,
            c => sanitized.push(c),
        }
    }

    let mut result = sanitized.trim().to_string();

    // Prevent trailing dots or spaces which Windows forbids
    while result.ends_with('.') || result.ends_with(' ') {
        result.pop();
    }

    // Handle security edge-cases (. and .. or empty)
    if result.is_empty() || result == "." || result == ".." {
        result = "download.bin".to_string();
    }

    result
}

/// Resolve authoritative filename using Content-Disposition and URL hierarchy
pub fn resolve_authoritative_filename(
    download_id: uuid::Uuid,
    content_disposition: Option<&str>,
    final_url: Option<&str>,
    original_url: &str,
) -> FilenameResolveResult {
    let mut cd_star = None;
    let mut cd_name = None;

    if let Some(cd_header) = content_disposition {
        let (star, name) = parse_content_disposition(cd_header);
        cd_star = star;
        cd_name = name;
    }

    let final_url_basename = final_url.and_then(extract_url_basename);
    let original_url_basename = extract_url_basename(original_url);

    let (selected_raw, source_name) = if let Some(ref star) = cd_star {
        (star.clone(), "content-disposition-filename-star")
    } else if let Some(ref name) = cd_name {
        (name.clone(), "content-disposition-filename")
    } else if let Some(ref f_base) = final_url_basename {
        (f_base.clone(), "final-url-basename")
    } else if let Some(ref o_base) = original_url_basename {
        (o_base.clone(), "original-url-basename")
    } else {
        ("download.bin".to_string(), "fallback-default")
    };

    let sanitized = sanitize_filename(&selected_raw);

    eprintln!(
        "[FILENAME-CANDIDATES] id={} cd_star={:?} cd_name={:?} final_url={:?} url_basename={:?} selected=\"{}\"",
        download_id, cd_star, cd_name, final_url, original_url_basename, sanitized
    );
    eprintln!(
        "[FILENAME-RESOLVE] id={} source=\"{}\" raw=\"{}\" resolved=\"{}\"",
        download_id, source_name, selected_raw, sanitized
    );
    info!(
        "[FILENAME-RESOLVE] id={} source={} raw={} resolved={}",
        download_id, source_name, selected_raw, sanitized
    );

    FilenameResolveResult {
        resolved_filename: sanitized,
        source: source_name.to_string(),
        raw_candidate: selected_raw,
        content_disposition_star: cd_star,
        content_disposition_name: cd_name,
        url_basename: final_url_basename.or(original_url_basename),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_content_disposition_filename_star() {
        let header = "attachment; filename*=UTF-8''my%20archive%20%282026%29.rar";
        let (star, name) = parse_content_disposition(header);
        assert_eq!(star, Some("my archive (2026).rar".to_string()));
        assert_eq!(name, None);
    }

    #[test]
    fn test_parse_content_disposition_filename_quoted() {
        let header = "attachment; filename=\"custom_build_v1.0.rar\"";
        let (star, name) = parse_content_disposition(header);
        assert_eq!(star, None);
        assert_eq!(name, Some("custom_build_v1.0.rar".to_string()));
    }

    #[test]
    fn test_parse_content_disposition_both_star_takes_precedence() {
        let header = "attachment; filename=\"fallback.bin\"; filename*=UTF-8''preferred_file.rar";
        let res = resolve_authoritative_filename(Uuid::nil(), Some(header), None, "https://example.com/test");
        assert_eq!(res.resolved_filename, "preferred_file.rar");
        assert_eq!(res.source, "content-disposition-filename-star");
    }

    #[test]
    fn test_sanitize_windows_invalid_characters() {
        let raw = "file<name>:with\"invalid/path\\chars|and?star*.rar";
        let sanitized = sanitize_filename(raw);
        assert_eq!(sanitized, "file_name__with_invalid_path_chars_and_star_.rar");
    }

    #[test]
    fn test_sanitize_trailing_dots_and_spaces() {
        let raw = "archive.rar...   ";
        let sanitized = sanitize_filename(raw);
        assert_eq!(sanitized, "archive.rar");
    }

    #[test]
    fn test_opaque_bzzhr_url_with_content_disposition() {
        let header = "attachment; filename=\"bzzhr_dataset.part1.rar\"";
        let url = "https://ts.bzzhr.to/d/zmn6qzlua3de?token=xyz123";
        let res = resolve_authoritative_filename(Uuid::nil(), Some(header), None, url);
        assert_eq!(res.resolved_filename, "bzzhr_dataset.part1.rar");
        assert_ne!(res.resolved_filename, "zmn6qzlua3de");
    }
}
