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
    provider: Option<String>,
    model: Option<String>,
) -> Result<crate::network::ai_brain::ProviderDetectionResult, String> {
    crate::network::AiBrain::detect_and_verify(
        &api_key,
        endpoint.as_deref(),
        provider.as_deref(),
        model.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn fetch_ai_provider_models(
    provider: String,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<Vec<crate::network::ai_brain::AiModelItem>, String> {
    Ok(crate::network::AiBrain::fetch_provider_models(
        &provider,
        api_key.as_deref(),
        endpoint.as_deref(),
    )
    .await)
}

#[tauri::command]
pub async fn set_active_ai_model(
    model: String,
    state: State<'_, SharedAppState>,
) -> Result<AppSettings, String> {
    let mut guard = state.write().await;
    guard.settings.ai_model = Some(model);
    guard.settings.save().map_err(|e| e.to_string())?;
    Ok(guard.settings.clone())
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
    history: Option<Vec<crate::network::ai_brain::ChatHistoryItem>>,
    state: State<'_, SharedAppState>,
) -> Result<crate::network::ai_brain::AiChatResponse, String> {
    let (api_key, endpoint, provider, model, context) = {
        let guard = state.read().await;
        let key = guard
            .settings
            .ai_api_key
            .clone()
            .or_else(|| guard.settings.groq_api_key.clone());
        let ep = guard.settings.ai_endpoint.clone();
        let prov = guard.settings.ai_provider.clone();
        let mdl = guard.settings.ai_model.clone();
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
        (key, ep, prov, mdl, ctx)
    };

    crate::network::AiBrain::chat_with_copilot(
        api_key.as_deref(),
        endpoint.as_deref(),
        provider.as_deref(),
        model.as_deref(),
        &message,
        history.as_deref(),
        &context,
    )
    .await
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AiHuntResponse {
    pub success: bool,
    pub channel: Option<crate::domain::Channel>,
    pub channel_name: String,
    pub searched_sources_count: usize,
    pub searched_repositories: Vec<String>,
    pub message: String,
    pub is_drm_or_paytv: bool,
    pub suggestions: Vec<String>,
}

#[tauri::command]
pub async fn ai_hunt_and_heal(
    channel_name: String,
    state: State<'_, SharedAppState>,
) -> Result<AiHuntResponse, String> {
    let (custom_sources, target_channel, repo) = {
        let guard = state.read().await;
        let sources = guard.settings.custom_upstream_sources.clone();
        let ch = guard
            .all_channels
            .iter()
            .find(|c| {
                let a = c.name.to_lowercase();
                let b = channel_name.to_lowercase();
                a == b || a.contains(&b) || b.contains(&a)
            })
            .cloned();
        let r = guard.channel_cache_repo.clone();
        (sources, ch, r)
    };

    let target_name = target_channel
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or_else(|| channel_name.clone());

    // Run deep multi-repository sweep across local mirrors, custom settings sources, and 13+ GitHub IPTV indexes
    let hunt_report = crate::network::AiBrain::deep_hunt(&target_name, &custom_sources).await;

    // 1. If active stream discovered:
    if hunt_report.success {
        if let Some(mut ch) = target_channel {
            if let Some(working_url) = hunt_report.active_url {
                let old = std::mem::replace(&mut ch.url, working_url.clone());
                if !ch.fallback_urls.contains(&old) {
                    ch.fallback_urls.insert(0, old);
                }
                ch.is_verified = true;

                let _ = repo.upsert_channel(&ch);

                {
                    let mut guard = state.write().await;
                    if let Some(existing) = guard.all_channels.iter_mut().find(|c| c.id == ch.id) {
                        *existing = ch.clone();
                    }
                    guard.refresh_filtered_channels();
                }

                return Ok(AiHuntResponse {
                    success: true,
                    channel: Some(ch.clone()),
                    channel_name: target_name.clone(),
                    searched_sources_count: hunt_report.searched_sources_count,
                    searched_repositories: hunt_report.searched_sources,
                    message: format!(
                        "⚡ AI Autonomous Hunt Successful! Working stream for \"{}\" recovered and updated in database.",
                        ch.name
                    ),
                    is_drm_or_paytv: false,
                    suggestions: vec![],
                });
            }
        } else if let Some(discovered) = hunt_report.channel_metadata {
            let id_val = format!(
                "ai_recovered_{}",
                discovered
                    .name
                    .to_lowercase()
                    .chars()
                    .filter(|c| c.is_ascii_alphanumeric())
                    .collect::<String>()
            );
            let new_ch = crate::domain::Channel {
                id: crate::domain::ChannelId(id_val),
                name: discovered.name,
                logo: if discovered.logo.is_empty() {
                    None
                } else {
                    Some(discovered.logo)
                },
                group: if discovered.group.is_empty() {
                    "India".to_string()
                } else {
                    discovered.group
                },
                url: discovered.url,
                fallback_urls: discovered.fallbacks,
                http_user_agent: None,
                http_referrer: None,
                is_favorite: false,
                provider: Some(discovered.provider),
                is_verified: true,
            };

            let _ = repo.upsert_channel(&new_ch);

            {
                let mut guard = state.write().await;
                guard.all_channels.insert(0, new_ch.clone());
                guard.refresh_filtered_channels();
            }

            return Ok(AiHuntResponse {
                success: true,
                channel: Some(new_ch.clone()),
                channel_name: target_name.clone(),
                searched_sources_count: hunt_report.searched_sources_count,
                searched_repositories: hunt_report.searched_sources,
                message: format!(
                    "⚡ AI Autonomous Discovery Successful! \"{}\" stream discovered online, verified, and saved to database.",
                    new_ch.name
                ),
                is_drm_or_paytv: false,
                suggestions: vec![],
            });
        }
    }

    // 2. Not found or DRM restricted: Generate detailed diagnostic feedback
    let drm_info = crate::network::ai_brain::crawler::check_known_drm_paytv(&target_name);
    let is_drm = drm_info.is_some() || hunt_report.is_drm_or_paytv;

    let message = if let Some((official_name, reason)) = drm_info {
        format!(
            "🔍 **AI Deep Search & Technical Checkup Report for \"{}\":**\n\n\
            • **Sources Scanned ({} sources):** Local SQLite DB, Custom Settings Sources, and 13+ GitHub IPTV Repositories (India Airtel, Jio, Bangladesh, Kids, Animation, Entertainment, Samsung TV Plus, Free-TV).\n\
            • **Status:** No active unencrypted public stream available.\n\
            • **Technical Reason:** {} Open public GitHub IPTV repositories cannot host unencrypted streams without active DRM token authorization.\n\n\
            💡 **What you can do:**\n\
            1. **Add Custom Stream:** If you have an M3U8 link or private server stream, add it in **Settings > Custom Upstream Sources** or chat: `add stream <URL> for {}`\n\
            2. **Active Channels in Library:** Recommended live kids channels currently working: **Hungama**, **Sony YAY!**, **Gubbare**, **Cartoon Network (Open)**.",
            official_name,
            hunt_report.searched_sources_count,
            reason,
            official_name
        )
    } else {
        format!(
            "🔍 **AI Deep Search Report for \"{}\":**\n\n\
            • **Sources Scanned ({} sources):** Local Database, Custom Settings Sources, and 13+ GitHub IPTV Repositories.\n\
            • **Status:** No working live broadcast was found for \"{}\".\n\n\
            💡 **Tip:** If you have an M3U/M3U8 link for this channel, you can add it in **Settings > Custom Upstream Sources** or chat: `add stream <URL> for {}`",
            target_name,
            hunt_report.searched_sources_count,
            target_name,
            target_name
        )
    };

    Ok(AiHuntResponse {
        success: false,
        channel: None,
        channel_name: target_name,
        searched_sources_count: hunt_report.searched_sources_count,
        searched_repositories: hunt_report.searched_sources,
        message,
        is_drm_or_paytv: is_drm,
        suggestions: hunt_report.suggestions,
    })
}

#[tauri::command]
pub async fn add_custom_channel(
    name: String,
    url: String,
    group: Option<String>,
    state: State<'_, SharedAppState>,
) -> Result<crate::domain::Channel, String> {
    let clean_url = url.trim().to_string();
    if clean_url.is_empty() {
        return Err("Stream URL cannot be empty".to_string());
    }

    let id_val = format!("custom_{}", uuid::Uuid::new_v4().simple());

    let ch = crate::domain::Channel {
        id: crate::domain::ChannelId(id_val),
        name: name.trim().to_string(),
        logo: None,
        group: group.unwrap_or_else(|| "Custom".to_string()),
        url: clean_url,
        fallback_urls: vec![],
        http_user_agent: None,
        http_referrer: None,
        is_favorite: true,
        provider: Some("User Added".to_string()),
        is_verified: true,
    };

    let repo = {
        let guard = state.read().await;
        guard.channel_cache_repo.clone()
    };

    let _ = repo.upsert_channel(&ch);

    {
        let mut guard = state.write().await;
        guard.all_channels.insert(0, ch.clone());
        guard.refresh_filtered_channels();
    }

    Ok(ch)
}

#[tauri::command]
pub async fn ai_diagnose_stream(
    channel_name: String,
    state: State<'_, SharedAppState>,
) -> Result<crate::network::ai_brain::StreamHealResult, String> {
    let (custom_sources, permission) = {
        let guard = state.read().await;
        (
            guard.settings.custom_upstream_sources.clone(),
            guard.settings.ai_permission_level,
        )
    };

    let result = crate::network::AiBrain::diagnose_and_heal_stream(
        &channel_name,
        permission,
        &custom_sources,
    )
    .await;

    // If autonomously healed, update in-memory and SQLite cache
    if result.healed {
        if let Some(ref new_url) = result.new_url {
            let mut guard = state.write().await;
            let repo = guard.channel_cache_repo.clone();
            if let Some(ch) = guard.all_channels.iter_mut().find(|c| {
                let a = c.name.to_lowercase();
                let b = channel_name.to_lowercase();
                a == b || a.contains(&b) || b.contains(&a)
            }) {
                let old = std::mem::replace(&mut ch.url, new_url.clone());
                if !ch.fallback_urls.contains(&old) {
                    ch.fallback_urls.insert(0, old);
                }
                ch.is_verified = true;
                let _ = repo.upsert_channel(ch);
            }
            guard.refresh_filtered_channels();
        }
    }

    Ok(result)
}



