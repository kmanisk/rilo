use crate::core::downloaditem::DownloadItemModel;
use rusqlite::{params, Connection, Result};

pub fn get_all_downloads(conn: &Connection) -> Result<Vec<DownloadItemModel>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, url, redirect_url, save_path, total_bytes, downloaded_bytes, status, created_at, updated_at, completed_at, threads, etag, last_modified, mime_type, accept_ranges, resumable, retry_count 
         FROM downloads ORDER BY created_at DESC",
    )?;

    let records = stmt
        .query_map([], |row| {
            let total: i64 = row.get(5)?;
            let downloaded: i64 = row.get(6)?;
            let threads_val: u32 = row.get(11).unwrap_or(4);
            let resumable_val: i32 = row.get(16).unwrap_or(1);
            let retries_val: u32 = row.get(17).unwrap_or(0);
            Ok(DownloadItemModel {
                id: row.get(0)?,
                filename: row.get(1)?,
                url: row.get(2)?,
                redirect_url: row.get(3).unwrap_or_default(),
                save_path: row.get(4)?,
                total_bytes: total as u64,
                downloaded_bytes: downloaded as u64,
                status: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9).unwrap_or_default(),
                completed_at: row.get(10).unwrap_or_default(),
                threads: threads_val,
                etag: row.get(12).unwrap_or_default(),
                last_modified: row.get(13).unwrap_or_default(),
                mime_type: row.get(14).unwrap_or_default(),
                accept_ranges: row.get(15).unwrap_or_default(),
                resumable: resumable_val != 0,
                retry_count: retries_val,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(records)
}

pub fn update_download_url_in_db(conn: &Connection, id: &str, new_url: &str) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string());
    conn.execute(
        "UPDATE downloads SET url = ?1, redirect_url = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_url, now, id],
    )?;
    Ok(())
}
