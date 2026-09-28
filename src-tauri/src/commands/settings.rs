// src/commands/settings.rs
// Tauri IPC command handlers for user settings and preferences

use crate::app::SharedAppState;
use crate::config::AppSettings;
use crate::domain::QualityTier;
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, SharedAppState>) -> Result<AppSettings, String> {
    let guard = state.lock().await;
    Ok(guard.settings.clone())
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings, state: State<'_, SharedAppState>) -> Result<AppSettings, String> {
    let mut guard = state.lock().await;
    let url_changed = guard.settings.playlist_url != settings.playlist_url;
    guard.settings = settings.clone();
    guard.settings.save().map_err(|e| e.to_string())?;

    if url_changed {
        let _ = guard.channel_cache_repo.clear();
        let new_url = guard.settings.playlist_url.clone();
        let _ = guard.load_playlist(&new_url).await;
    }

    Ok(settings)
}

#[tauri::command]
pub async fn cycle_quality(state: State<'_, SharedAppState>) -> Result<QualityTier, String> {
    let mut guard = state.lock().await;
    Ok(guard.cycle_quality())
}

#[tauri::command]
pub fn get_proxy_auth_token() -> String {
    crate::network::proxy::StreamProxy::get_auth_token().to_string()
}

