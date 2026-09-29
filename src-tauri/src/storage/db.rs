// src/storage/db.rs
// SQLite database connection and schema migrations

use crate::config::APP_NAME;
use crate::error::{StorageError, StorageResult};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open() -> StorageResult<Self> {
        let db_path = Self::db_path();
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let conn = Connection::open(&db_path).map_err(StorageError::Sqlite)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> StorageResult<Self> {
        let conn = Connection::open_in_memory().map_err(StorageError::Sqlite)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        Ok(db)
    }

    fn db_path() -> PathBuf {
        dirs::data_dir()
            .or_else(dirs::config_dir)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(APP_NAME)
            .join("morningtv.db")
    }

    fn migrate(&self) -> StorageResult<()> {
        let conn = self.conn.lock().map_err(|e| {
            tracing::error!(error = %e, "SQLite mutex poisoned in migrate()");
            StorageError::LockPoisoned(e.to_string())
        })?;

        // Task 7.3: PRAGMAs for high-performance WAL concurrency
        let _ = conn.execute_batch("PRAGMA journal_mode=WAL;");
        let _ = conn.execute_batch("PRAGMA busy_timeout=5000;");
        let _ = conn.execute_batch("PRAGMA synchronous=NORMAL;");
        let _ = conn.execute_batch("PRAGMA foreign_keys=ON;");

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS favorites (
                channel_id TEXT PRIMARY KEY,
                channel_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS history (
                channel_id TEXT PRIMARY KEY,
                channel_name TEXT NOT NULL,
                channel_url TEXT NOT NULL,
                last_played DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS channels_cache (
                id              TEXT    PRIMARY KEY,
                name            TEXT    NOT NULL,
                url             TEXT    NOT NULL,
                group_title     TEXT    NOT NULL DEFAULT 'General',
                logo            TEXT,
                fallbacks       TEXT    NOT NULL DEFAULT '[]',
                provider        TEXT,
                http_user_agent TEXT,
                http_referrer   TEXT,
                cached_at       INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cache_group
                ON channels_cache(group_title);

            CREATE INDEX IF NOT EXISTS idx_cache_time
                ON channels_cache(cached_at);

            CREATE TABLE IF NOT EXISTS app_metadata (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )
        .map_err(StorageError::Sqlite)?;

        // Non-destructive column additions for existing databases
        let _ = conn.execute("ALTER TABLE channels_cache ADD COLUMN http_user_agent TEXT", []);
        let _ = conn.execute("ALTER TABLE channels_cache ADD COLUMN http_referrer TEXT", []);

        Ok(())
    }

    pub fn conn(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.conn)
    }

    /// Flushes and truncates the SQLite write-ahead log (WAL) file cleanly
    pub fn checkpoint(&self) {
        if let Ok(conn) = self.conn.lock() {
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            tracing::info!("SQLite WAL checkpoint completed");
        }
    }
}
