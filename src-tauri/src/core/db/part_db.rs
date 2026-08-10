use rusqlite::Result;

pub fn initialize_part_table(conn: &rusqlite::Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS download_parts (
            download_id TEXT NOT NULL,
            part_index INTEGER NOT NULL,
            start_byte INTEGER NOT NULL,
            end_byte INTEGER NOT NULL,
            downloaded_bytes INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (download_id, part_index)
        )",
        [],
    )?;
    Ok(())
}
