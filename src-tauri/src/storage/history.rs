// src/storage/history.rs
// SQLite repository for playback history

use crate::domain::Channel;
use crate::error::{StorageError, StorageResult};
use crate::storage::db::Database;
use rusqlite::params;

pub struct HistoryRepository {
    db: Database,
}

impl HistoryRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn record_play(&self, channel: &Channel) -> StorageResult<()> {
        let conn = self.db.conn();
        let guard = conn.lock().unwrap();

        guard
            .execute(
                "INSERT INTO history (channel_id, channel_name, channel_url, last_played)
                 VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                 ON CONFLICT(channel_id) DO UPDATE SET
                 last_played = CURRENT_TIMESTAMP,
                 channel_name = excluded.channel_name,
                 channel_url = excluded.channel_url",
                params![channel.id.0, channel.name, channel.url],
            )
            .map_err(StorageError::Sqlite)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_last_played_id(&self) -> StorageResult<Option<String>> {
        let conn = self.db.conn();
        let guard = conn.lock().unwrap();

        let mut stmt = guard
            .prepare("SELECT channel_id FROM history ORDER BY last_played DESC LIMIT 1")
            .map_err(StorageError::Sqlite)?;

        let mut rows = stmt.query([]).map_err(StorageError::Sqlite)?;
        if let Some(row) = rows.next().map_err(StorageError::Sqlite)? {
            let id: String = row.get(0).map_err(StorageError::Sqlite)?;
            Ok(Some(id))
        } else {
            Ok(None)
        }
    }
}
