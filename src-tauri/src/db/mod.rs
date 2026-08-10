use crate::models::DownloadRecord;
use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn init(db_path: &Path) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(db_path)?;
        Self::setup_tables(conn)
    }

    pub fn init_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::setup_tables(conn)
    }

    fn setup_tables(conn: Connection) -> Result<Self> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                url TEXT NOT NULL,
                redirect_url TEXT NOT NULL DEFAULT '',
                save_path TEXT NOT NULL,
                total_bytes INTEGER NOT NULL DEFAULT 0,
                downloaded_bytes INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                completed_at TEXT NOT NULL DEFAULT '',
                threads INTEGER NOT NULL DEFAULT 4,
                etag TEXT NOT NULL DEFAULT '',
                last_modified TEXT NOT NULL DEFAULT '',
                mime_type TEXT NOT NULL DEFAULT '',
                accept_ranges TEXT NOT NULL DEFAULT '',
                resumable INTEGER NOT NULL DEFAULT 1,
                retry_count INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Auto-migration for columns
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN redirect_url TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN completed_at TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN threads INTEGER NOT NULL DEFAULT 4", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN etag TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN last_modified TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN mime_type TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN accept_ranges TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN resumable INTEGER NOT NULL DEFAULT 1", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN auto_extract INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN extract_dir TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN delete_archive_after_extract INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE downloads ADD COLUMN extraction_state TEXT NOT NULL DEFAULT 'Pending'", []);

        // Normalize unfinished downloads from previous sessions to 'Paused'
        let _ = conn.execute(
            "UPDATE downloads SET status = 'Paused' WHERE status = 'Downloading' OR status = 'Queued' OR status = 'Reconnecting'",
            [],
        );

        // Normalize interrupted extractions on restart
        let _ = conn.execute(
            "UPDATE downloads SET extraction_state = 'ExtractionFailed' WHERE extraction_state = 'Extracting'",
            [],
        );

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn lock_conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.lock_conn();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn insert_or_update(&self, record: &DownloadRecord) -> Result<()> {
        let conn = self.lock_conn();
        conn.execute(
            "INSERT INTO downloads (id, filename, url, redirect_url, save_path, total_bytes, downloaded_bytes, status, created_at, updated_at, completed_at, threads, etag, last_modified, mime_type, accept_ranges, resumable, retry_count, auto_extract, extract_dir, delete_archive_after_extract, extraction_state)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)
             ON CONFLICT(id) DO UPDATE SET
                filename = excluded.filename,
                url = excluded.url,
                redirect_url = excluded.redirect_url,
                save_path = excluded.save_path,
                total_bytes = excluded.total_bytes,
                downloaded_bytes = excluded.downloaded_bytes,
                status = excluded.status,
                updated_at = excluded.updated_at,
                completed_at = excluded.completed_at,
                threads = excluded.threads,
                etag = excluded.etag,
                last_modified = excluded.last_modified,
                mime_type = excluded.mime_type,
                accept_ranges = excluded.accept_ranges,
                resumable = excluded.resumable,
                retry_count = excluded.retry_count,
                auto_extract = excluded.auto_extract,
                extract_dir = excluded.extract_dir,
                delete_archive_after_extract = excluded.delete_archive_after_extract,
                extraction_state = excluded.extraction_state;",
            params![
                record.id,
                record.filename,
                record.url,
                record.redirect_url,
                record.save_path,
                record.total_bytes as i64,
                record.downloaded_bytes as i64,
                record.status,
                record.created_at,
                record.updated_at,
                record.completed_at,
                record.threads,
                record.etag,
                record.last_modified,
                record.mime_type,
                record.accept_ranges,
                if record.resumable { 1 } else { 0 },
                record.retry_count,
                if record.auto_extract { 1 } else { 0 },
                record.extract_dir,
                if record.delete_archive_after_extract { 1 } else { 0 },
                record.extraction_state
            ],
        )?;
        Ok(())
    }

    pub fn update_progress(&self, id: &str, downloaded_bytes: u64, total_bytes: u64, status: &str) -> Result<()> {
        let conn = self.lock_conn();
        let now = chrono_now();
        let completed_at = if status == "Completed" { now.clone() } else { String::new() };

        conn.execute(
            "UPDATE downloads SET downloaded_bytes = ?1, total_bytes = ?2, status = ?3, updated_at = ?4, completed_at = CASE WHEN ?5 != '' THEN ?5 ELSE completed_at END WHERE id = ?6",
            params![downloaded_bytes as i64, total_bytes as i64, status, now, completed_at, id],
        )?;
        Ok(())
    }

    pub fn update_extraction_config(&self, id: &str, auto_extract: bool, extract_dir: &str, delete_after: bool) -> Result<()> {
        let conn = self.lock_conn();
        let now = chrono_now();
        conn.execute(
            "UPDATE downloads SET auto_extract = ?1, extract_dir = ?2, delete_archive_after_extract = ?3, updated_at = ?4 WHERE id = ?5",
            params![if auto_extract { 1 } else { 0 }, extract_dir, if delete_after { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn update_extraction_state(&self, id: &str, state: &str) -> Result<()> {
        let conn = self.lock_conn();
        let now = chrono_now();
        conn.execute(
            "UPDATE downloads SET extraction_state = ?1, updated_at = ?2 WHERE id = ?3",
            params![state, now, id],
        )?;
        Ok(())
    }

    pub fn update_metadata(&self, id: &str, redirect_url: &str, etag: &str, last_modified: &str, mime_type: &str, accept_ranges: &str, resumable: bool) -> Result<()> {
        let conn = self.lock_conn();
        let now = chrono_now();
        conn.execute(
            "UPDATE downloads SET redirect_url = ?1, etag = ?2, last_modified = ?3, mime_type = ?4, accept_ranges = ?5, resumable = ?6, updated_at = ?7 WHERE id = ?8",
            params![redirect_url, etag, last_modified, mime_type, accept_ranges, if resumable { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn update_retry_count(&self, id: &str, retries: u32) -> Result<()> {
        let conn = self.lock_conn();
        conn.execute("UPDATE downloads SET retry_count = ?1 WHERE id = ?2", params![retries, id])?;
        Ok(())
    }

    pub fn update_url(&self, id: &str, new_url: &str) -> Result<()> {
        let conn = self.lock_conn();
        let now = chrono_now();
        conn.execute("UPDATE downloads SET url = ?1, redirect_url = ?1, updated_at = ?2 WHERE id = ?3", params![new_url, now, id])?;
        Ok(())
    }

    pub fn update_filename(&self, id: &str, filename: &str, save_path: &str) -> Result<()> {
        let conn = self.lock_conn();
        let now = chrono_now();
        conn.execute(
            "UPDATE downloads SET filename = ?1, save_path = ?2, updated_at = ?3 WHERE id = ?4",
            params![filename, save_path, now, id],
        )?;
        Ok(())
    }

    pub fn get_all(&self) -> Result<Vec<DownloadRecord>> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare(
            "SELECT id, filename, url, redirect_url, save_path, total_bytes, downloaded_bytes, status, created_at, updated_at, completed_at, threads, etag, last_modified, mime_type, accept_ranges, resumable, retry_count, auto_extract, extract_dir, delete_archive_after_extract, extraction_state 
             FROM downloads ORDER BY created_at DESC",
        )?;

        let records = stmt
            .query_map([], |row| {
                let total: i64 = row.get(5)?;
                let downloaded: i64 = row.get(6)?;
                let threads_val: u32 = row.get(11).unwrap_or(4);
                let resumable_val: i32 = row.get(16).unwrap_or(1);
                let retries_val: u32 = row.get(17).unwrap_or(0);
                let auto_ext_val: i32 = row.get(18).unwrap_or(0);
                let del_after_val: i32 = row.get(20).unwrap_or(0);
                Ok(DownloadRecord {
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
                    auto_extract: auto_ext_val != 0,
                    extract_dir: row.get(19).unwrap_or_default(),
                    delete_archive_after_extract: del_after_val != 0,
                    extraction_state: row.get(21).unwrap_or_else(|_| "Pending".to_string()),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(records)
    }

    pub fn get_by_id(&self, id: &str) -> Result<Option<DownloadRecord>> {
        let conn = self.lock_conn();
        let mut stmt = conn.prepare(
            "SELECT id, filename, url, redirect_url, save_path, total_bytes, downloaded_bytes, status, created_at, updated_at, completed_at, threads, etag, last_modified, mime_type, accept_ranges, resumable, retry_count, auto_extract, extract_dir, delete_archive_after_extract, extraction_state 
             FROM downloads WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let total: i64 = row.get(5)?;
            let downloaded: i64 = row.get(6)?;
            let threads_val: u32 = row.get(11).unwrap_or(4);
            let resumable_val: i32 = row.get(16).unwrap_or(1);
            let retries_val: u32 = row.get(17).unwrap_or(0);
            let auto_ext_val: i32 = row.get(18).unwrap_or(0);
            let del_after_val: i32 = row.get(20).unwrap_or(0);
            Ok(Some(DownloadRecord {
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
                auto_extract: auto_ext_val != 0,
                extract_dir: row.get(19).unwrap_or_default(),
                delete_archive_after_extract: del_after_val != 0,
                extraction_state: row.get(21).unwrap_or_else(|_| "Pending".to_string()),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let conn = self.lock_conn();
        conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
        Ok(())
    }
}

fn chrono_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_settings_roundtrip() {
        let db = Database::init_in_memory().expect("Failed in-memory DB init");
        db.save_setting("theme", "dark").expect("Save failed");
        db.save_setting("max_connections", "8").expect("Save failed");

        let theme = db.get_setting("theme").expect("Query failed");
        assert_eq!(theme, Some("dark".to_string()));

        let conn_count = db.get_setting("max_connections").expect("Query failed");
        assert_eq!(conn_count, Some("8".to_string()));
    }

    #[test]
    fn test_db_downloads_crud() {
        let db = Database::init_in_memory().expect("Failed in-memory DB init");
        let rec = DownloadRecord {
            id: "dl_test_1".to_string(),
            filename: "ubuntu.iso".to_string(),
            url: "https://example.com/ubuntu.iso".to_string(),
            redirect_url: "https://example.com/ubuntu.iso".to_string(),
            save_path: "/downloads/ubuntu.iso".to_string(),
            total_bytes: 100000,
            downloaded_bytes: 50000,
            status: "Downloading".to_string(),
            created_at: "1000".to_string(),
            updated_at: "1000".to_string(),
            completed_at: "".to_string(),
            threads: 4,
            etag: "abc".to_string(),
            last_modified: "def".to_string(),
            mime_type: "application/x-iso".to_string(),
            accept_ranges: "bytes".to_string(),
            resumable: true,
            retry_count: 0,
            auto_extract: false,
            extract_dir: "".to_string(),
            delete_archive_after_extract: false,
            extraction_state: "Pending".to_string(),
        };

        db.insert_or_update(&rec).expect("Insert failed");

        let queried = db.get_by_id("dl_test_1").expect("Query failed");
        assert!(queried.is_some());
        let item = queried.unwrap();
        assert_eq!(item.filename, "ubuntu.iso");
        assert_eq!(item.downloaded_bytes, 50000);

        db.update_progress("dl_test_1", 100000, 100000, "Completed").expect("Update progress failed");
        let updated = db.get_by_id("dl_test_1").expect("Query failed").unwrap();
        assert_eq!(updated.status, "Completed");
        assert_eq!(updated.downloaded_bytes, 100000);

        db.delete("dl_test_1").expect("Delete failed");
        let deleted = db.get_by_id("dl_test_1").expect("Query failed");
        assert!(deleted.is_none());
    }
}
