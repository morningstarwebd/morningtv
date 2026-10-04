// src/network/client_sentinel.rs
// Client-Side Local Network Sentinel: Last-Mile Stream Auditor & Self-Healing Engine
// Features: GitHub lifecycle sync check, polite ISP probing, automatic fallback promotion, and JIT favorite healing.

use crate::domain::Channel;
use crate::storage::ChannelCacheRepository;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;

static AUDIT_RUNNING: AtomicBool = AtomicBool::new(false);

pub struct ClientSentinel;

impl ClientSentinel {
    /// Checks GitHub status.json to determine if a newer healed playlist was published
    pub async fn check_remote_update_needed(
        client: &reqwest::Client,
        local_last_synced: Option<&str>,
    ) -> Option<String> {
        let resp = match client
            .get(crate::config::defaults::STATUS_JSON_URL)
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            _ => return None,
        };

        let json: serde_json::Value = match resp.json().await {
            Ok(j) => j,
            Err(_) => return None,
        };

        let remote_updated_at = json["updated_at"].as_str()?.to_string();
        if remote_updated_at.is_empty() {
            return None;
        }

        let needs_sync = match local_last_synced {
            None => true,
            Some(prev) => {
                if let (Ok(remote_dt), Ok(prev_dt)) = (
                    chrono::DateTime::parse_from_rfc3339(&remote_updated_at),
                    chrono::DateTime::parse_from_rfc3339(prev),
                ) {
                    remote_dt > prev_dt
                } else {
                    remote_updated_at.as_str() > prev
                }
            }
        };

        if needs_sync {
            Some(remote_updated_at)
        } else {
            None
        }
    }

    /// Attempts to self-heal a failing channel just-in-time
    pub async fn heal_single_channel(
        client: &reqwest::Client,
        channel: &mut Channel,
        repo: &ChannelCacheRepository,
        settings: &crate::config::AppSettings,
    ) -> bool {
        // Step 1: Probe existing fallbacks
        for (i, fallback_url) in channel.fallback_urls.iter().enumerate() {
            let res = sentinel::probe_single_url(client, fallback_url).await;
            if res.ok {
                let working_url = res.active_url;
                let old_primary = std::mem::replace(&mut channel.url, working_url);
                channel.fallback_urls.remove(i);
                channel.fallback_urls.insert(0, old_primary);

                let _ = repo.update_channel_stream(
                    &channel.id.0,
                    &channel.url,
                    &channel.fallback_urls,
                );
                tracing::info!(
                    channel = %channel.name,
                    new_url = %channel.url,
                    "Self-healed channel from local fallback pool"
                );
                return true;
            }
        }

        // Step 2: Check known backup mirrors from Sentinel database
        for &(key, mirrors) in sentinel::KNOWN_BACKUP_MIRRORS {
            if sentinel::matches_backup_mirror_key(&channel.name, &channel.id.0, key) {
                for mirror_url in mirrors {
                    let res = sentinel::probe_single_url(client, mirror_url).await;
                    if res.ok {
                        let working_url = res.active_url;
                        let old_primary = std::mem::replace(&mut channel.url, working_url);
                        if !channel.fallback_urls.contains(&old_primary) {
                            channel.fallback_urls.insert(0, old_primary);
                        }

                        let _ = repo.update_channel_stream(
                            &channel.id.0,
                            &channel.url,
                            &channel.fallback_urls,
                        );
                        tracing::info!(
                            channel = %channel.name,
                            new_url = %channel.url,
                            "Self-healed channel from known backup mirror"
                        );
                        return true;
                    }
                }
            }
        }

        // Step 3: Search User-Configured Custom Upstream Sources
        if !settings.custom_upstream_sources.is_empty() {
            for custom_url in &settings.custom_upstream_sources {
                if let Ok(resp) = client.get(custom_url).timeout(Duration::from_secs(6)).send().await {
                    if resp.status().is_success() {
                        if let Ok(text) = resp.text().await {
                            let items = sentinel::parse_m3u(&text, "Custom", "Custom Feed", false);
                            let norm_target: String = channel
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            for item in items {
                                let norm_cand: String = item
                                    .name
                                    .to_lowercase()
                                    .chars()
                                    .filter(|c| c.is_ascii_alphanumeric())
                                    .collect();
                                if norm_cand == norm_target
                                    || (norm_cand.len() > 3 && norm_target.contains(&norm_cand))
                                    || (norm_target.len() > 3 && norm_cand.contains(&norm_target))
                                {
                                    let res = sentinel::probe_single_url(client, &item.url).await;
                                    if res.ok {
                                        let working_url = res.active_url;
                                        let old_primary = std::mem::replace(&mut channel.url, working_url);
                                        if !channel.fallback_urls.contains(&old_primary) {
                                            channel.fallback_urls.insert(0, old_primary);
                                        }
                                        let _ = repo.update_channel_stream(
                                            &channel.id.0,
                                            &channel.url,
                                            &channel.fallback_urls,
                                        );
                                        tracing::info!(
                                            channel = %channel.name,
                                            new_url = %channel.url,
                                            source = %custom_url,
                                            "Self-healed channel from custom upstream source"
                                        );
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Step 4: AI Brain Smart Semantic Match if enabled
        if settings.ai_brain_enabled {
            if let Some(ref api_key) = settings.groq_api_key {
                if !api_key.trim().is_empty() {
                    let candidate_names: Vec<String> = sentinel::KNOWN_BACKUP_MIRRORS
                        .iter()
                        .map(|(k, _)| k.to_string())
                        .collect();
                    if let Ok(Some(matched_key)) =
                        crate::network::AiBrain::smart_channel_match(api_key, &channel.name, &candidate_names).await
                    {
                        for &(key, mirrors) in sentinel::KNOWN_BACKUP_MIRRORS {
                            if key == matched_key {
                                for mirror in mirrors {
                                    let res = sentinel::probe_single_url(client, mirror).await;
                                    if res.ok {
                                        let working_url = res.active_url;
                                        let old_primary = std::mem::replace(&mut channel.url, working_url);
                                        if !channel.fallback_urls.contains(&old_primary) {
                                            channel.fallback_urls.insert(0, old_primary);
                                        }
                                        let _ = repo.update_channel_stream(
                                            &channel.id.0,
                                            &channel.url,
                                            &channel.fallback_urls,
                                        );
                                        tracing::info!(
                                            channel = %channel.name,
                                            new_url = %channel.url,
                                            "Self-healed channel via AI Brain semantic match"
                                        );
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        false
    }

    /// Silently audits channels on user's local network ISP and ranks fastest servers to #1
    pub fn spawn_local_audit(
        channels: Vec<Channel>,
        repo: Arc<ChannelCacheRepository>,
        max_channels: usize,
    ) {
        if AUDIT_RUNNING.swap(true, Ordering::SeqCst) {
            return; // Already auditing
        }

        tokio::spawn(async move {
            let client = match reqwest::Client::builder()
                .timeout(Duration::from_secs(4))
                .connect_timeout(Duration::from_secs(2))
                .build()
            {
                Ok(c) => c,
                Err(_) => {
                    AUDIT_RUNNING.store(false, Ordering::SeqCst);
                    return;
                }
            };

            // Limit concurrency to 3 lightweight workers to protect low-end CPUs and user bandwidth
            let semaphore = Arc::new(Semaphore::new(3));
            let mut audited_count = 0;

            for mut ch in channels {
                if audited_count >= max_channels {
                    break;
                }
                audited_count += 1;

                // If channel has no fallbacks, skip deep probe
                if ch.fallback_urls.is_empty() {
                    continue;
                }

                let sem = Arc::clone(&semaphore);
                let client = client.clone();
                let repo = Arc::clone(&repo);

                tokio::spawn(async move {
                    let _permit = sem.acquire().await;

                    // 1. Probe primary URL
                    let prim_res = sentinel::probe_single_url(&client, &ch.url).await;
                    let primary_latency = if prim_res.ok { prim_res.latency_ms } else { u64::MAX };

                    // 2. If primary is slow (>1200ms) or dead, check fallbacks for a better ISP route
                    if primary_latency > 1200 || !prim_res.ok {
                        let mut best_fallback_idx = None;
                        let mut best_latency = primary_latency;

                        for (idx, fb) in ch.fallback_urls.iter().enumerate() {
                            let fb_res = sentinel::probe_single_url(&client, fb).await;
                            if fb_res.ok && fb_res.latency_ms < best_latency {
                                best_latency = fb_res.latency_ms;
                                best_fallback_idx = Some(idx);
                            }
                        }

                        // If a significantly faster working fallback was found on this ISP, promote it!
                        if let Some(idx) = best_fallback_idx {
                            let promoted_url = ch.fallback_urls.remove(idx);
                            let old_url = std::mem::replace(&mut ch.url, promoted_url);
                            ch.fallback_urls.insert(0, old_url);

                            let _ = repo.update_channel_stream(
                                &ch.id.0,
                                &ch.url,
                                &ch.fallback_urls,
                            );

                            tracing::info!(
                                channel = %ch.name,
                                latency_ms = best_latency,
                                "Promoted faster local ISP server to primary"
                            );
                        }
                    }
                });

                // Polite pause between scheduling
                tokio::time::sleep(Duration::from_millis(100)).await;
            }

            // Wait for all in-flight workers to finish before releasing lock
            let _ = semaphore.acquire_many(3).await;

            // Record verification timestamp
            let now_str = chrono::Utc::now().to_rfc3339();
            let _ = repo.set_last_local_verified_at(&now_str);

            AUDIT_RUNNING.store(false, Ordering::SeqCst);
        });
    }
}
