// src/playlist/validator.rs
// Deep stream health verification, actual payload inspection, and link update detection

use crate::domain::Channel;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamProbeResult {
    pub is_alive: bool,
    pub is_actual_stream: bool,
    pub redirected_url: Option<String>,
    pub status_code: u16,
    pub content_type: String,
    pub failure_reason: Option<String>,
}

#[derive(Clone)]
pub struct StreamValidator {
    client: reqwest::Client,
}

impl Default for StreamValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl StreamValidator {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(3500))
            .connect_timeout(Duration::from_millis(2000))
            .danger_accept_invalid_certs(true)
            .redirect(reqwest::redirect::Policy::limited(6))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self { client }
    }

    /// Performs deep packet actual stream inspection.
    /// Rejects fake 200 HTML pages, Cloudflare blocks, and validates real M3U8/TS signatures.
    pub async fn verify_stream_actual(&self, url: &str) -> StreamProbeResult {
        let request = self.client.get(url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .header("Accept", "*/*")
            .header("Range", "bytes=0-2047");

        let resp = match request.send().await {
            Ok(r) => r,
            Err(e) => {
                return StreamProbeResult {
                    is_alive: false,
                    is_actual_stream: false,
                    redirected_url: None,
                    status_code: 0,
                    content_type: String::new(),
                    failure_reason: Some(e.to_string()),
                };
            }
        };

        let status = resp.status().as_u16();
        let final_url = resp.url().as_str().to_string();
        let redirected_url = if final_url.trim_end_matches('/') != url.trim_end_matches('/') {
            Some(final_url)
        } else {
            None
        };

        // If status code is an explicit error (404, 403, 500, etc.)
        if !resp.status().is_success() && status != 206 && status != 302 && status != 301 {
            return StreamProbeResult {
                is_alive: false,
                is_actual_stream: false,
                redirected_url,
                status_code: status,
                content_type: String::new(),
                failure_reason: Some(format!("HTTP Error {}", status)),
            };
        }

        let content_type = resp.headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        // Fetch up to 2KB chunk
        let bytes = match resp.bytes().await {
            Ok(b) => b,
            Err(e) => {
                return StreamProbeResult {
                    is_alive: false,
                    is_actual_stream: false,
                    redirected_url,
                    status_code: status,
                    content_type,
                    failure_reason: Some(format!("Read error: {}", e)),
                };
            }
        };

        if bytes.is_empty() {
            return StreamProbeResult {
                is_alive: false,
                is_actual_stream: false,
                redirected_url,
                status_code: status,
                content_type,
                failure_reason: Some("Empty response body".to_string()),
            };
        }

        // Check for fake 200 HTML error pages (Cloudflare, 404 landing pages, captive portals)
        let is_html_type = content_type.contains("text/html");
        let text_snippet = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]).to_lowercase();

        if is_html_type
            || text_snippet.contains("<html")
            || text_snippet.contains("<!doctype")
            || text_snippet.contains("access denied")
            || text_snippet.contains("error 404")
            || text_snippet.contains("stream not found")
            || text_snippet.contains("channel offline")
        {
            return StreamProbeResult {
                is_alive: false,
                is_actual_stream: false,
                redirected_url,
                status_code: status,
                content_type,
                failure_reason: Some("Fake stream: server returned HTML error page".to_string()),
            };
        }

        // Actual Stream Signature Checks:
        // 1. HLS Playlist: starts with or contains #EXTM3U, #EXT-X-, #EXTINF, or .ts/.m4s references
        let is_hls = text_snippet.contains("#extm3u")
            || text_snippet.contains("#ext-x-")
            || text_snippet.contains("#extinf")
            || text_snippet.contains(".ts")
            || text_snippet.contains(".m4s");

        // 2. MPEG-TS stream sync byte (0x47)
        let is_mpeg_ts = bytes[0] == 0x47 || (bytes.len() > 188 && bytes[188] == 0x47);

        // 3. Legitimate video/audio content-type header
        let is_video_header = content_type.contains("mpegurl")
            || content_type.contains("video/")
            || content_type.contains("audio/")
            || content_type.contains("octet-stream");

        let is_actual_stream = is_hls || is_mpeg_ts || (is_video_header && !is_html_type);

        if !is_actual_stream {
            return StreamProbeResult {
                is_alive: false,
                is_actual_stream: false,
                redirected_url,
                status_code: status,
                content_type,
                failure_reason: Some("Payload lacks video stream signature".to_string()),
            };
        }

        StreamProbeResult {
            is_alive: true,
            is_actual_stream: true,
            redirected_url,
            status_code: status,
            content_type,
            failure_reason: None,
        }
    }

    /// Verifies a single channel, auto-detects redirected URL changes,
    /// and promotes a working fallback/mirror if the primary link is dead.
    pub async fn verify_and_heal_channel(&self, channel: &mut Channel) -> bool {
        // Step 1: Probe current primary URL
        let result = self.verify_stream_actual(&channel.url).await;
        if result.is_alive && result.is_actual_stream {
            if let Some(new_url) = result.redirected_url {
                channel.url = new_url;
            }
            return true;
        }

        // Step 2: Primary is dead. Check fallback/mirror URLs if present
        for fallback in &channel.fallback_urls {
            let mirror_res = self.verify_stream_actual(fallback).await;
            if mirror_res.is_alive && mirror_res.is_actual_stream {
                // Working mirror found: promote mirror to primary URL!
                let new_primary = mirror_res.redirected_url.unwrap_or_else(|| fallback.clone());
                channel.url = new_primary;
                return true;
            }
        }

        false
    }

    /// High-throughput concurrent channel verifier using a Semaphore pool.
    /// Returns (alive_channels, dead_channels_count, links_auto_updated_count).
    pub async fn verify_channels_parallel(
        &self,
        channels: Vec<Channel>,
        concurrency: usize,
    ) -> (Vec<Channel>, usize, usize) {
        let sem = Arc::new(Semaphore::new(concurrency));
        let mut tasks = Vec::with_capacity(channels.len());

        for mut ch in channels {
            let sem = Arc::clone(&sem);
            let validator = self.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = match sem.acquire().await {
                    Ok(p) => p,
                    Err(_) => return (ch, false, false),
                };
                let orig_url = ch.url.clone();
                let is_alive = validator.verify_and_heal_channel(&mut ch).await;
                let link_updated = is_alive && ch.url != orig_url;
                (ch, is_alive, link_updated)
            }));
        }

        let mut alive_channels = Vec::new();
        let mut dead_count = 0;
        let mut updated_links_count = 0;

        for task in tasks {
            if let Ok((ch, is_alive, link_updated)) = task.await {
                if is_alive {
                    if link_updated {
                        updated_links_count += 1;
                    }
                    alive_channels.push(ch);
                } else {
                    dead_count += 1;
                }
            }
        }

        (alive_channels, dead_count, updated_links_count)
    }
}
