// src/error.rs
// Global typed error definitions for MorningTV

use thiserror::Error;

#[allow(dead_code)]
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


#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
#[derive(Error, Debug)]
pub enum StorageError {
    #[error("SQLite database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Migration failed: {0}")]
    MigrationFailed(String),

    #[error("Database lock poisoned: {0}")]
    LockPoisoned(String),

    #[error("Data serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[allow(dead_code)]
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to read settings file: {0}")]
    ReadFailed(String),

    #[error("Failed to write settings file: {0}")]
    WriteFailed(String),

    #[error("Invalid configuration value for '{0}'")]
    InvalidValue(String),
}

#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl std::fmt::Display for IpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.code, self.message)
    }
}

impl std::error::Error for IpcError {}

impl From<AppError> for IpcError {
    fn from(err: AppError) -> Self {
        match &err {
            AppError::Network(NetworkError::Timeout(_)) => IpcError {
                code: "NETWORK_TIMEOUT".into(),
                message: err.to_string(),
                retryable: true,
            },
            AppError::Network(NetworkError::RequestFailed(_)) => IpcError {
                code: "NETWORK_REQUEST_FAILED".into(),
                message: err.to_string(),
                retryable: true,
            },
            AppError::Network(_) => IpcError {
                code: "NETWORK_ERROR".into(),
                message: err.to_string(),
                retryable: true,
            },
            AppError::Playlist(PlaylistError::DownloadFailed(_)) => IpcError {
                code: "PLAYLIST_DOWNLOAD_FAILED".into(),
                message: err.to_string(),
                retryable: true,
            },
            AppError::Playlist(PlaylistError::InvalidFormat) => IpcError {
                code: "PLAYLIST_INVALID_FORMAT".into(),
                message: err.to_string(),
                retryable: false,
            },
            AppError::Playlist(PlaylistError::FileNotFound(_)) => IpcError {
                code: "PLAYLIST_FILE_NOT_FOUND".into(),
                message: err.to_string(),
                retryable: false,
            },
            AppError::Playlist(_) => IpcError {
                code: "PLAYLIST_ERROR".into(),
                message: err.to_string(),
                retryable: false,
            },
            AppError::Storage(StorageError::LockPoisoned(_)) => IpcError {
                code: "DATABASE_LOCK_POISONED".into(),
                message: err.to_string(),
                retryable: false,
            },
            AppError::Storage(_) => IpcError {
                code: "STORAGE_ERROR".into(),
                message: err.to_string(),
                retryable: false,
            },
            AppError::Config(_) => IpcError {
                code: "CONFIG_ERROR".into(),
                message: err.to_string(),
                retryable: false,
            },
            AppError::Ui(msg) => IpcError {
                code: "UI_ERROR".into(),
                message: msg.clone(),
                retryable: false,
            },
            AppError::Io(e) => IpcError {
                code: "IO_ERROR".into(),
                message: e.to_string(),
                retryable: true,
            },
        }
    }
}

impl From<StorageError> for IpcError {
    fn from(err: StorageError) -> Self {
        AppError::Storage(err).into()
    }
}

impl From<String> for IpcError {
    fn from(msg: String) -> Self {
        IpcError {
            code: "INTERNAL_ERROR".into(),
            message: msg,
            retryable: false,
        }
    }
}

impl From<&str> for IpcError {
    fn from(msg: &str) -> Self {
        IpcError {
            code: "INTERNAL_ERROR".into(),
            message: msg.to_string(),
            retryable: false,
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
pub type PlaylistResult<T> = Result<T, PlaylistError>;
pub type NetworkResult<T> = Result<T, NetworkError>;
pub type StorageResult<T> = Result<T, StorageError>;
