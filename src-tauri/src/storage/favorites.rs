// src/storage/favorites.rs
// SQLite repository for user favorite channels

use crate::domain::ChannelId;
use crate::error::{StorageError, StorageResult};
use crate::storage::db::Database;
use rusqlite::params;
use std::collections::HashSet;

pub struct FavoritesRepository {
    db: Database,
}

impl FavoritesRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_all_ids(&self) -> StorageResult<HashSet<String>> {
        let conn = self.db.conn();
        let guard = conn.lock().unwrap();
        let mut stmt = guard
            .prepare("SELECT channel_id FROM favorites")
            .map_err(StorageError::Sqlite)?;

        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(StorageError::Sqlite)?;

        let mut set = HashSet::new();
        for id in rows.flatten() {
            set.insert(id);
        }
        Ok(set)
    }

    pub fn toggle(&self, channel_id: &ChannelId, channel_name: &str) -> StorageResult<bool> {
        let conn = self.db.conn();
        let guard = conn.lock().unwrap();

        let exists: bool = guard
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM favorites WHERE channel_id = ?1)",
                params![channel_id.0],
                |row| row.get(0),
            )
            .map_err(StorageError::Sqlite)?;

        if exists {
            guard
                .execute("DELETE FROM favorites WHERE channel_id = ?1", params![channel_id.0])
                .map_err(StorageError::Sqlite)?;
            Ok(false)
        } else {
            guard
                .execute(
                    "INSERT INTO favorites (channel_id, channel_name) VALUES (?1, ?2)",
                    params![channel_id.0, channel_name],
                )
                .map_err(StorageError::Sqlite)?;
            Ok(true)
        }
    }
}
