// src/app.rs
// Central Application State Coordinator for Tauri backend

use crate::config::AppSettings;
use crate::domain::{Channel, ChannelId, QualityTier};
use crate::error::AppResult;
use crate::network::ResilientHttpClient;
use crate::playlist::{ChannelFilter, PlaylistFetcher};
use crate::storage::{ChannelCacheRepository, Database, FavoritesRepository, HistoryRepository};
use std::sync::Arc;
use tokio::sync::RwLock;

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
    pub channel_cache_repo: ChannelCacheRepository,
    pub last_synced_at: Option<String>,
}

pub type SharedAppState = Arc<RwLock<AppState>>;

impl AppState {
    pub fn new() -> AppResult<Self> {
        let settings = AppSettings::load();
        let db = match Database::open() {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("Failed to open persistent SQLite database ({}). Falling back to in-memory store.", e);
                Database::open_in_memory()?
            }
        };
        let favorites_repo = FavoritesRepository::new(db.clone());
        let history_repo = HistoryRepository::new(db.clone());
        let channel_cache_repo = ChannelCacheRepository::new(db);

        let last_synced_at = channel_cache_repo.get_last_synced_at().unwrap_or(None);

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
            channel_cache_repo,
            last_synced_at,
        })
    }

    pub async fn load_playlist(&mut self, source: &str) -> AppResult<()> {
        // ── STEP 0: Check if GitHub master playlist was updated by remote Sentinel bot ──
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .ok();

        let mut force_remote = false;
        if let Some(ref c) = http_client {
            let local_synced = self.channel_cache_repo.get_last_synced_at().ok().flatten();
            if let Some(remote_ts) =
                crate::network::ClientSentinel::check_remote_update_needed(c, local_synced.as_deref()).await
            {
                tracing::info!(
                    remote_ts = %remote_ts,
                    "Remote GitHub playlist updated by bot. Synchronizing fresh streams..."
                );
                force_remote = true;
            }
        }

        // ── STEP A: SQLite cache check (bypassed if remote bot published newer update) ──
        let cache_max_age = 6 * 3600; // 6 hours in seconds

        if !force_remote && self.channel_cache_repo.is_fresh(cache_max_age) {
            if let Ok(cached) = self.channel_cache_repo.load_all() {
                if cached.len() > 500 {
                    // Loaded from cache: populate favorites
                    let mut channels = cached;
                    if let Ok(fav_ids) = self.favorites_repo.get_all_ids() {
                        for ch in &mut channels {
                            ch.is_favorite = fav_ids.contains(&ch.id.0);
                        }
                    }
                    self.categories = ChannelFilter::extract_categories(&channels);
                    self.all_channels = channels;
                    self.refresh_filtered_channels();

                    // Pre-cache logos and spawn local ISP audit if due (>12h)
                    self.spawn_background_optimizations();

                    return Ok(()); // Cache hit: network call bypassed
                }
            }
        }

        // Step B: Cache miss or remote update available, fetch from GitHub or remote source
        let client = ResilientHttpClient::new()?;
        let fetcher = PlaylistFetcher::new(client);

        let mut channels = match fetcher.load(source).await {
            Ok(ch) if !ch.is_empty() => ch,
            _ => {
                if source != crate::config::defaults::DEFAULT_PLAYLIST_URL {
                    fetcher
                        .load(crate::config::defaults::DEFAULT_PLAYLIST_URL)
                        .await
                        .unwrap_or_default()
                } else {
                    Vec::new()
                }
            }
        };

        // Populate favorites state
        if let Ok(fav_ids) = self.favorites_repo.get_all_ids() {
            for ch in &mut channels {
                ch.is_favorite = fav_ids.contains(&ch.id.0);
            }
        }

        self.categories = ChannelFilter::extract_categories(&channels);
        self.all_channels = channels;
        self.refresh_filtered_channels();

        // ── STEP C: Save to SQLite cache ──
        let _ = self.channel_cache_repo.save_all(&self.all_channels);
        let now_str = chrono::Utc::now().to_rfc3339();
        let _ = self.channel_cache_repo.set_last_synced_at(&now_str);
        self.last_synced_at = Some(now_str);

        // Pre-cache logos and spawn local ISP audit for newly synced streams
        self.spawn_background_optimizations();

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
        if let Err(e) = self.settings.save() {
            tracing::warn!("Failed to persist settings after quality cycle: {}", e);
        }
        next_tier
    }

    /// Spawns incremental logo disk pre-caching and background ISP stream auditing
    pub fn spawn_background_optimizations(&self) {
        // 1. Pre-cache logos for top 250 channels (Favorites first, then others)
        let mut logo_targets: Vec<(String, String)> = self
            .all_channels
            .iter()
            .filter(|c| c.is_favorite)
            .filter_map(|c| c.logo.as_ref().map(|l| (l.clone(), c.name.clone())))
            .collect();

        for ch in &self.all_channels {
            if logo_targets.len() >= 250 {
                break;
            }
            if let Some(ref l) = ch.logo {
                if !logo_targets.iter().any(|(url, _)| url == l) {
                    logo_targets.push((l.clone(), ch.name.clone()));
                }
            }
        }

        crate::storage::logo_cache::spawn_precache_worker(logo_targets);

        // 2. Check if local ISP network audit is due (>12 hours)
        let needs_local_audit = match self.channel_cache_repo.get_last_local_verified_at() {
            Ok(Some(ts)) => {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ts) {
                    chrono::Utc::now()
                        .signed_duration_since(dt.with_timezone(&chrono::Utc))
                        .num_hours()
                        >= 12
                } else {
                    true
                }
            }
            _ => true,
        };

        if needs_local_audit {
            let audit_candidates: Vec<Channel> = self
                .all_channels
                .iter()
                .filter(|c| c.is_favorite || c.group.to_lowercase().contains("india") || !c.fallback_urls.is_empty())
                .take(150)
                .cloned()
                .collect();

            if !audit_candidates.is_empty() {
                crate::network::ClientSentinel::spawn_local_audit(
                    audit_candidates,
                    std::sync::Arc::new(self.channel_cache_repo.clone()),
                    150,
                );
            }
        }
    }

    /// Just-in-time self-healing for failing or buffering channels
    pub async fn heal_channel(&mut self, channel_id: &str) -> Option<Channel> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
            .ok()?;

        let repo = self.channel_cache_repo.clone();

        let mut healed_channel = None;
        for ch in &mut self.all_channels {
            if ch.id.0 == channel_id {
                let healed =
                    crate::network::ClientSentinel::heal_single_channel(&client, ch, &repo, &self.settings).await;
                if healed {
                    healed_channel = Some(ch.clone());
                }
                break;
            }
        }

        if let Some(ch) = healed_channel {
            self.refresh_filtered_channels();
            Some(ch)
        } else {
            None
        }
    }

    /// Truncates SQLite WAL and executes graceful database checkpointing
    pub fn checkpoint(&self) {
        self.channel_cache_repo.db().checkpoint();
    }
}
