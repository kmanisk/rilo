use rusqlite::{Connection, Result};

pub fn initialize_schema(conn: &Connection) -> Result<()> {
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

    let _ = conn.execute(
        "UPDATE downloads SET status = 'Paused' WHERE status = 'Downloading' OR status = 'Queued' OR status = 'Reconnecting'",
        [],
    );

    Ok(())
}
