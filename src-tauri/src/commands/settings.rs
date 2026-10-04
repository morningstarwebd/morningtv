// src/commands/settings.rs
// Tauri IPC command handlers for user settings and preferences

use crate::app::SharedAppState;
use crate::config::AppSettings;
use crate::domain::QualityTier;
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, SharedAppState>) -> Result<AppSettings, String> {
    let guard = state.read().await;
    Ok(guard.settings.clone())
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings, state: State<'_, SharedAppState>) -> Result<AppSettings, String> {
    let mut guard = state.write().await;
    let url_changed = guard.settings.playlist_url != settings.playlist_url;
    guard.settings = settings.clone();
    guard.settings.save().map_err(|e| e.to_string())?;

    if url_changed {
        let _ = guard.channel_cache_repo.clear();
        let new_url = guard.settings.playlist_url.clone();
        if let Err(e) = guard.load_playlist(&new_url).await {
            tracing::warn!("Failed to reload playlist after settings URL change: {}", e);
        }
    }

    Ok(settings)
}

#[tauri::command]
pub async fn cycle_quality(state: State<'_, SharedAppState>) -> Result<QualityTier, String> {
    let mut guard = state.write().await;
    Ok(guard.cycle_quality())
}

#[tauri::command]
pub fn get_proxy_auth_token() -> String {
    crate::network::proxy::StreamProxy::get_auth_token().to_string()
}

#[tauri::command]
pub fn get_proxy_port() -> u16 {
    crate::network::proxy::StreamProxy::get_port()
}

#[tauri::command]
pub async fn test_groq_api_key(api_key: String) -> Result<String, String> {
    crate::network::AiBrain::test_connection(&api_key).await
}

#[tauri::command]
pub async fn verify_ai_provider_key(
    api_key: String,
    endpoint: Option<String>,
) -> Result<crate::network::ai_brain::ProviderDetectionResult, String> {
    crate::network::AiBrain::detect_and_verify(&api_key, endpoint.as_deref()).await
}

#[tauri::command]
pub async fn add_custom_upstream_source(
    source_url: String,
    state: State<'_, SharedAppState>,
) -> Result<AppSettings, String> {
    let clean_url = source_url.trim().to_string();
    if clean_url.is_empty() {
        return Err("Source URL cannot be empty".to_string());
    }

    let mut guard = state.write().await;
    if !guard.settings.custom_upstream_sources.contains(&clean_url) {
        guard.settings.custom_upstream_sources.push(clean_url);
        guard.settings.save().map_err(|e| e.to_string())?;
    }
    Ok(guard.settings.clone())
}

#[tauri::command]
pub async fn remove_custom_upstream_source(
    source_url: String,
    state: State<'_, SharedAppState>,
) -> Result<AppSettings, String> {
    let clean_url = source_url.trim();
    let mut guard = state.write().await;
    guard.settings.custom_upstream_sources.retain(|s| s != clean_url);
    guard.settings.save().map_err(|e| e.to_string())?;
    Ok(guard.settings.clone())
}

#[tauri::command]
pub async fn ask_ai_assistant(
    query: String,
    state: State<'_, SharedAppState>,
) -> Result<String, String> {
    let (api_key, enabled, channels_summary) = {
        let guard = state.read().await;
        let key = match guard
            .settings
            .ai_api_key
            .as_ref()
            .or(guard.settings.groq_api_key.as_ref())
        {
            Some(k) if !k.trim().is_empty() => k.clone(),
            _ => return Err("AI API key is not configured. Please add it in Settings.".to_string()),
        };
        let enabled = guard.settings.ai_brain_enabled;

        // Build top 50 channels summary for context
        let summary: Vec<String> = guard
            .all_channels
            .iter()
            .take(50)
            .map(|c| format!("- {} ({}, {})", c.name, c.group, if c.is_verified { "Live" } else { "Unverified" }))
            .collect();
        (key, enabled, summary.join("\n"))
    };

    if !enabled {
        return Err("AI Brain is currently disabled in Settings.".to_string());
    }

    crate::network::AiBrain::ask_assistant(&api_key, &query, &channels_summary).await
}

#[tauri::command]
pub async fn ai_voice_chat(
    message: String,
    state: State<'_, SharedAppState>,
) -> Result<crate::network::ai_brain::AiChatResponse, String> {
    let (api_key, endpoint, context) = {
        let guard = state.read().await;
        let key = guard
            .settings
            .ai_api_key
            .clone()
            .or_else(|| guard.settings.groq_api_key.clone());
        let ep = guard.settings.ai_endpoint.clone();
        let cur_ch = guard
            .all_channels
            .iter()
            .find(|c| Some(&c.id.0) == guard.settings.last_played_channel_id.as_ref())
            .map(|c| c.name.clone());
        let channel_sample: Vec<String> = guard
            .all_channels
            .iter()
            .take(40)
            .map(|c| c.name.clone())
            .collect();
        let ctx = crate::network::ai_brain::AiContext {
            current_channel: cur_ch,
            current_volume: guard.settings.volume,
            is_muted: guard.settings.is_muted,
            active_category: "All".to_string(),
            channel_sample,
        };
        (key, ep, ctx)
    };

    crate::network::AiBrain::chat_with_copilot(
        api_key.as_deref(),
        endpoint.as_deref(),
        &message,
        &context,
    )
    .await
}

#[tauri::command]
pub async fn ai_hunt_and_heal(
    channel_name: String,
    state: State<'_, SharedAppState>,
) -> Result<Option<crate::domain::Channel>, String> {
    let (custom_sources, target_channel, repo) = {
        let guard = state.read().await;
        let sources = guard.settings.custom_upstream_sources.clone();
        let ch = guard
            .all_channels
            .iter()
            .find(|c| {
                let a = c.name.to_lowercase();
                let b = channel_name.to_lowercase();
                a.contains(&b) || b.contains(&a)
            })
            .cloned();
        let r = guard.channel_cache_repo.clone();
        (sources, ch, r)
    };

    let target_name = target_channel
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or_else(|| channel_name.clone());

    if let Some(working_url) =
        crate::network::AiBrain::autonomous_stream_hunt(&target_name, &custom_sources).await
    {
        if let Some(mut ch) = target_channel {
            let old = std::mem::replace(&mut ch.url, working_url.clone());
            if !ch.fallback_urls.contains(&old) {
                ch.fallback_urls.insert(0, old);
            }
            ch.is_verified = true;

            let _ = repo.update_channel_stream(&ch.id.0, &ch.url, &ch.fallback_urls);

            {
                let mut guard = state.write().await;
                if let Some(existing) = guard.all_channels.iter_mut().find(|c| c.id == ch.id) {
                    *existing = ch.clone();
                }
                guard.refresh_filtered_channels();
            }

            return Ok(Some(ch));
        }
    }

    Ok(None)
}



