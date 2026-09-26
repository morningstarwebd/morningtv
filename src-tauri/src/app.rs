// src/app.rs
// Central Application State Coordinator for Tauri backend

use crate::config::AppSettings;
use crate::domain::{Channel, ChannelId, QualityTier};
use crate::error::AppResult;
use crate::network::{AdaptiveBitrateController, BandwidthMonitor, ResilientHttpClient};
use crate::playlist::{ChannelFilter, PlaylistFetcher};
use crate::storage::{Database, FavoritesRepository, HistoryRepository};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub settings: AppSettings,
    pub all_channels: Vec<Channel>,
    pub filtered_channels: Vec<Channel>,
    pub categories: Vec<String>,
    pub active_category: String,
    pub search_query: String,
    pub active_channel_id: Option<String>,
    pub favorites_repo: FavoritesRepository,
    pub history_repo: HistoryRepository,
    pub bandwidth_monitor: BandwidthMonitor,
    pub adaptive_controller: AdaptiveBitrateController,
}

pub type SharedAppState = Arc<Mutex<AppState>>;

impl AppState {
    pub fn new() -> AppResult<Self> {
        let settings = AppSettings::load();
        let db = Database::open().unwrap_or_else(|_| Database::open_in_memory().unwrap());
        let favorites_repo = FavoritesRepository::new(db.clone());
        let history_repo = HistoryRepository::new(db);

        Ok(Self {
            settings,
            all_channels: Vec::new(),
            filtered_channels: Vec::new(),
            categories: vec!["All".to_string(), "Favorites".to_string()],
            active_category: "All".to_string(),
            search_query: String::new(),
            active_channel_id: None,
            favorites_repo,
            history_repo,
            bandwidth_monitor: BandwidthMonitor::new(),
            adaptive_controller: AdaptiveBitrateController::new(),
        })
    }

    pub async fn load_playlist(&mut self, source: &str) -> AppResult<()> {
        let client = ResilientHttpClient::new()?;
        let fetcher = PlaylistFetcher::new(client);

        let mut channels = match fetcher.load(source).await {
            Ok(ch) if !ch.is_empty() => ch,
            _ => {
                if let Ok(ch) = fetcher.load("assets/channels.m3u").await {
                    if !ch.is_empty() {
                        ch
                    } else {
                        fetcher.load("../assets/channels.m3u").await.unwrap_or_default()
                    }
                } else if let Ok(ch) = fetcher.load("../assets/channels.m3u").await {
                    ch
                } else {
                    Vec::new()
                }
            }
        };

        // Populate favorites state
        if let Ok(favorite_ids) = self.favorites_repo.get_all_ids() {
            for ch in &mut channels {
                if favorite_ids.contains(&ch.id.0) {
                    ch.is_favorite = true;
                }
            }
        }

        self.categories = ChannelFilter::extract_categories(&channels);
        self.all_channels = channels;
        self.refresh_filtered_channels();
        Ok(())
    }

    pub fn refresh_filtered_channels(&mut self) {
        self.filtered_channels = ChannelFilter::filter_channels(
            &self.all_channels,
            &self.active_category,
            &self.search_query,
        );
    }

    pub fn toggle_favorite(&mut self, channel_id: &str) -> bool {
        let id = ChannelId::new(channel_id);
        let mut new_fav_state = false;

        for ch in &mut self.all_channels {
            if ch.id.0 == channel_id {
                let current_name = ch.name.clone();
                if let Ok(is_fav) = self.favorites_repo.toggle(&id, &current_name) {
                    ch.is_favorite = is_fav;
                    new_fav_state = is_fav;
                }
                break;
            }
        }

        self.refresh_filtered_channels();
        new_fav_state
    }

    pub fn set_active_channel(&mut self, channel_id: &str) -> Option<Channel> {
        let found = self.all_channels.iter().find(|c| c.id.0 == channel_id).cloned();
        if let Some(ref ch) = found {
            self.active_channel_id = Some(channel_id.to_string());
            let _ = self.history_repo.record_play(ch);
        }
        found
    }

    pub fn cycle_quality(&mut self) -> QualityTier {
        let next_tier = match self.settings.preferred_quality {
            QualityTier::Auto => QualityTier::UltraLow,
            QualityTier::UltraLow => QualityTier::Low,
            QualityTier::Low => QualityTier::Medium,
            QualityTier::Medium => QualityTier::High,
            QualityTier::High => QualityTier::Auto,
        };

        self.settings.preferred_quality = next_tier;
        let _ = self.settings.save();
        next_tier
    }
}
