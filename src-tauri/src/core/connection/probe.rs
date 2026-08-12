#[derive(Debug, Clone)]
pub struct ResponseProbeInfo {
    pub total_bytes: u64,
    pub etag: String,
    pub last_modified: String,
    pub mime_type: String,
    pub accept_ranges: String,
    pub redirect_url: String,
    pub supports_range: bool,
    pub suggested_filename: Option<String>,
}

pub fn parse_content_disposition_filename(header_value: &str) -> Option<String> {
    // 1. Check RFC 5987 / RFC 6266 extended syntax: filename*=UTF-8''encoded_name
    if let Some(pos) = header_value.to_lowercase().find("filename*=") {
        let val = &header_value[pos + 10..];
        let val = val.split(';').next().unwrap_or(val).trim();
        let encoded = if let Some(idx) = val.find("''") {
            &val[idx + 2..]
        } else {
            val
        };
        let trimmed = encoded.trim_matches('"').trim_matches('\'').trim();
        if let Ok(decoded) = urlencoding::decode(trimmed) {
            let res = decoded.trim().to_string();
            if !res.is_empty() {
                return Some(res);
            }
        }
    }

    // 2. Fallback to standard syntax: filename="..." or filename=...
    if let Some(pos) = header_value.to_lowercase().find("filename=") {
        let val = &header_value[pos + 9..];
        let val = val.split(';').next().unwrap_or(val).trim();
        let trimmed = val.trim_matches('"').trim_matches('\'').trim();
        if let Ok(decoded) = urlencoding::decode(trimmed) {
            let res = decoded.trim().to_string();
            if !res.is_empty() {
                return Some(res);
            }
        } else {
            let res = trimmed.to_string();
            if !res.is_empty() {
                return Some(res);
            }
        }
    }

    None
}

pub fn extract_filename_from_url(url_str: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(url_str).ok()?;
    let last_segment = parsed
        .path_segments()?
        .filter(|s| !s.is_empty())
        .last()?;

    let decoded = urlencoding::decode(last_segment).ok()?.into_owned();
    let trimmed = decoded.trim();

    if !trimmed.is_empty() && trimmed != "download" && trimmed != "download.bin" {
        Some(trimmed.to_string())
    } else {
        None
    }
}

pub async fn probe_url(client: &reqwest::Client, url: &str, db: Option<&crate::db::Database>) -> ResponseProbeInfo {
    let mut total_bytes: u64 = 0;
    let mut etag = String::new();
    let mut last_modified = String::new();
    let mut mime_type = String::new();
    let mut accept_ranges = String::new();
    let mut redirect_url = url.to_string();
    let mut supports_range = false;
    let mut suggested_filename = None;

    let auth_cred = match db {
        Some(d) => d.find_credential_for_url(url).await.ok().flatten(),
        None => None,
    };

    // Try HEAD request first for fast metadata, filename & redirect resolution
    let mut head_req = client.head(url);
    if let Some(ref cred) = auth_cred {
        head_req = head_req.basic_auth(&cred.username, Some(&cred.password));
    }

    if let Ok(head_res) = head_req.send().await {
        redirect_url = head_res.url().to_string();

        if let Some(cd) = head_res.headers().get(reqwest::header::CONTENT_DISPOSITION) {
            if let Ok(val) = cd.to_str() {
                suggested_filename = parse_content_disposition_filename(val);
            }
        }

        if head_res.status().is_success() {
            if let Some(cl) = head_res.content_length() {
                total_bytes = cl;
            }
            if let Some(ar) = head_res.headers().get(reqwest::header::ACCEPT_RANGES) {
                if let Ok(val) = ar.to_str() {
                    accept_ranges = val.to_string();
                    if val.to_lowercase().contains("bytes") {
                        supports_range = true;
                    }
                }
            }
            if let Some(e) = head_res.headers().get(reqwest::header::ETAG) {
                if let Ok(val) = e.to_str() {
                    etag = val.to_string();
                }
            }
            if let Some(lm) = head_res.headers().get(reqwest::header::LAST_MODIFIED) {
                if let Ok(val) = lm.to_str() {
                    last_modified = val.to_string();
                }
            }
            if let Some(ct) = head_res.headers().get(reqwest::header::CONTENT_TYPE) {
                if let Ok(val) = ct.to_str() {
                    mime_type = val.to_string();
                }
            }
        }
    }

    // Fallback partial GET probe: essential for GitHub releases, tokenized URLs, and CDNs rejecting HEAD
    let mut get_req = client
        .get(&redirect_url)
        .header(reqwest::header::RANGE, "bytes=0-0");
    if let Some(ref cred) = auth_cred {
        get_req = get_req.basic_auth(&cred.username, Some(&cred.password));
    }

    if let Ok(range_test) = get_req.send().await {
        redirect_url = range_test.url().to_string();
        let status = range_test.status();

        if suggested_filename.is_none() {
            if let Some(cd) = range_test.headers().get(reqwest::header::CONTENT_DISPOSITION) {
                if let Ok(val) = cd.to_str() {
                    suggested_filename = parse_content_disposition_filename(val);
                }
            }
        }

        if status == reqwest::StatusCode::PARTIAL_CONTENT {
            supports_range = true;
            if let Some(cr) = range_test.headers().get(reqwest::header::CONTENT_RANGE) {
                if let Ok(val) = cr.to_str() {
                    // Format: "bytes 0-0/104857600"
                    if let Some(slash_idx) = val.rfind('/') {
                        let total_str = &val[slash_idx + 1..];
                        if total_str != "*" {
                            if let Ok(parsed_total) = total_str.trim().parse::<u64>() {
                                total_bytes = parsed_total;
                            }
                        }
                    }
                }
            }
        } else if status.is_success() {
            // Server returned 200 OK (ignored Range)
            if let Some(cl) = range_test.content_length() {
                if total_bytes == 0 {
                    total_bytes = cl;
                }
            }
        }

        if etag.is_empty() {
            if let Some(e) = range_test.headers().get(reqwest::header::ETAG) {
                if let Ok(val) = e.to_str() {
                    etag = val.to_string();
                }
            }
        }
        if mime_type.is_empty() {
            if let Some(ct) = range_test.headers().get(reqwest::header::CONTENT_TYPE) {
                if let Ok(val) = ct.to_str() {
                    mime_type = val.to_string();
                }
            }
        }
    }

    // Final filename fallback from redirected URL path if Content-Disposition was not present
    if suggested_filename.is_none() {
        suggested_filename = extract_filename_from_url(&redirect_url);
    }

    ResponseProbeInfo {
        total_bytes,
        etag,
        last_modified,
        mime_type,
        accept_ranges,
        redirect_url,
        supports_range,
        suggested_filename,
    }
}
