// src/commands/channels.rs
// Tauri IPC command handlers for channels, categories, search, and favorites

use crate::app::SharedAppState;
use crate::domain::Channel;
use tauri::State;

#[tauri::command]
pub async fn get_channels(state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let is_empty = {
        let guard = state.read().await;
        guard.all_channels.is_empty()
    };
    if is_empty {
        let mut guard = state.write().await;
        if guard.all_channels.is_empty() {
            let playlist_url = guard.settings.playlist_url.clone();
            let _ = guard.load_playlist(&playlist_url).await;
        }
        Ok(guard.filtered_channels.clone())
    } else {
        let guard = state.read().await;
        Ok(guard.filtered_channels.clone())
    }
}

#[tauri::command]
pub async fn get_total_channel_count(state: State<'_, SharedAppState>) -> Result<usize, String> {
    let is_empty = {
        let guard = state.read().await;
        guard.all_channels.is_empty()
    };
    if is_empty {
        let mut guard = state.write().await;
        if guard.all_channels.is_empty() {
            let playlist_url = guard.settings.playlist_url.clone();
            let _ = guard.load_playlist(&playlist_url).await;
        }
        Ok(guard.all_channels.len())
    } else {
        let guard = state.read().await;
        Ok(guard.all_channels.len())
    }
}

#[tauri::command]
pub async fn get_categories(state: State<'_, SharedAppState>) -> Result<Vec<String>, String> {
    let is_empty = {
        let guard = state.read().await;
        guard.all_channels.is_empty()
    };
    if is_empty {
        let mut guard = state.write().await;
        if guard.all_channels.is_empty() {
            let playlist_url = guard.settings.playlist_url.clone();
            let _ = guard.load_playlist(&playlist_url).await;
        }
        Ok(guard.categories.clone())
    } else {
        let guard = state.read().await;
        Ok(guard.categories.clone())
    }
}

#[tauri::command]
pub async fn select_channel(id: String, state: State<'_, SharedAppState>) -> Result<Option<Channel>, String> {
    let mut guard = state.write().await;
    Ok(guard.set_active_channel(&id))
}

#[tauri::command]
pub async fn toggle_favorite(id: String, state: State<'_, SharedAppState>) -> Result<bool, String> {
    let mut guard = state.write().await;
    Ok(guard.toggle_favorite(&id))
}

#[tauri::command]
pub async fn set_category(category: String, state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let mut guard = state.write().await;
    guard.active_category = category;
    guard.refresh_filtered_channels();
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn search_channels(query: String, state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let bounded_query = if query.len() > 200 {
        query.chars().take(200).collect()
    } else {
        query
    };
    let mut guard = state.write().await;
    guard.search_query = bounded_query;
    guard.refresh_filtered_channels();
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn load_playlist(url: String, state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Playlist URL cannot be empty".to_string());
    }

    if trimmed.len() > 2048 {
        return Err("Playlist URL too long (maximum 2048 characters permitted)".to_string());
    }

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        if let Err(msg) = crate::network::proxy::validate_target_url(trimmed) {
            return Err(format!("Invalid playlist URL: {}", msg));
        }
    } else {
        let is_m3u = trimmed.ends_with(".m3u") || trimmed.ends_with(".m3u8");
        if !is_m3u || trimmed.contains("..") || trimmed.contains('\0') {
            return Err("Invalid playlist URL or path. Please provide an HTTP/HTTPS stream URL or valid .m3u file.".to_string());
        }
    }

    let mut guard = state.write().await;
    guard.settings.playlist_url = trimmed.to_string();
    if let Err(e) = guard.settings.save() {
        tracing::warn!("Failed to persist settings after playlist load: {}", e);
    }
    guard.load_playlist(trimmed).await.map_err(|e| e.to_string())?;
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn reset_playlist(state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let default_url = crate::config::defaults::DEFAULT_PLAYLIST_URL.to_string();
    let cache_file = crate::playlist::PlaylistFetcher::cache_path();
    if cache_file.exists() {
        let _ = std::fs::remove_file(cache_file);
    }

    let mut guard = state.write().await;
    let _ = guard.channel_cache_repo.clear();
    guard.settings.playlist_url = default_url.clone();
    let _ = guard.settings.save();
    guard.load_playlist(&default_url).await.map_err(|e| e.to_string())?;
    Ok(guard.filtered_channels.clone())
}

#[tauri::command]
pub async fn force_refresh_channels(
    state: State<'_, SharedAppState>,
) -> Result<Vec<Channel>, String> {
    let mut guard = state.write().await;

    // Clear cache, then perform fresh fetch
    let _ = guard.channel_cache_repo.clear();
    let url = guard.settings.playlist_url.clone();
    guard.load_playlist(&url).await.map_err(|e| e.to_string())?;

    Ok(guard.filtered_channels.clone())
}

/// Checks status.json to detect remote playlist updates
#[tauri::command]
pub async fn check_playlist_update(
    state: State<'_, SharedAppState>,
) -> Result<bool, String> {
    let last_synced = {
        let guard = state.read().await;
        guard.last_synced_at.clone()
    };

    // Fetch remote status.json
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(crate::config::defaults::STATUS_JSON_URL)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let remote_updated_at = json["updated_at"]
        .as_str()
        .unwrap_or("")
        .to_string();

    if remote_updated_at.is_empty() {
        return Ok(false);
    }

    // Check if never synced, or remote timestamp is newer
    let has_update = match &last_synced {
        None => true,
        Some(prev) => {
            if let (Ok(remote_dt), Ok(prev_dt)) = (
                chrono::DateTime::parse_from_rfc3339(&remote_updated_at),
                chrono::DateTime::parse_from_rfc3339(prev),
            ) {
                remote_dt > prev_dt
            } else {
                remote_updated_at > *prev
            }
        }
    };

    Ok(has_update)
}

/// Silently fetches fresh playlist, updates SQLite cache and in-memory channel state
#[tauri::command]
pub async fn background_refresh_playlist(
    state: State<'_, SharedAppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let url = {
        let guard = state.read().await;
        guard.settings.playlist_url.clone()
    };

    // Clear cache and perform a fresh load
    {
        let mut guard = state.write().await;
        let _ = guard.channel_cache_repo.clear();
        guard.load_playlist(&url).await.map_err(|e| e.to_string())?;

        // Save updated timestamp
        guard.last_synced_at = Some(chrono::Utc::now().to_rfc3339());
    }

    // Notify frontend of update
    use tauri::Emitter;
    app_handle
        .emit("playlist_updated", ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

