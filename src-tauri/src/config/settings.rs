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
    #[serde(default)]
    pub hide_region_blocked: bool,
    #[serde(default)]
    pub show_only_verified: bool,
    #[serde(default)]
    pub groq_api_key: Option<String>,
    #[serde(default)]
    pub ai_api_key: Option<String>,
    #[serde(default)]
    pub ai_provider: Option<String>,
    #[serde(default)]
    pub ai_model: Option<String>,
    #[serde(default)]
    pub ai_endpoint: Option<String>,
    #[serde(default)]
    pub ai_brain_enabled: bool,
    #[serde(default)]
    pub custom_upstream_sources: Vec<String>,
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
            hide_region_blocked: false,
            show_only_verified: false,
            groq_api_key: None,
            ai_api_key: None,
            ai_provider: None,
            ai_model: None,
            ai_endpoint: None,
            ai_brain_enabled: false,
            custom_upstream_sources: Vec::new(),
        }
    }
}

impl AppSettings {
    pub fn config_path() -> PathBuf {
        let dir = dirs::config_dir()
            .or_else(dirs::data_dir)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(APP_NAME);
        let _ = fs::create_dir_all(&dir);
        dir.join("settings.json")
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
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| ConfigError::WriteFailed(e.to_string()))?;
        }
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| ConfigError::WriteFailed(e.to_string()))?;
        fs::write(&path, content).map_err(|e| ConfigError::WriteFailed(e.to_string()))?;
        Ok(())
    }
}
