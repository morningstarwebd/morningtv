// src/config/settings.rs
// User settings and persistent configuration

use crate::config::defaults::*;
use crate::domain::QualityTier;
use crate::error::{AppResult, ConfigError};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub playlist_url: String,
    pub volume: i64,
    pub is_muted: bool,
    pub preferred_quality: QualityTier,
    pub auto_adaptive_bitrate: bool,
    pub cache_duration_secs: u32,
    pub last_played_channel_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            playlist_url: DEFAULT_PLAYLIST_URL.to_string(),
            volume: DEFAULT_VOLUME,
            is_muted: false,
            preferred_quality: QualityTier::Auto,
            auto_adaptive_bitrate: true,
            cache_duration_secs: DEFAULT_CACHE_SECS,
            last_played_channel_id: None,
        }
    }
}

impl AppSettings {
    pub fn config_path() -> PathBuf {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let dir = PathBuf::from(appdata).join(APP_NAME);
            let _ = fs::create_dir_all(&dir);
            dir.join("settings.json")
        } else {
            PathBuf::from("settings.json")
        }
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                    return settings;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> AppResult<()> {
        let path = Self::config_path();
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| ConfigError::WriteFailed(e.to_string()))?;
        fs::write(&path, content).map_err(|e| ConfigError::WriteFailed(e.to_string()))?;
        Ok(())
    }
}
