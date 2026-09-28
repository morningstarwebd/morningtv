// src/storage/channel_cache.rs
// SQLite persistent storage repository for IPTV channels caching

use crate::domain::Channel;
use crate::error::{StorageError, StorageResult};
use crate::storage::Database;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct ChannelCacheRepository {
    db: Database,
}

impl ChannelCacheRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Channel list সম্পূর্ণ replace করে SQLite-এ save করো (atomic transaction)
    pub fn save_all(&self, channels: &[Channel]) -> StorageResult<()> {
        let conn_arc = self.db.conn();
        let mut conn = conn_arc.lock().unwrap();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let tx = conn.transaction().map_err(StorageError::Sqlite)?;

        tx.execute("DELETE FROM channels_cache", [])
            .map_err(StorageError::Sqlite)?;

        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO channels_cache
                 (id, name, url, group_title, logo, fallbacks, provider, cached_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                )
                .map_err(StorageError::Sqlite)?;

            for ch in channels {
                let fallbacks_json =
                    serde_json::to_string(&ch.fallback_urls).unwrap_or_else(|_| "[]".to_string());

                stmt.execute(rusqlite::params![
                    ch.id.0.as_str(),
                    ch.name,
                    ch.url,
                    ch.group,
                    ch.logo,
                    fallbacks_json,
                    ch.provider,
                    now,
                ])
                .map_err(StorageError::Sqlite)?;
            }
        }

        tx.commit().map_err(StorageError::Sqlite)?;

        Ok(())
    }

    /// SQLite থেকে সব channel load করো
    pub fn load_all(&self) -> StorageResult<Vec<Channel>> {
        let conn_arc = self.db.conn();
        let conn = conn_arc.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, url, group_title, logo, fallbacks, provider
             FROM channels_cache ORDER BY rowid",
            )
            .map_err(StorageError::Sqlite)?;

        let channels = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let url: String = row.get(2)?;
                let group: String = row.get(3)?;
                let logo: Option<String> = row.get(4)?;
                let fallbacks_json: String = row
                    .get::<_, String>(5)
                    .unwrap_or_else(|_| "[]".to_string());
                let provider: Option<String> = row.get(6)?;

                let fallback_urls: Vec<String> =
                    serde_json::from_str(&fallbacks_json).unwrap_or_default();

                Ok(Channel {
                    id: crate::domain::ChannelId(id),
                    name,
                    url,
                    group,
                    logo,
                    fallback_urls,
                    provider,
                    http_user_agent: None,
                    http_referrer: None,
                    is_favorite: false,
                })
            })
            .map_err(StorageError::Sqlite)?;

        channels
            .collect::<Result<Vec<_>, _>>()
            .map_err(StorageError::Sqlite)
    }

    /// Cache কি এখনো fresh? max_age_secs এর মধ্যে আছে?
    pub fn is_fresh(&self, max_age_secs: u64) -> bool {
        let conn_arc = self.db.conn();
        let conn = conn_arc.lock().unwrap();
        let result: rusqlite::Result<i64> = conn.query_row(
            "SELECT cached_at FROM channels_cache ORDER BY rowid LIMIT 1",
            [],
            |row| row.get(0),
        );

        match result {
            Ok(cached_at) => {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;
                (now - cached_at) < max_age_secs as i64
            }
            Err(_) => false, // table empty = not fresh
        }
    }

    /// Cache count: returns total number of cached channels
    pub fn count(&self) -> usize {
        let conn_arc = self.db.conn();
        let conn = conn_arc.lock().unwrap();
        conn.query_row("SELECT COUNT(*) FROM channels_cache", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap_or(0) as usize
    }

    /// Cache wipe
    pub fn clear(&self) -> StorageResult<()> {
        let conn_arc = self.db.conn();
        let conn = conn_arc.lock().unwrap();
        conn.execute("DELETE FROM channels_cache", [])
            .map_err(StorageError::Sqlite)?;
        Ok(())
    }
}
