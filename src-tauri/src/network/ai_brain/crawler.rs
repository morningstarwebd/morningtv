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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepHuntReport {
    pub success: bool,
    pub active_url: Option<String>,
    pub channel_metadata: Option<DiscoveredChannel>,
    pub searched_sources_count: usize,
    pub searched_sources: Vec<String>,
    pub is_drm_or_paytv: bool,
    pub diagnostic_reason: String,
    pub suggestions: Vec<String>,
}

pub const GITHUB_DEEP_SOURCES: &[(&str, &str)] = &[
    (
        "IPTV-Org India Streams",
        "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u",
    ),
    (
        "IPTV-Org India Airtel",
        "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in_airtel.m3u",
    ),
    (
        "IPTV-Org India Jio Public",
        "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in_jio.m3u",
    ),
    (
        "IPTV-Org India Country Index",
        "https://iptv-org.github.io/iptv/countries/in.m3u",
    ),
    (
        "IPTV-Org Kids Category",
        "https://iptv-org.github.io/iptv/categories/kids.m3u",
    ),
    (
        "IPTV-Org Animation Category",
        "https://iptv-org.github.io/iptv/categories/animation.m3u",
    ),
    (
        "IPTV-Org Bangladesh",
        "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/bd.m3u",
    ),
    (
        "IPTV-Org Bengali Language",
        "https://iptv-org.github.io/iptv/languages/ben.m3u",
    ),
    (
        "IPTV-Org Hindi Language",
        "https://iptv-org.github.io/iptv/languages/hin.m3u",
    ),
    (
        "IPTV-Org Entertainment",
        "https://iptv-org.github.io/iptv/categories/entertainment.m3u",
    ),
    (
        "IPTV-Org Movies",
        "https://iptv-org.github.io/iptv/categories/movies.m3u",
    ),
    (
        "Samsung TV Plus India",
        "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_in.m3u",
    ),
    (
        "Free-TV Global Master",
        "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    ),
];

pub fn check_known_drm_paytv(name: &str) -> Option<(&'static str, &'static str)> {
    let lower = name.to_lowercase();
    let norm: String = lower.chars().filter(|c| c.is_ascii_alphanumeric()).collect();

    if norm.contains("pogo") {
        return Some((
            "Pogo TV",
            "Warner Bros. Discovery (India). Broadcasts on Pay-TV (DTH/Cable) with Widevine DRM on JioTV/Tata Play.",
        ));
    }
    if norm.contains("cartoonnetwork") || norm.contains("cnindia") {
        return Some((
            "Cartoon Network India",
            "Warner Bros. Discovery. Broadcasts on Pay-TV/OTT platforms with Widevine DRM.",
        ));
    }
    if norm.contains("disneychannel")
        || norm.contains("disneyjunior")
        || norm.contains("superhungama")
    {
        return Some((
            "Disney Network India",
            "The Walt Disney Company India. Pay-TV encrypted.",
        ));
    }
    if norm.contains("starsports") {
        return Some((
            "Star Sports",
            "Disney Star. Encrypted Pay-TV sports network (requires Hotstar/Tata Play subscription).",
        ));
    }
    if norm.contains("sonysports") || norm.contains("sonyten") {
        return Some((
            "Sony Sports Ten",
            "Sony Pictures Networks India. Encrypted Pay-TV network (requires Sony LIV/Tata Play subscription).",
        ));
    }
    if norm.contains("discoverychannel") || norm.contains("animalplanet") {
        return Some((
            "Discovery Channel",
            "Warner Bros. Discovery. Encrypted Pay-TV network.",
        ));
    }
    if norm.contains("hbo") || norm.contains("cinemax") {
        return Some((
            "HBO",
            "Home Box Office. Proprietary encrypted Pay-TV network.",
        ));
    }
    None
}

pub struct StreamCrawler;

impl StreamCrawler {
    /// Comprehensive Autonomous Deep Hunt:
    /// Sweeps Local Backup Mirrors, User Custom Settings Sources, Upstream Providers, and 13+ GitHub IPTV Repositories.
    pub async fn deep_hunt(channel_name: &str, custom_sources: &[String]) -> DeepHuntReport {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(3500))
            .connect_timeout(Duration::from_millis(1800))
            .build()
        {
            Ok(c) => c,
            Err(_) => {
                return DeepHuntReport {
                    success: false,
                    active_url: None,
                    channel_metadata: None,
                    searched_sources_count: 0,
                    searched_sources: vec![],
                    is_drm_or_paytv: false,
                    diagnostic_reason: "Failed to initialize HTTP client for stream hunting"
                        .to_string(),
                    suggestions: vec![],
                }
            }
        };

        let mut searched_source_names = Vec::new();

        // 0. Direct URL Check: If the user passed a direct HTTP/HTTPS stream link
        if channel_name.starts_with("http://") || channel_name.starts_with("https://") {
            let res = sentinel::probe_single_url(&client, channel_name).await;
            if res.ok {
                let name = channel_name
                    .split('/')
                    .last()
                    .unwrap_or("Custom Stream")
                    .replace(".m3u8", "")
                    .replace(".m3u", "");
                let meta = DiscoveredChannel {
                    name,
                    url: res.active_url.clone(),
                    group: "Custom".to_string(),
                    logo: "".to_string(),
                    provider: "User Direct Stream".to_string(),
                    fallbacks: vec![],
                };
                return DeepHuntReport {
                    success: true,
                    active_url: Some(res.active_url),
                    channel_metadata: Some(meta),
                    searched_sources_count: 1,
                    searched_sources: vec!["Direct Stream URL".to_string()],
                    is_drm_or_paytv: false,
                    diagnostic_reason: "Direct stream link verified and active".to_string(),
                    suggestions: vec![],
                };
            }
        }

        let target_norm: String = channel_name
            .to_lowercase()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();

        // 1. Probe Known Verified Backup Mirrors First (instant zero-latency fallback)
        searched_source_names.push("Sentinel Verified Master Backup Mirrors".to_string());
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

                        let meta = DiscoveredChannel {
                            name: display_name,
                            url: res.active_url.clone(),
                            group: "India".to_string(),
                            logo: "".to_string(),
                            provider: "Sentinel / AI Neural Backup".to_string(),
                            fallbacks: mirrors
                                .iter()
                                .filter(|&&u| u != m)
                                .map(|u| u.to_string())
                                .collect(),
                        };

                        return DeepHuntReport {
                            success: true,
                            active_url: Some(res.active_url),
                            channel_metadata: Some(meta),
                            searched_sources_count: searched_source_names.len(),
                            searched_sources: searched_source_names,
                            is_drm_or_paytv: false,
                            diagnostic_reason: "Recovered from high-speed master backup mirror"
                                .to_string(),
                            suggestions: vec![],
                        };
                    }
                }
            }
        }

        // 2. Scan User Custom Upstream Sources (Configured in Settings)
        for (i, src) in custom_sources.iter().enumerate() {
            searched_source_names.push(format!("Custom Upstream Source #{}", i + 1));
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
                                    let meta = DiscoveredChannel {
                                        name: item.name,
                                        url: res.active_url.clone(),
                                        group: item.group,
                                        logo: item.logo,
                                        provider: item.provider,
                                        fallbacks: item.fallbacks,
                                    };
                                    return DeepHuntReport {
                                        success: true,
                                        active_url: Some(res.active_url),
                                        channel_metadata: Some(meta),
                                        searched_sources_count: searched_source_names.len(),
                                        searched_sources: searched_source_names,
                                        is_drm_or_paytv: false,
                                        diagnostic_reason:
                                            "Found in user custom upstream playlist".to_string(),
                                        suggestions: vec![],
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Scan Built-in Upstream Providers (India, Bengali, Regional, Kids & Global)
        for provider in sentinel::UPSTREAM_PROVIDERS {
            searched_source_names.push(provider.name.to_string());
            if let Ok(resp) = client
                .get(provider.url)
                .timeout(Duration::from_secs(5))
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(
                            &text,
                            provider.default_group,
                            provider.provider,
                            provider.is_vip,
                        );
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
                                    let meta = DiscoveredChannel {
                                        name: item.name,
                                        url: res.active_url.clone(),
                                        group: item.group,
                                        logo: item.logo,
                                        provider: item.provider,
                                        fallbacks: item.fallbacks,
                                    };
                                    return DeepHuntReport {
                                        success: true,
                                        active_url: Some(res.active_url),
                                        channel_metadata: Some(meta),
                                        searched_sources_count: searched_source_names.len(),
                                        searched_sources: searched_source_names,
                                        is_drm_or_paytv: false,
                                        diagnostic_reason: format!(
                                            "Verified and fetched from {}",
                                            provider.name
                                        ),
                                        suggestions: vec![],
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Deep GitHub Public IPTV Repositories Sweep (Airtel, Jio, BD, Kids, Animation, Entertainment)
        for &(src_name, gh_url) in GITHUB_DEEP_SOURCES {
            searched_source_names.push(src_name.to_string());
            if let Ok(resp) = client
                .get(gh_url)
                .timeout(Duration::from_secs(5))
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let items = sentinel::parse_m3u(
                            &text,
                            "Global Index",
                            "GitHub IPTV Hunter",
                            false,
                        );
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
                                    let meta = DiscoveredChannel {
                                        name: item.name,
                                        url: res.active_url.clone(),
                                        group: item.group,
                                        logo: item.logo,
                                        provider: format!("GitHub / {}", src_name),
                                        fallbacks: item.fallbacks,
                                    };
                                    return DeepHuntReport {
                                        success: true,
                                        active_url: Some(res.active_url),
                                        channel_metadata: Some(meta),
                                        searched_sources_count: searched_source_names.len(),
                                        searched_sources: searched_source_names,
                                        is_drm_or_paytv: false,
                                        diagnostic_reason: format!(
                                            "Discovered on GitHub IPTV repository ({})",
                                            src_name
                                        ),
                                        suggestions: vec![],
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Exhaustive Evaluation: Channel was not found across any source
        let is_drm = check_known_drm_paytv(channel_name).is_some();
        let suggestions = if is_drm || target_norm.contains("pogo") || target_norm.contains("kid")
        {
            vec![
                "Hungama".to_string(),
                "Sony YAY!".to_string(),
                "Gubbare".to_string(),
                "Cartoon Network (Open Stream)".to_string(),
            ]
        } else {
            vec![
                "Zee Bangla HD".to_string(),
                "Star Jalsha".to_string(),
                "Colors Bangla".to_string(),
                "Sony Aath".to_string(),
            ]
        };

        DeepHuntReport {
            success: false,
            active_url: None,
            channel_metadata: None,
            searched_sources_count: searched_source_names.len(),
            searched_sources: searched_source_names,
            is_drm_or_paytv: is_drm,
            diagnostic_reason: if is_drm {
                "Channel is an encrypted Pay-TV broadcast requiring Widevine DRM / token authorization."
                    .to_string()
            } else {
                "No active unencrypted stream found across any public repository.".to_string()
            },
            suggestions,
        }
    }

    /// Autonomously crawls upstream feeds, backup mirrors, custom sources, and GitHub IPTV indices
    pub async fn hunt_channel_stream(
        channel_name: &str,
        custom_sources: &[String],
    ) -> Option<String> {
        Self::deep_hunt(channel_name, custom_sources).await.active_url
    }

    /// Autonomously searches upstream provider feeds, mirrors, and custom sources to discover a lost channel metadata
    pub async fn discover_channel(
        channel_name: &str,
        custom_sources: &[String],
    ) -> Option<DiscoveredChannel> {
        Self::deep_hunt(channel_name, custom_sources)
            .await
            .channel_metadata
    }

    /// Intelligently parses target channel name from user prompt in Bengali or English
    pub fn extract_channel_target(msg: &str) -> Option<String> {
        let clean = msg.trim();
        if clean.starts_with("/heal ")
            || clean.starts_with("\\heal ")
            || clean.starts_with("/hunt ")
            || clean.starts_with("\\hunt ")
            || clean.starts_with("/find ")
            || clean.starts_with("\\find ")
            || clean.starts_with("/add ")
            || clean.starts_with("\\add ")
            || clean.starts_with("/addchannel ")
            || clean.starts_with("\\addchannel ")
        {
            let target = clean
                .split_whitespace()
                .skip(1)
                .collect::<Vec<_>>()
                .join(" ");
            let target = target.trim();
            if !target.is_empty() {
                return Some(target.to_string());
            }
        }

        let lower = clean.to_lowercase();
        if lower.contains("pogo") || lower.contains("পোগো") {
            return Some("Pogo".to_string());
        }
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
        if lower.contains("হুগামা")
            || lower.contains("হাঙ্গামা")
            || lower.contains("hugama")
            || lower.contains("hungama")
        {
            return Some("Hungama".to_string());
        }
        if lower.contains("কার্টুন নেটওয়ার্ক") || lower.contains("cartoon network") {
            return Some("Cartoon Network".to_string());
        }
        if lower.contains("সনি ইয়ে") || lower.contains("sony yay") {
            return Some("Sony YAY!".to_string());
        }

        let stopwords = [
            "আমার",
            "দয়া করে",
            "দয়া করে",
            "প্লিজ",
            "please",
            "can you",
            "find",
            "heal",
            "recover",
            "hunt",
            "search",
            "চ্যানেলটি",
            "চ্যানেল",
            "হারিয়ে গেছে",
            "হারিয়ে গেছে",
            "হারিয়ে গিয়েছিলো",
            "খুঁজে দাও",
            "খুঁজে বের করো",
            "খুঁজে আনো",
            "যোগ করো",
            "এড করো",
            "অ্যাড করো",
            "ডাটাবেসে",
            "ডাটাবেজ এ",
            "ডাটাবেজে",
            "চলছে না",
            "কাজ করছে না",
            "নষ্ট হয়ে গেছে",
            "fixed",
            "not working",
            "broken",
            "stream",
            "missing",
            "lost",
            "channel",
            "tv",
            "টিভি",
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

    /// Extracts custom stream URL and channel name if user pasted a stream link in chat
    pub fn extract_custom_stream_intent(msg: &str) -> Option<(String, String)> {
        let clean = msg.trim();
        let url_start = clean.find("http://").or_else(|| clean.find("https://"))?;
        let after_url = &clean[url_start..];
        let url_end = after_url.find(char::is_whitespace).unwrap_or(after_url.len());
        let stream_url = &after_url[..url_end];

        let mut name = clean[..url_start].trim().to_string();
        if name.is_empty() && clean.len() > url_start + url_end {
            name = clean[url_start + url_end..].trim().to_string();
        }

        let stopwords = [
            "add channel",
            "add stream",
            "add",
            "channel",
            "stream",
            "for",
            "named",
            "নতুন চ্যানেল",
            "অ্যাড করো",
            "যোগ করো",
        ];
        for s in stopwords {
            name = name.replace(s, " ");
        }
        let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
        let final_name = if name.is_empty() {
            "Custom Channel".to_string()
        } else {
            name
        };

        Some((final_name, stream_url.to_string()))
    }
}
