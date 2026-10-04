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

    let resp = match client.get(crate::config::defaults::STATUS_JSON_URL).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Ok(false),
    };

    let json: serde_json::Value = match resp.json().await {
        Ok(j) => j,
        Err(_) => return Ok(false),
    };

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

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncProgressPayload {
    pub phase: String,
    pub percent: u32,
    pub updated_count: usize,
    pub total_count: usize,
    pub is_complete: bool,
}

/// Silently fetches fresh playlist into an isolated staging buffer, audits streams on user's ISP,
/// and atomically swaps into SQLite and in-memory state without interrupting active playback.
#[tauri::command]
pub async fn background_refresh_playlist(
    state: State<'_, SharedAppState>,
    app_handle: tauri::AppHandle,
) -> Result<SyncProgressPayload, String> {
    use tauri::Emitter;

    let (url, fav_ids) = {
        let guard = state.read().await;
        (
            guard.settings.playlist_url.clone(),
            guard.favorites_repo.get_all_ids().unwrap_or_default(),
        )
    };

    // Phase 1: Checking GitHub Sentinel release
    let _ = app_handle.emit(
        "sync_progress",
        SyncProgressPayload {
            phase: "Connecting to GitHub Sentinel release...".to_string(),
            percent: 10,
            updated_count: 0,
            total_count: 0,
            is_complete: false,
        },
    );

    // Phase 2: Download fresh playlist into staging buffer
    let client = crate::network::ResilientHttpClient::new().map_err(|e| e.to_string())?;
    let fetcher = crate::playlist::PlaylistFetcher::new(client);

    let _ = app_handle.emit(
        "sync_progress",
        SyncProgressPayload {
            phase: "Downloading latest healed streams from cloud...".to_string(),
            percent: 25,
            updated_count: 0,
            total_count: 0,
            is_complete: false,
        },
    );

    let mut staging_channels = match fetcher.load(&url).await {
        Ok(ch) if !ch.is_empty() => ch,
        _ => {
            fetcher
                .load(crate::config::defaults::DEFAULT_PLAYLIST_URL)
                .await
                .map_err(|e| e.to_string())?
        }
    };

    let total_count = staging_channels.len();

    // Mark favorites in staging
    for ch in &mut staging_channels {
        ch.is_favorite = fav_ids.contains(&ch.id.0);
    }

    // Phase 3: Auditing on user's local network (testing mirrors for top Indian and favorite channels)
    let probe_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(2500))
        .connect_timeout(std::time::Duration::from_millis(1500))
        .redirect(reqwest::redirect::Policy::limited(4))
        .pool_max_idle_per_host(20)
        .tcp_keepalive(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    // Gather indices of priority channels to audit
    let mut audit_indices: Vec<usize> = Vec::new();
    for (idx, ch) in staging_channels.iter().enumerate() {
        let is_priority = ch.is_favorite 
            || !ch.fallback_urls.is_empty()
            || ch.group.to_lowercase().contains("india")
            || ch.group.to_lowercase().contains("bangla")
            || ch.group.to_lowercase().contains("news")
            || ch.group.to_lowercase().contains("sports")
            || ch.group.to_lowercase().contains("movie")
            || ch.id.0.contains(".in")
            || ch.id.0.contains(".bd");
        if is_priority {
            audit_indices.push(idx);
        }
    }

    if audit_indices.len() > 300 {
        audit_indices.truncate(300);
    }
    let total_to_audit = audit_indices.len();

    let _ = app_handle.emit(
        "sync_progress",
        SyncProgressPayload {
            phase: format!("Auditing local network (0 / {} priority streams tested)...", total_to_audit),
            percent: 30,
            updated_count: 0,
            total_count,
            is_complete: false,
        },
    );

    // Multi-threaded audit with bounded concurrency and non-blocking mpsc completion streaming
    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(18));
    let (tx, mut rx) = tokio::sync::mpsc::channel(total_to_audit.max(1));

    for &idx in &audit_indices {
        let permit = std::sync::Arc::clone(&sem);
        let client = probe_client.clone();
        let primary_url = staging_channels[idx].url.clone();
        let fallbacks = staging_channels[idx].fallback_urls.clone();
        let channel_name = staging_channels[idx].name.clone();
        let channel_id = staging_channels[idx].id.0.clone();
        let task_tx = tx.clone();

        tokio::spawn(async move {
            let _permit = permit.acquire().await;

            // 1. Probe primary URL
            let prim_res = sentinel::probe_single_url(&client, &primary_url).await;
            if prim_res.ok {
                let _ = task_tx.send((idx, true, None, None)).await;
                return;
            }

            // 2. If primary failed, test existing fallback mirrors
            if !fallbacks.is_empty() {
                for (f_idx, fb) in fallbacks.iter().enumerate() {
                    let fb_res = sentinel::probe_single_url(&client, fb).await;
                    if fb_res.ok {
                        let _ = task_tx.send((idx, true, Some(f_idx), None)).await;
                        return;
                    }
                }
            }

            // 3. If still failing, check known backup mirrors from Sentinel database
            let mut backup_mirror_match = None;
            for &(key, mirrors) in sentinel::KNOWN_BACKUP_MIRRORS {
                if sentinel::matches_backup_mirror_key(&channel_name, &channel_id, key) {
                    for mirror in mirrors {
                        let m_res = sentinel::probe_single_url(&client, mirror).await;
                        if m_res.ok {
                            backup_mirror_match = Some(m_res.active_url);
                            break;
                        }
                    }
                    if backup_mirror_match.is_some() {
                        break;
                    }
                }
            }

            if let Some(mirror_url) = backup_mirror_match {
                let _ = task_tx.send((idx, true, None, Some(mirror_url))).await;
            } else {
                let _ = task_tx.send((idx, false, None, None)).await;
            }
        });
    }

    // Drop initial sender so rx loop completes cleanly when all tasks finish
    drop(tx);

    let mut audited_count = 0;
    let mut updated_count = 0;
    let mut working_count = 0;
    let mut last_emit = std::time::Instant::now();

    while let Some((idx, is_ok, promoted_f_idx, backup_mirror_url)) = rx.recv().await {
        audited_count += 1;
        let had_backup_promotion = backup_mirror_url.is_some();
        if is_ok {
            working_count += 1;
            staging_channels[idx].is_verified = true;
            if let Some(f_idx) = promoted_f_idx {
                if f_idx < staging_channels[idx].fallback_urls.len() {
                    let promoted = staging_channels[idx].fallback_urls.remove(f_idx);
                    let old = std::mem::replace(&mut staging_channels[idx].url, promoted);
                    staging_channels[idx].fallback_urls.insert(0, old);
                    updated_count += 1;
                }
            } else if let Some(mirror_url) = backup_mirror_url {
                let old = std::mem::replace(&mut staging_channels[idx].url, mirror_url);
                if !staging_channels[idx].fallback_urls.contains(&old) {
                    staging_channels[idx].fallback_urls.insert(0, old);
                }
                updated_count += 1;
            }
        } else {
            staging_channels[idx].is_verified = false;
        }

        let is_done = audited_count == total_to_audit;
        let should_emit = audited_count % 5 == 0
            || promoted_f_idx.is_some()
            || had_backup_promotion
            || last_emit.elapsed().as_millis() >= 250
            || is_done;

        if should_emit {
            last_emit = std::time::Instant::now();
            let pct = 30 + ((audited_count as u32 * 65) / (total_to_audit as u32).max(1));
            let _ = app_handle.emit(
                "sync_progress",
                SyncProgressPayload {
                    phase: format!(
                        "Auditing ISP: {}/{} streams tested ({} live, {} optimized)...",
                        audited_count, total_to_audit, working_count, updated_count
                    ),
                    percent: pct.min(95),
                    updated_count,
                    total_count,
                    is_complete: false,
                },
            );
        }
    }

    // Phase 4: Atomic Commit to SQLite & Safe Memory Swap
    let _ = app_handle.emit(
        "sync_progress",
        SyncProgressPayload {
            phase: "Atomically committing verified library to database...".to_string(),
            percent: 96,
            updated_count,
            total_count,
            is_complete: false,
        },
    );

    let now_str = chrono::Utc::now().to_rfc3339();

    {
        let mut guard = state.write().await;
        // Atomic save to SQLite
        let _ = guard.channel_cache_repo.save_all(&staging_channels);
        let _ = guard.channel_cache_repo.set_last_synced_at(&now_str);
        let _ = guard.channel_cache_repo.set_last_local_verified_at(&now_str);
        guard.last_synced_at = Some(now_str.clone());

        // Safe in-memory swap: updates channels and categories without interrupting current stream
        guard.categories = crate::playlist::ChannelFilter::extract_categories(&staging_channels);
        guard.all_channels = staging_channels;
        guard.refresh_filtered_channels();
        guard.spawn_background_optimizations();
    }

    let result = SyncProgressPayload {
        phase: "Sync Complete".to_string(),
        percent: 100,
        updated_count,
        total_count,
        is_complete: true,
    };

    let _ = app_handle.emit("sync_progress", result.clone());
    let _ = app_handle.emit("playlist_updated", ());

    Ok(result)
}

#[tauri::command]
pub async fn check_ffmpeg_status() -> Result<bool, String> {
    Ok(crate::network::FfmpegBridge::is_available())
}

#[tauri::command]
pub async fn heal_channel(
    channel_id: String,
    state: State<'_, SharedAppState>,
) -> Result<Option<Channel>, String> {
    let mut guard = state.write().await;
    Ok(guard.heal_channel(&channel_id).await)
}

