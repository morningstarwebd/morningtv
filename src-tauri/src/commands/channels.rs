// src/commands/channels.rs
// Tauri IPC command handlers for channels, categories, search, and favorites

use crate::app::SharedAppState;
use crate::domain::Channel;
use tauri::State;

#[tauri::command]
pub async fn get_channels(state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let mut guard = state.lock().await;
    if guard.all_channels.is_empty() {
        let playlist_url = guard.settings.playlist_url.clone();
        let _ = guard.load_playlist(&playlist_url).await;
    }
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn get_categories(state: State<'_, SharedAppState>) -> Result<Vec<String>, String> {
    let mut guard = state.lock().await;
    if guard.all_channels.is_empty() {
        let playlist_url = guard.settings.playlist_url.clone();
        let _ = guard.load_playlist(&playlist_url).await;
    }
    Ok(guard.categories.clone())
}

#[tauri::command]
pub async fn select_channel(id: String, state: State<'_, SharedAppState>) -> Result<Option<Channel>, String> {
    let mut guard = state.lock().await;
    Ok(guard.set_active_channel(&id))
}

#[tauri::command]
pub async fn toggle_favorite(id: String, state: State<'_, SharedAppState>) -> Result<bool, String> {
    let mut guard = state.lock().await;
    Ok(guard.toggle_favorite(&id))
}

#[tauri::command]
pub async fn set_category(category: String, state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let mut guard = state.lock().await;
    guard.active_category = category;
    guard.refresh_filtered_channels();
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn search_channels(query: String, state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let mut guard = state.lock().await;
    guard.search_query = query;
    guard.refresh_filtered_channels();
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn load_playlist(url: String, state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    {
        let mut guard = state.lock().await;
        guard.settings.playlist_url = url.clone();
        let _ = guard.settings.save();
    }

    let mut guard = state.lock().await;
    guard.load_playlist(&url).await.map_err(|e| e.to_string())?;
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn reset_playlist(state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let default_url = crate::config::defaults::DEFAULT_PLAYLIST_URL.to_string();
    let cache_file = crate::playlist::PlaylistFetcher::cache_path();
    if cache_file.exists() {
        let _ = std::fs::remove_file(cache_file);
    }
    {
        let mut guard = state.lock().await;
        guard.settings.playlist_url = default_url.clone();
        let _ = guard.settings.save();
    }

    let mut guard = state.lock().await;
    guard.load_playlist(&default_url).await.map_err(|e| e.to_string())?;
    Ok(guard.filtered_channels.clone())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VerificationSummary {
    pub total_scanned: usize,
    pub alive_channels: usize,
    pub dead_channels_removed: usize,
    pub links_auto_updated: usize,
}

#[tauri::command]
pub async fn verify_and_clean_channels(
    state: State<'_, SharedAppState>,
) -> Result<VerificationSummary, String> {
    let channels_to_verify = {
        let guard = state.lock().await;
        guard.all_channels.clone()
    };

    let total = channels_to_verify.len();
    if total == 0 {
        return Ok(VerificationSummary {
            total_scanned: 0,
            alive_channels: 0,
            dead_channels_removed: 0,
            links_auto_updated: 0,
        });
    }

    let validator = crate::playlist::StreamValidator::new();
    let (alive, dead_count, updated_count) = validator.verify_channels_parallel(channels_to_verify, 35).await;

    {
        let mut guard = state.lock().await;
        guard.all_channels = alive.clone();
        guard.categories = crate::playlist::ChannelFilter::extract_categories(&alive);
        guard.refresh_filtered_channels();

        // Update local cache with verified alive channels
        let cache_file = crate::playlist::PlaylistFetcher::cache_path();
        if let Some(parent) = cache_file.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut m3u_text = String::from("#EXTM3U\n");
        for ch in &alive {
            m3u_text.push_str(&format!(
                "#EXTINF:-1 tvg-logo=\"{}\" group-title=\"{}\",{}\n{}\n",
                ch.logo.as_deref().unwrap_or(""),
                ch.group,
                ch.name,
                ch.url
            ));
        }
        let _ = std::fs::write(cache_file, m3u_text);
    }

    Ok(VerificationSummary {
        total_scanned: total,
        alive_channels: alive.len(),
        dead_channels_removed: dead_count,
        links_auto_updated: updated_count,
    })
}

#[tauri::command]
pub async fn check_stream_alive(url: String) -> Result<bool, String> {
    let validator = crate::playlist::StreamValidator::new();
    let res = validator.verify_stream_actual(&url).await;
    Ok(res.is_alive && res.is_actual_stream)
}
