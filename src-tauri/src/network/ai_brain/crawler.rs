// src-tauri/src/network/ai_brain/crawler.rs
// Deep Autonomous Stream Hunter (Upstream, Custom, Backup & GitHub IPTV Mirrors)

use sentinel;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredChannel {
    pub name: String,
    pub url: String,
    pub group: String,
    pub logo: String,
    pub provider: String,
    pub fallbacks: Vec<String>,
}

pub struct StreamCrawler;

impl StreamCrawler {
    /// Autonomously crawls upstream feeds, backup mirrors, custom sources, and GitHub IPTV indices
    pub async fn hunt_channel_stream(
        channel_name: &str,
        custom_sources: &[String],
    ) -> Option<String> {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(2500))
            .connect_timeout(Duration::from_millis(1500))
            .build()
        {
            Ok(c) => c,
            Err(_) => return None,
        };

        let target_norm: String = channel_name
            .to_lowercase()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();

        // 1. Probe known backup mirrors first (instant verified fallback)
        for &(key, mirrors) in sentinel::KNOWN_BACKUP_MIRRORS {
            if sentinel::matches_backup_mirror_key(channel_name, "", key) {
                for &m in mirrors {
                    let res = sentinel::probe_single_url(&client, m).await;
                    if res.ok {
                        return Some(res.active_url);
                    }
                }
            }
        }

        // 2. Scan User Custom Sources
        for src in custom_sources {
            if let Ok(resp) = client.get(src).timeout(Duration::from_secs(5)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, "Custom", "Custom Feed", false);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(res.active_url);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Scan Upstream Providers (all UPSTREAM_PROVIDERS prioritized for India/Bengali/Regional)
        for provider in sentinel::UPSTREAM_PROVIDERS {
            let is_priority = provider.name.to_lowercase().contains("india")
                || provider.name.to_lowercase().contains("bengali")
                || provider.name.to_lowercase().contains("bangladesh")
                || provider.name.to_lowercase().contains("samsung");

            if !is_priority {
                continue;
            }

            if let Ok(resp) = client.get(provider.url).timeout(Duration::from_secs(6)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, provider.default_group, provider.provider, provider.is_vip);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(res.active_url);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Deep GitHub Public IPTV Repositories (Fallback layer for unindexed streams)
        const GITHUB_DEEP_SOURCES: &[&str] = &[
            "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u",
            "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/bd.m3u",
            "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in_airtel.m3u",
        ];

        for &gh_src in GITHUB_DEEP_SOURCES {
            if let Ok(resp) = client.get(gh_src).timeout(Duration::from_secs(5)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, "Global Index", "GitHub IPTV Hunter", false);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(res.active_url);
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }

    /// Autonomously searches upstream provider feeds, mirrors, and custom sources to discover a lost channel metadata
    pub async fn discover_channel(
        channel_name: &str,
        custom_sources: &[String],
    ) -> Option<DiscoveredChannel> {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(3000))
            .connect_timeout(Duration::from_millis(1500))
            .build()
        {
            Ok(c) => c,
            Err(_) => return None,
        };

        let target_norm: String = channel_name
            .to_lowercase()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();

        // 1. Probe known backup mirrors
        for &(key, mirrors) in sentinel::KNOWN_BACKUP_MIRRORS {
            if sentinel::matches_backup_mirror_key(channel_name, "", key) {
                for &m in mirrors {
                    let res = sentinel::probe_single_url(&client, m).await;
                    if res.ok {
                        let display_name = if key == "zeebangla" {
                            "Zee Bangla HD (720p)".to_string()
                        } else if key == "starjalsha" {
                            "Star Jalsha (720p)".to_string()
                        } else if key == "colorshd" {
                            "Colors HD (1080p)".to_string()
                        } else if key == "sonyaath" {
                            "Sony Aath (576p)".to_string()
                        } else if key == "sonymax" {
                            "Sony Max (720p)".to_string()
                        } else {
                            channel_name.to_string()
                        };

                        return Some(DiscoveredChannel {
                            name: display_name,
                            url: res.active_url,
                            group: "India".to_string(),
                            logo: "".to_string(),
                            provider: "Sentinel / AI Neural Backup".to_string(),
                            fallbacks: mirrors.iter().filter(|&&u| u != m).map(|u| u.to_string()).collect(),
                        });
                    }
                }
            }
        }

        // 2. Scan User Custom Sources
        for src in custom_sources {
            if let Ok(resp) = client.get(src).timeout(Duration::from_secs(5)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, "Custom", "Custom Feed", false);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(DiscoveredChannel {
                                        name: item.name,
                                        url: res.active_url,
                                        group: item.group,
                                        logo: item.logo,
                                        provider: item.provider,
                                        fallbacks: item.fallbacks,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Scan Upstream Providers
        for provider in sentinel::UPSTREAM_PROVIDERS {
            if let Ok(resp) = client.get(provider.url).timeout(Duration::from_secs(6)).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(&text, provider.default_group, provider.provider, provider.is_vip);
                        for item in items {
                            let cand_norm: String = item
                                .name
                                .to_lowercase()
                                .chars()
                                .filter(|c| c.is_ascii_alphanumeric())
                                .collect();
                            if cand_norm == target_norm
                                || (cand_norm.len() > 3 && target_norm.contains(&cand_norm))
                                || (target_norm.len() > 3 && cand_norm.contains(&target_norm))
                            {
                                let res = sentinel::probe_single_url(&client, &item.url).await;
                                if res.ok {
                                    return Some(DiscoveredChannel {
                                        name: item.name,
                                        url: res.active_url,
                                        group: item.group,
                                        logo: item.logo,
                                        provider: item.provider,
                                        fallbacks: item.fallbacks,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }

    /// Intelligently parses target channel name from user prompt in Bengali or English
    pub fn extract_channel_target(msg: &str) -> Option<String> {
        let clean = msg.trim();
        if clean.starts_with("/heal ") || clean.starts_with("\\heal ") || clean.starts_with("/hunt ") || clean.starts_with("\\hunt ") || clean.starts_with("/find ") || clean.starts_with("\\find ") {
            let target = clean[6..].trim();
            if !target.is_empty() {
                return Some(target.to_string());
            }
        }

        let lower = clean.to_lowercase();
        if lower.contains("জি বাংলা") {
            if lower.contains("এইচডি") || lower.contains("hd") {
                return Some("Zee Bangla HD (720p)".to_string());
            }
            return Some("Zee Bangla".to_string());
        }
        if lower.contains("স্টার জলসা") {
            return Some("Star Jalsha".to_string());
        }
        if lower.contains("কালার্স বাংলা") || lower.contains("কালারস বাংলা") {
            return Some("Colors Bangla".to_string());
        }
        if lower.contains("সনি আট") || lower.contains("সনি ৮") {
            return Some("Sony Aath".to_string());
        }
        if lower.contains("সনি ম্যাক্স") {
            return Some("Sony Max".to_string());
        }
        if lower.contains("কালার্স এইচডি") || lower.contains("কালারস এইচডি") {
            return Some("Colors HD".to_string());
        }
        if lower.contains("হুগামা") || lower.contains("হাঙ্গামা") || lower.contains("hugama") || lower.contains("hungama") {
            return Some("Hungama".to_string());
        }

        let stopwords = [
            "আমার", "দয়া করে", "দয়া করে", "প্লিজ", "please", "can you", "find", "heal", "recover",
            "hunt", "search", "চ্যানেলটি", "চ্যানেল", "হারিয়ে গেছে", "হারিয়ে গেছে", "হারিয়ে গিয়েছিলো",
            "খুঁজে দাও", "খুঁজে বের করো", "খুঁজে আনো", "যোগ করো", "এড করো", "অ্যাড করো", "ডাটাবেসে",
            "ডাটাবেজ এ", "ডাটাবেজে", "চলছে না", "কাজ করছে না", "নষ্ট হয়ে গেছে", "fixed",
            "not working", "broken", "stream", "missing", "lost", "channel", "tv", "টিভি"
        ];

        let mut text = clean.to_string();
        for word in &stopwords {
            text = text.replace(word, " ");
        }
        let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if !cleaned.is_empty() && cleaned.len() >= 2 {
            Some(cleaned)
        } else {
            None
        }
    }
}
