// src/error.rs
// Global typed error definitions for MorningTV

#![allow(dead_code)]

use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Playlist Error: {0}")]
    Playlist(#[from] PlaylistError),

    #[error("Network Error: {0}")]
    Network(#[from] NetworkError),

    #[error("Storage Error: {0}")]
    Storage(#[from] StorageError),

    #[error("Configuration Error: {0}")]
    Config(#[from] ConfigError),

    #[error("UI Interop Error: {0}")]
    Ui(String),

    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
}


#[derive(Error, Debug)]
pub enum PlaylistError {
    #[error("Empty or invalid M3U playlist format")]
    InvalidFormat,

    #[error("Failed to parse M3U header")]
    HeaderMissing,

    #[error("Failed to download remote playlist: {0}")]
    DownloadFailed(String),

    #[error("Local playlist file not found: {0}")]
    FileNotFound(String),

    #[error("Channel not found with id: {0}")]
    ChannelNotFound(String),
}

#[derive(Error, Debug)]
pub enum NetworkError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("Stream connection timed out after {0} seconds")]
    Timeout(u64),

    #[error("Stream host unreachable: {0}")]
    Unreachable(String),

    #[error("Critical buffer underrun detected")]
    BufferUnderrun,
}

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("SQLite database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Migration failed: {0}")]
    MigrationFailed(String),

    #[error("Data serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to read settings file: {0}")]
    ReadFailed(String),

    #[error("Failed to write settings file: {0}")]
    WriteFailed(String),

    #[error("Invalid configuration value for '{0}'")]
    InvalidValue(String),
}

pub type AppResult<T> = Result<T, AppError>;
pub type PlaylistResult<T> = Result<T, PlaylistError>;
pub type NetworkResult<T> = Result<T, NetworkError>;
pub type StorageResult<T> = Result<T, StorageError>;
