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
pub async fn get_all_channels(state: State<'_, SharedAppState>) -> Result<Vec<Channel>, String> {
    let mut guard = state.lock().await;
    if guard.all_channels.is_empty() {
        let playlist_url = guard.settings.playlist_url.clone();
        let _ = guard.load_playlist(&playlist_url).await;
    }
    Ok(guard.all_channels.clone())
}

#[tauri::command]
pub async fn get_total_channel_count(state: State<'_, SharedAppState>) -> Result<usize, String> {
    let mut guard = state.lock().await;
    if guard.all_channels.is_empty() {
        let playlist_url = guard.settings.playlist_url.clone();
        let _ = guard.load_playlist(&playlist_url).await;
    }
    Ok(guard.all_channels.len())
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
        let _ = guard.channel_cache_repo.clear();
        guard.settings.playlist_url = default_url.clone();
        let _ = guard.settings.save();
    }

    let mut guard = state.lock().await;
    guard.load_playlist(&default_url).await.map_err(|e| e.to_string())?;
    Ok(guard.filtered_channels.clone())
}


#[tauri::command]
pub async fn force_refresh_channels(
    state: State<'_, SharedAppState>,
) -> Result<Vec<Channel>, String> {
    let mut guard = state.lock().await;

    // Cache clear করো, তারপর fresh fetch
    let _ = guard.channel_cache_repo.clear(); // cache wipe
    let url = guard.settings.playlist_url.clone();
    guard.load_playlist(&url).await.map_err(|e| e.to_string())?;

    Ok(guard.filtered_channels.clone())
}

/// status.json check করে — update আছে কিনা বলে
#[tauri::command]
pub async fn check_playlist_update(
    state: State<'_, SharedAppState>,
) -> Result<bool, String> {
    let last_synced = {
        let guard = state.lock().await;
        guard.last_synced_at.clone()
    };

    // status.json নামাও
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

    // আগে কখনো sync হয়নি, বা remote টা newer
    let has_update = match &last_synced {
        None => true,
        Some(prev) => remote_updated_at > *prev, // ISO8601 string compare
    };

    Ok(has_update)
}

/// Silently fresh playlist fetch করে, SQLite + memory update করে
#[tauri::command]
pub async fn background_refresh_playlist(
    state: State<'_, SharedAppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let url = {
        let guard = state.lock().await;
        guard.settings.playlist_url.clone()
    };

    // Cache clear করে fresh load করো
    {
        let mut guard = state.lock().await;
        let _ = guard.channel_cache_repo.clear();
        guard.load_playlist(&url).await.map_err(|e| e.to_string())?;

        // updated_at save করো
        guard.last_synced_at = Some(chrono::Utc::now().to_rfc3339());
    }

    // Frontend-কে জানাও
    use tauri::Emitter;
    app_handle
        .emit("playlist_updated", ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

