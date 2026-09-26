// src/playlist/parser.rs
// High-performance streaming parser for M3U playlists with multi-URL fallback support

use crate::domain::Channel;
use crate::error::{PlaylistError, PlaylistResult};
use std::collections::HashMap;

pub struct M3uParser;

impl M3uParser {
    pub fn parse(content: &str) -> PlaylistResult<Vec<Channel>> {
        let mut channels: Vec<Channel> = Vec::with_capacity(1024);
        let mut name_to_index: HashMap<String, usize> = HashMap::with_capacity(1024);
        let mut current_name = String::new();
        let mut current_logo: Option<String> = None;
        let mut current_group = String::from("General");
        let mut current_provider: Option<String> = None;
        let mut current_ua: Option<String> = None;
        let mut current_ref: Option<String> = None;
        let mut current_fallbacks: Vec<String> = Vec::new();
        let mut in_channel = false;

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if line.starts_with("#EXTINF:") {
                in_channel = true;
                current_logo = Self::extract_attribute(line, "tvg-logo");
                current_group = Self::extract_attribute(line, "group-title")
                    .unwrap_or_else(|| "General".to_string());
                current_provider = Self::extract_attribute(line, "provider");
                current_name = Self::extract_channel_name(line);
                current_ua = None;
                current_ref = None;
                current_fallbacks.clear();
            } else if line.starts_with("#EXTVLCOPT:") {
                let directive = &line["#EXTVLCOPT:".len()..];
                if let Some(ua) = directive.strip_prefix("http-user-agent=") {
                    current_ua = Some(ua.to_string());
                } else if let Some(rf) = directive.strip_prefix("http-referrer=") {
                    current_ref = Some(rf.to_string());
                }
            } else if line.starts_with("#EXTFALLBACK:") || line.starts_with("#EXT-X-FALLBACK:") {
                let fallback = if line.starts_with("#EXTFALLBACK:") {
                    line["#EXTFALLBACK:".len()..].trim().to_string()
                } else {
                    line["#EXT-X-FALLBACK:".len()..].trim().to_string()
                };
                if !fallback.is_empty() {
                    if in_channel {
                        if !current_fallbacks.contains(&fallback) {
                            current_fallbacks.push(fallback);
                        }
                    } else if let Some(last) = channels.last_mut() {
                        if !last.fallback_urls.contains(&fallback) && last.url != fallback {
                            last.fallback_urls.push(fallback);
                        }
                    }
                }
            } else if !line.starts_with('#') && in_channel {
                let url = line.to_string();
                if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("rtmp://") {
                    let key = current_name.to_lowercase();
                    
                    // Auto-infer provider if not set
                    let provider = current_provider.clone().or_else(|| {
                        let u = url.to_lowercase();
                        if u.contains("pluto.tv") {
                            Some("Pluto TV".to_string())
                        } else if u.contains("samsung") {
                            Some("Samsung TV Plus".to_string())
                        } else if u.contains("plex") {
                            Some("Plex".to_string())
                        } else if u.contains("roku") {
                            Some("Roku".to_string())
                        } else if u.contains("free-tv") {
                            Some("Free-TV".to_string())
                        } else if u.contains("amazeyourself") || u.contains("cloudplay") || u.contains("sonyliv") {
                            Some("Regional India".to_string())
                        } else {
                            Some("IPTV-Org".to_string())
                        }
                    });

                    if let Some(&idx) = name_to_index.get(&key) {
                        let existing = &mut channels[idx];
                        if !existing.fallback_urls.contains(&url) && existing.url != url {
                            existing.fallback_urls.push(url);
                        }
                        for fb in &current_fallbacks {
                            if !existing.fallback_urls.contains(fb) && existing.url != *fb {
                                existing.fallback_urls.push(fb.clone());
                            }
                        }
                    } else {
                        let idx = channels.len();
                        name_to_index.insert(key, idx);
                        let mut ch = Channel::new(
                            current_name.clone(),
                            current_logo.clone(),
                            current_group.clone(),
                            url,
                            current_ua.clone(),
                            current_ref.clone(),
                        ).with_provider(provider);
                        ch.fallback_urls = current_fallbacks.clone();
                        channels.push(ch);
                    }
                }
                in_channel = false;
                current_fallbacks.clear();
            }
        }

        if channels.is_empty() {
            return Err(PlaylistError::InvalidFormat);
        }

        Ok(channels)
    }

    fn extract_attribute(line: &str, attr_name: &str) -> Option<String> {
        let pattern = format!("{}=\"", attr_name);
        if let Some(start) = line.find(&pattern) {
            let rest = &line[start + pattern.len()..];
            if let Some(end) = rest.find('"') {
                let val = rest[..end].trim();
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
        None
    }

    fn extract_channel_name(line: &str) -> String {
        if let Some(comma_pos) = line.rfind(',') {
            let candidate = line[comma_pos + 1..].trim();
            if !candidate.is_empty() {
                return candidate.to_string();
            }
        }
        if let Some(tvg_name) = Self::extract_attribute(line, "tvg-name") {
            return tvg_name;
        }
        "Unknown Channel".to_string()
    }
}
