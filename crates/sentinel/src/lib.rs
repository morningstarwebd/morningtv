// crates/sentinel/src/lib.rs
// MorningTV Stream Sentinel 3.0: High-Speed Tokio Multi-Threaded Channel Auditor Library

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Semaphore;

#[derive(Clone, Debug, PartialEq)]
pub struct UpstreamProvider {
    pub name: &'static str,
    pub url: &'static str,
    pub default_group: &'static str,
    pub provider: &'static str,
    pub is_fast_cdn: bool,
    pub is_vip: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ChannelItem {
    pub name: String,
    pub id: String,
    pub logo: String,
    pub group: String,
    pub provider: String,
    pub url: String,
    pub fallbacks: Vec<String>,
    pub is_fast_cdn: bool,
    pub is_vip: bool,
}

#[derive(Debug, PartialEq, Clone)]
pub struct ProbeResult {
    pub ok: bool,
    pub active_url: String,
    pub latency_ms: u64,
}

pub const UPSTREAM_PROVIDERS: &[UpstreamProvider] = &[
    UpstreamProvider {
        name: "IPTV-Org Global Master Index",
        url: "https://iptv-org.github.io/iptv/index.m3u",
        default_group: "General",
        provider: "IPTV-Org",
        is_fast_cdn: false,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org India (Sony, Zee, Colors, Star, DD, News)",
        url: "https://iptv-org.github.io/iptv/countries/in.m3u",
        default_group: "India",
        provider: "IPTV-Org India",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Bengali (Kolkata & Bangladesh)",
        url: "https://iptv-org.github.io/iptv/languages/ben.m3u",
        default_group: "India",
        provider: "IPTV-Org Bengali",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Bangladesh",
        url: "https://iptv-org.github.io/iptv/countries/bd.m3u",
        default_group: "India",
        provider: "IPTV-Org Bangladesh",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Hindi Entertainment",
        url: "https://iptv-org.github.io/iptv/languages/hin.m3u",
        default_group: "India",
        provider: "IPTV-Org Hindi",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "Samsung TV Plus (India)",
        url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_in.m3u",
        default_group: "India",
        provider: "Samsung TV Plus",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "Samsung TV Plus (Global & US)",
        url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_us.m3u",
        default_group: "Entertainment",
        provider: "Samsung TV Plus",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "Pluto TV (Official)",
        url: "https://raw.githubusercontent.com/BuddyChewChew/pluto/main/pluto_us.m3u",
        default_group: "Entertainment",
        provider: "Pluto TV",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "Plex Live TV",
        url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plex_all.m3u",
        default_group: "Entertainment",
        provider: "Plex",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "Roku Live TV",
        url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u",
        default_group: "Entertainment",
        provider: "Roku",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "Free-TV Global Master",
        url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
        default_group: "General",
        provider: "Free-TV",
        is_fast_cdn: true,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Sports",
        url: "https://iptv-org.github.io/iptv/categories/sports.m3u",
        default_group: "Sports",
        provider: "IPTV-Org",
        is_fast_cdn: false,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Movies",
        url: "https://iptv-org.github.io/iptv/categories/movies.m3u",
        default_group: "Movies",
        provider: "IPTV-Org",
        is_fast_cdn: false,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org News",
        url: "https://iptv-org.github.io/iptv/categories/news.m3u",
        default_group: "News",
        provider: "IPTV-Org",
        is_fast_cdn: false,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Animation & Kids",
        url: "https://iptv-org.github.io/iptv/categories/animation.m3u",
        default_group: "Kids",
        provider: "IPTV-Org",
        is_fast_cdn: false,
        is_vip: false,
    },
    UpstreamProvider {
        name: "IPTV-Org Music",
        url: "https://iptv-org.github.io/iptv/categories/music.m3u",
        default_group: "Music",
        provider: "IPTV-Org",
        is_fast_cdn: false,
        is_vip: false,
    },
];

pub fn is_vip_channel(name: &str, id: &str) -> bool {
    let s = format!("{} {}", name, id).to_lowercase();
    s.contains("zee bangla")
        || s.contains("star jalsha")
        || s.contains("colors bangla")
        || s.contains("sony aath")
        || s.contains("sony pal")
        || s.contains("sony sab")
        || s.contains("sony max")
        || s.contains("sony sports")
        || s.contains("sony ten")
        || s.contains("sony yay")
        || s.contains("sony wah")
        || s.contains("sony bbc earth")
        || s.contains("sony pix")
        || s.contains("sony entertainment")
        || s.contains("colors hd")
        || s.contains("colors cineplex")
        || s.contains("colors rishtey")
        || s.contains("zee news")
        || s.contains("zee cinema")
        || s.contains("zee tv")
        || s.contains("zee 24 ghanta")
        || s.contains("star sports")
        || s.contains("star plus")
        || s.contains("abp ananda")
        || s.contains("calcutta news")
        || s.contains("kolkata tv")
        || s.contains("tv9 bangla")
        || s.contains("news18 bangla")
        || s.contains("republic bangla")
        || s.contains("dd bangla")
        || s.contains("dd sports")
        || s.contains("t sports")
        || s.contains("gazi tv")
        || s.contains("gtv")
}

pub const KNOWN_BACKUP_MIRRORS: &[(&str, &[&str])] = &[
    ("colorshd", &["https://d1g8wgjurz8via.cloudfront.net/bpk-tv/ColorsHD/default/ColorsHD.m3u8"]),
    ("zeebangla", &["https://live-bangla.akamaized.net/liveabr/playlist.m3u8"]),
    ("starjalsha", &["https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starjalsha.smil/chunklist_b1928000.m3u8"]),
];

pub fn matches_backup_mirror_key(channel_name: &str, tvg_id: &str, key: &str) -> bool {
    let norm_name: String = channel_name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    let norm_id: String = if !tvg_id.is_empty() {
        let base = tvg_id.split('@').next().unwrap_or(tvg_id).to_lowercase();
        base.chars().filter(|c| c.is_ascii_alphanumeric()).collect()
    } else {
        String::new()
    };

    match key {
        "colorshd" => {
            // Must strictly match Colors HD / Colors Hindi, and NEVER regional variants (Gujarati, Rishtey, Cineplex, Bangla, Marathi, etc.)
            let is_regional = norm_name.contains("bangla")
                || norm_name.contains("gujarati")
                || norm_name.contains("cineplex")
                || norm_name.contains("rishtey")
                || norm_name.contains("marathi")
                || norm_name.contains("kannada")
                || norm_name.contains("tamil")
                || norm_name.contains("infinity");
            !is_regional
                && (norm_name == "colorshd"
                    || norm_name == "colors"
                    || norm_id == "colorshdin"
                    || norm_id == "colorsin")
        }
        "zeebangla" => {
            norm_name.starts_with("zeebangla") || norm_id.starts_with("zeebangla")
        }
        "starjalsha" => {
            norm_name.starts_with("starjalsha") || norm_id.starts_with("starjalsha")
        }
        "tsports" => {
            norm_name == "tsports" || norm_id.starts_with("tsports")
        }
        _ => norm_name == key || norm_id == key,
    }
}

pub fn clean_channel_name(name: &str) -> String {
    let mut s = name.to_string();
    let patterns = [
        "(1080p)", "(720p)", "(576p)", "(480p)", "(360p)", "(240p)", "(1080i)",
        "[1080p]", "[720p]", "[576p]", "[480p]", "[360p]", "[240p]", "[1080i]",
        "(fhd)", "[fhd]", "(4k)", "[4k]", "(uhd)", "[uhd]",
        "[not 24/7]", "(not 24/7)", "[geo-blocked]", "(geo-blocked)",
        "[backup]", "(backup)", "[mirror]", "(mirror)",
    ];

    let mut lower = s.to_lowercase();
    for p in patterns {
        while let Some(pos) = lower.find(p) {
            s.replace_range(pos..pos + p.len(), "");
            lower = s.to_lowercase();
        }
    }
    s.trim().to_string()
}

pub fn normalize_channel_key(name: &str, tvg_id: &str) -> String {
    let clean_id = if tvg_id.starts_with('[') && tvg_id.contains(']') {
        let inside = &tvg_id[1..tvg_id.find(']').unwrap_or(tvg_id.len())];
        inside.to_string()
    } else {
        tvg_id.to_string()
    };

    if !clean_id.is_empty() && clean_id.len() > 3 && !clean_id.starts_with("http") {
        let base = clean_id.split('@').next().unwrap_or(&clean_id).to_lowercase();
        let alphanum: String = base.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
        if alphanum.len() >= 3 {
            return alphanum;
        }
    }

    let cleaned_name = clean_channel_name(name);
    cleaned_name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

pub fn parse_m3u(
    content: &str,
    default_group: &str,
    provider: &str,
    is_vip: bool,
) -> Vec<ChannelItem> {
    let mut items = Vec::with_capacity(1024);
    let mut current_name = String::new();
    let mut current_id = String::new();
    let mut current_logo = String::new();
    let mut current_group = default_group.to_string();
    let mut current_fallbacks = Vec::new();
    let mut in_channel = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if line.starts_with("#EXTINF:") {
            in_channel = true;
            current_fallbacks.clear();
            current_id = extract_attribute(line, "tvg-id").unwrap_or_default();
            current_logo = extract_attribute(line, "tvg-logo").unwrap_or_default();
            current_group = extract_attribute(line, "group-title")
                .unwrap_or_else(|| default_group.to_string());

            current_name = if let Some(comma_pos) = line.rfind(',') {
                line[comma_pos + 1..].trim().to_string()
            } else if let Some(n) = extract_attribute(line, "tvg-name") {
                n
            } else {
                "Unknown Channel".to_string()
            };
        } else if line.starts_with("#EXTFALLBACK:") || line.starts_with("#EXT-X-FALLBACK:") {
            let fb = if let Some(s) = line.strip_prefix("#EXTFALLBACK:") {
                s.trim().to_string()
            } else if let Some(s) = line.strip_prefix("#EXT-X-FALLBACK:") {
                s.trim().to_string()
            } else {
                String::new()
            };
            if !fb.is_empty() && !current_fallbacks.contains(&fb) {
                current_fallbacks.push(fb);
            }
        } else if !line.starts_with('#') && in_channel {
            let url = line.to_string();
            if url.starts_with("http://") || url.starts_with("https://") {
                let vip = is_vip || is_vip_channel(&current_name, &current_id);

                // Attach candidate backup mirrors strictly matching this canonical channel
                for &(k, mirrors) in KNOWN_BACKUP_MIRRORS {
                    if matches_backup_mirror_key(&current_name, &current_id, k) {
                        for &m in mirrors {
                            let m_str = m.to_string();
                            if m_str != url && !current_fallbacks.contains(&m_str) {
                                current_fallbacks.push(m_str);
                            }
                        }
                    }
                }

                items.push(ChannelItem {
                    name: current_name.clone(),
                    id: current_id.clone(),
                    logo: current_logo.clone(),
                    group: current_group.clone(),
                    provider: provider.to_string(),
                    url,
                    fallbacks: current_fallbacks.clone(),
                    is_fast_cdn: false,
                    is_vip: vip,
                });
            }
            in_channel = false;
            current_fallbacks.clear();
        }
    }

    items
}

pub fn extract_attribute(line: &str, attr: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr);
    if let Some(start) = line.find(&pattern) {
        let rest = &line[start + pattern.len()..];
        if let Some(end) = rest.find('"') {
            return Some(rest[..end].trim().to_string());
        }
    }
    None
}

/// Validates whether a response payload is a legitimate media stream (HLS manifest, MPEG-TS, fMP4, DASH, WebM/MKV, FLV, Ogg)
/// and not an HTML error/challenge or random text response.
pub fn is_valid_stream_payload(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return false;
    }

    let check_len = bytes.len().min(1024);
    let slice = &bytes[..check_len];
    let head = String::from_utf8_lossy(&slice[..slice.len().min(512)]).to_lowercase();

    // Check for HTML bot-challenge or error pages
    if head.contains("<!doctype html")
        || head.contains("<html")
        || head.contains("cloudflare")
        || head.contains("access denied")
        || head.contains("error 404")
        || head.contains("404 not found")
        || head.contains("ddos-guard")
        || head.contains("just a moment...")
    {
        return false;
    }

    // 1. Valid HLS manifest (#EXTM3U with standard HLS tags/directives)
    if head.contains("#extm3u")
        && (head.contains("#extinf")
            || head.contains("#ext-x-stream-inf")
            || head.contains("#ext-x-targetduration")
            || head.contains("#ext-x-media-sequence")
            || head.contains("#ext-x-version")
            || head.contains(".m3u8")
            || head.contains(".ts")
            || head.contains("http://")
            || head.contains("https://"))
    {
        return true;
    }

    // 2. MPEG-TS stream with verified 188-byte packet synchronization
    let len = slice.len();
    if len >= 188 {
        for offset in 0..188.min(len.saturating_sub(187)) {
            if slice[offset] == 0x47 {
                let second = offset + 188;
                let third = offset + 376;
                if second < len && slice[second] == 0x47 {
                    if third >= len || slice[third] == 0x47 {
                        return true;
                    }
                } else if len < 376 {
                    return true;
                }
            }
        }
    }

    // 3. fMP4 / CMAF initialization or media segment
    if len >= 8 {
        let box_type = &slice[4..8];
        if box_type == b"ftyp" || box_type == b"moof" || box_type == b"styp" || box_type == b"mdat" {
            return true;
        }
    }

    // 4. MPEG-DASH manifest (XML containing <MPD)
    if head.contains("<mpd") || head.contains("xmlns=\"urn:mpeg:dash:schema:mpd:2011\"") {
        return true;
    }

    // 5. Matroska / WebM EBML header
    if len >= 4 && slice[0..4] == [0x1A, 0x45, 0xDF, 0xA3] {
        return true;
    }

    // 6. FLV header (FLV\x01)
    if len >= 4 && slice[0..4] == [0x46, 0x4C, 0x56, 0x01] {
        return true;
    }

    // 7. Ogg container
    if len >= 4 && slice[0..4] == [0x4F, 0x67, 0x67, 0x53] {
        return true;
    }

    false
}

pub fn is_valid_stream_payload_with_content_type(bytes: &[u8], content_type: &str) -> bool {
    let ct = content_type.to_lowercase();
    if ct.contains("text/html") {
        return false;
    }

    let check_len = bytes.len().min(512);
    let head = String::from_utf8_lossy(&bytes[..check_len]).to_lowercase();
    if head.contains("<!doctype html")
        || head.contains("<html")
        || head.contains("cloudflare")
        || head.contains("access denied")
        || head.contains("error 404")
        || head.contains("404 not found")
        || head.contains("ddos-guard")
        || head.contains("just a moment...")
    {
        return false;
    }

    if ct.contains("mpegurl")
        || ct.contains("vnd.apple.mpegurl")
        || ct.contains("application/x-mpegurl")
        || ct.contains("video/")
        || ct.contains("audio/")
        || ct.contains("dash+xml")
    {
        return true;
    }

    is_valid_stream_payload(bytes)
}

pub async fn probe_single_url(client: &reqwest::Client, url: &str) -> ProbeResult {
    let lower_url = url.to_lowercase();
    if lower_url.contains("video_no_available")
        || lower_url.contains("not_available")
        || lower_url.contains("offline_stream")
    {
        return ProbeResult {
            ok: false,
            active_url: url.to_string(),
            latency_ms: u64::MAX,
        };
    }

    for attempt in 0..2 {
        let t0 = Instant::now();
        let res = client
            .get(url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .header("Range", "bytes=0-2048")
            .header("Accept", "*/*")
            .send()
            .await;

        match res {
            Ok(mut resp) => {
                let status = resp.status();
                let effective_url = resp.url().as_str().to_string();

                if status.is_success() || status.as_u16() == 206 {
                    let ct = resp
                        .headers()
                        .get(reqwest::header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .to_string();

                    // Read first chunk (up to 2048 bytes) so infinite live MPEG-TS streams don't stall
                    let mut bytes = Vec::with_capacity(2048);
                    while let Ok(Some(chunk)) = resp.chunk().await {
                        bytes.extend_from_slice(&chunk);
                        if bytes.len() >= 2048 {
                            break;
                        }
                    }

                    if is_valid_stream_payload_with_content_type(&bytes, &ct) {
                        let latency_ms = t0.elapsed().as_millis() as u64;
                        return ProbeResult {
                            ok: true,
                            active_url: effective_url,
                            latency_ms,
                        };
                    }
                }

                // If rate-limited (HTTP 429), back off politely to avoid IP bans
                if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    return ProbeResult {
                        ok: false,
                        active_url: url.to_string(),
                        latency_ms: u64::MAX,
                    };
                }

                // If explicit 4xx/5xx error, do not retry
                if status.is_client_error() || status.is_server_error() {
                    return ProbeResult {
                        ok: false,
                        active_url: url.to_string(),
                        latency_ms: u64::MAX,
                    };
                }
            }
            Err(_) => {
                if attempt == 0 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    continue;
                }
            }
        }
    }

    ProbeResult {
        ok: false,
        active_url: url.to_string(),
        latency_ms: u64::MAX,
    }
}

pub fn format_m3u(channels: &[ChannelItem]) -> String {
    let mut out = String::with_capacity(channels.len() * 180 + 32);
    out.push_str("#EXTM3U\n");
    for ch in channels {
        out.push_str(&format!(
            "#EXTINF:-1 tvg-id=\"{}\" tvg-name=\"{}\" tvg-logo=\"{}\" group-title=\"{}\" provider=\"{}\",{}\n",
            ch.id, ch.name, ch.logo, ch.group, ch.provider, ch.name
        ));
        for fb in &ch.fallbacks {
            out.push_str(&format!("#EXTFALLBACK: {}\n", fb));
        }
        out.push_str(&format!("{}\n", ch.url));
    }
    out
}

#[derive(serde::Deserialize, Default, Debug, Clone)]
pub struct DmcaBlacklist {
    #[serde(default)]
    pub blocked_channels: Vec<String>,
    #[serde(default)]
    pub blocked_domains: Vec<String>,
}

impl DmcaBlacklist {
    pub fn load_from_dir(dir: &Path) -> Self {
        let path = dir.join("dmca_blacklist.json");
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn is_blocked(&self, name: &str, id: &str, url: &str) -> bool {
        let n = name.to_lowercase();
        let i = id.to_lowercase();
        let u = url.to_lowercase();

        for b in &self.blocked_channels {
            let b_lower = b.trim().to_lowercase();
            if !b_lower.is_empty() && (n.contains(&b_lower) || i.contains(&b_lower)) {
                return true;
            }
        }

        for d in &self.blocked_domains {
            let d_lower = d.trim().to_lowercase();
            if !d_lower.is_empty() && u.contains(&d_lower) {
                return true;
            }
        }

        false
    }
}

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    println!("===============================================================");
    println!("🌅 MorningTV Stream Sentinel 3.0 (Native Tokio Rust Engine)");
    println!("   High-Concurrency Byte Inspection & Master Playlist Healing");
    println!("===============================================================\n");

    let total_start = Instant::now();

    // 1. Initialize persistent HTTP client with large connection pool
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .connect_timeout(std::time::Duration::from_secs(3))
        .redirect(reqwest::redirect::Policy::limited(5))
        .pool_max_idle_per_host(50)
        .tcp_keepalive(std::time::Duration::from_secs(15))
        .build()?;

    let client = Arc::new(client);

    // Find playlists output directory
    let playlists_dir = if Path::new("playlists").exists() {
        PathBuf::from("playlists")
    } else if Path::new("../../playlists").exists() {
        PathBuf::from("../../playlists")
    } else {
        PathBuf::from("playlists")
    };
    fs::create_dir_all(&playlists_dir)?;

    // 2. Concurrently fetch all upstream providers
    println!("📥 Fetching upstream master provider feeds concurrently...");
    let fetch_start = Instant::now();
    let mut channel_map: HashMap<String, ChannelItem> = HashMap::with_capacity(16384);
    let mut url_to_key: HashMap<String, String> = HashMap::with_capacity(16384);
    let mut total_raw_count = 0;

    for provider in UPSTREAM_PROVIDERS {
        print!("   -> Fetching {}: ... ", provider.name);
        match client.get(provider.url).timeout(std::time::Duration::from_secs(25)).send().await {
            Ok(res) if res.status().is_success() => {
                if let Ok(text) = res.text().await {
                    let items = parse_m3u(&text, provider.default_group, provider.provider, provider.is_vip);
                    let count = items.len();
                    total_raw_count += count;

                    let mut new_added = 0;
                    for mut item in items {
                        item.is_fast_cdn = provider.is_fast_cdn;
                        let key = if let Some(existing_key) = url_to_key.get(&item.url) {
                            existing_key.clone()
                        } else {
                            let k = normalize_channel_key(&item.name, &item.id);
                            if k.is_empty() {
                                continue;
                            }
                            k
                        };

                        url_to_key.insert(item.url.clone(), key.clone());

                        if let Some(existing) = channel_map.get_mut(&key) {
                            if item.is_vip {
                                if existing.url != item.url && !existing.fallbacks.contains(&existing.url) {
                                    existing.fallbacks.push(existing.url.clone());
                                }
                                existing.url = item.url.clone();
                                existing.is_vip = true;
                                existing.is_fast_cdn = true;
                                existing.provider = item.provider;
                                if !item.logo.is_empty() {
                                    existing.logo = item.logo;
                                }
                            } else if !existing.is_fast_cdn && provider.is_fast_cdn {
                                if existing.url != item.url && !existing.fallbacks.contains(&existing.url) {
                                    existing.fallbacks.push(existing.url.clone());
                                }
                                existing.url = item.url.clone();
                                existing.is_fast_cdn = true;
                                existing.provider = item.provider;
                                if !item.logo.is_empty() {
                                    existing.logo = item.logo;
                                }
                            } else if existing.url != item.url && !existing.fallbacks.contains(&item.url) {
                                existing.fallbacks.push(item.url.clone());
                            }

                            // Preserve all unique candidate fallbacks from secondary feeds
                            for fb in item.fallbacks {
                                if fb != existing.url && !existing.fallbacks.contains(&fb) {
                                    existing.fallbacks.push(fb);
                                }
                            }
                        } else {
                            channel_map.insert(key, item);
                            new_added += 1;
                        }
                    }
                    println!("OK ({} channels, +{} new)", count, new_added);
                } else {
                    println!("FAIL (text decode)");
                }
            }
            Ok(res) => println!("HTTP {}", res.status()),
            Err(e) => println!("ERROR ({})", e),
        }
    }

    println!(
        "\n✅ All feeds fetched in {:.2}s. Raw channels: {}, Deduplicated: {}\n",
        fetch_start.elapsed().as_secs_f64(),
        total_raw_count,
        channel_map.len()
    );

    let blacklist = DmcaBlacklist::load_from_dir(&playlists_dir);
    if !blacklist.blocked_channels.is_empty() || !blacklist.blocked_domains.is_empty() {
        println!(
            "🛡️  DMCA Persistent Exclusion Filter active: {} channels, {} domains blacklisted",
            blacklist.blocked_channels.len(),
            blacklist.blocked_domains.len()
        );
    }

    let raw_candidates: Vec<ChannelItem> = channel_map.into_values().collect();
    let all_candidates: Vec<ChannelItem> = raw_candidates
        .into_iter()
        .filter(|ch| !blacklist.is_blocked(&ch.name, &ch.id, &ch.url))
        .collect();
    let total_candidates = all_candidates.len();

    println!(
        "💎 Total deduplicated channel candidates to audit: {}",
        total_candidates
    );

    // 3. Parallel probing with Tokio Semaphore (utilizing safe rate-limited concurrency)
    let probe_start = Instant::now();
    let num_cpus = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(8);

    let is_ci = std::env::var("CI").is_ok() || std::env::var("GITHUB_ACTIONS").is_ok();
    let workers = if let Ok(val) = std::env::var("SENTINEL_CONCURRENCY").or_else(|_| std::env::var("SENTINEL_WORKERS")) {
        val.parse::<usize>().unwrap_or(if is_ci { 16 } else { 32 })
    } else if is_ci {
        // Safe polite concurrency for GitHub Actions runners: 16 workers prevents CDN 429s and IP blocks
        16
    } else {
        (num_cpus * 4).clamp(16, 64)
    };

    let semaphore = Arc::new(Semaphore::new(workers));
    let progress_completed = Arc::new(AtomicUsize::new(0));
    let dead_counter = Arc::new(AtomicUsize::new(0));
    let healed_counter = Arc::new(AtomicUsize::new(0));

    let environment_label = if is_ci {
        "GitHub Actions CI (Polite Rate-Limited Mode - Max 16 Workers)"
    } else {
        "Local High-Performance"
    };

    println!(
        "\n🔍 Probing 100% of streams & candidate mirrors ({} candidates) using Tokio ({} workers across {} CPU threads) [Mode: {}]...",
        total_candidates, workers, num_cpus, environment_label
    );

    let mut tasks = Vec::with_capacity(total_candidates);

    for ch in all_candidates {
        let sem = Arc::clone(&semaphore);
        let cli = Arc::clone(&client);
        let completed = Arc::clone(&progress_completed);
        let dead = Arc::clone(&dead_counter);
        let healed = Arc::clone(&healed_counter);

        let task = tokio::spawn(async move {
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return None,
            };

            // Compile all candidate URLs for this channel (primary + all fallbacks)
            let mut candidate_urls = Vec::with_capacity(1 + ch.fallbacks.len());
            candidate_urls.push(ch.url.clone());
            for fb in &ch.fallbacks {
                let trimmed = fb.trim().to_string();
                if !trimmed.is_empty() && !candidate_urls.contains(&trimmed) {
                    candidate_urls.push(trimmed);
                }
            }

            // Rigorously probe ALL candidate URLs and retain only verified working ones
            let mut working_streams: Vec<ProbeResult> = Vec::with_capacity(candidate_urls.len());
            for candidate in &candidate_urls {
                let res = probe_single_url(&cli, candidate).await;
                if res.ok && !working_streams.iter().any(|w| w.active_url == res.active_url) {
                    working_streams.push(res);
                }
            }

            let done = completed.fetch_add(1, Ordering::Relaxed) + 1;
            if done.is_multiple_of(100) || done == total_candidates {
                print!(
                    "\r   Probing progress: {}/{} ({:.1}%)",
                    done,
                    total_candidates,
                    (done as f64 / total_candidates as f64) * 100.0
                );
            }

            if working_streams.is_empty() {
                // All streams and candidate mirrors failed: channel is dead and purged
                dead.fetch_add(1, Ordering::Relaxed);
                None
            } else {
                // Sort working streams by response latency ascending (lowest ping first)
                working_streams.sort_by_key(|w| w.latency_ms);

                let mut c = ch;
                let primary_stream = working_streams.remove(0);
                let was_healed = primary_stream.active_url != c.url;
                if was_healed {
                    healed.fetch_add(1, Ordering::Relaxed);
                }

                c.url = primary_stream.active_url;
                // fallbacks contains ONLY 100% verified live backup mirrors, in speed order
                c.fallbacks = working_streams.into_iter().map(|w| w.active_url).collect();

                Some(c)
            }
        });

        tasks.push(task);
    }

    let mut verified_channels = Vec::with_capacity(total_candidates);
    for t in tasks {
        if let Ok(Some(ch)) = t.await {
            verified_channels.push(ch);
        }
    }

    println!();
    let dead_total = dead_counter.load(Ordering::Relaxed);
    let healed_total = healed_counter.load(Ordering::Relaxed);

    println!(
        "\n⚡ Probing complete in {:.2}s. Verified Playable: {} | Healed via Mirrors: {} | Dead Purged: {}\n",
        probe_start.elapsed().as_secs_f64(),
        verified_channels.len(),
        healed_total,
        dead_total
    );

    // Post-probe deduplication: Ensure 100% unique primary stream URLs across all channels
    let mut unique_channels: Vec<ChannelItem> = Vec::with_capacity(verified_channels.len());
    let mut seen_final_urls: HashMap<String, usize> = HashMap::with_capacity(verified_channels.len());

    for ch in verified_channels {
        if let Some(&idx) = seen_final_urls.get(&ch.url) {
            let existing = &mut unique_channels[idx];
            for fb in ch.fallbacks {
                if fb != existing.url && !existing.fallbacks.contains(&fb) {
                    existing.fallbacks.push(fb);
                }
            }
            if existing.logo.is_empty() && !ch.logo.is_empty() {
                existing.logo = ch.logo;
            }
        } else {
            let idx = unique_channels.len();
            seen_final_urls.insert(ch.url.clone(), idx);
            unique_channels.push(ch);
        }
    }

    // 4. Categorization & Priority Sorting
    unique_channels.sort_by(|a, b| {
        let a_vip = a.is_vip || is_vip_channel(&a.name, &a.id);
        let b_vip = b.is_vip || is_vip_channel(&b.name, &b.id);
        b_vip.cmp(&a_vip).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    let mut cat_india = Vec::new();
    let mut cat_news = Vec::new();
    let mut cat_sports = Vec::new();
    let mut cat_movies = Vec::new();
    let mut cat_entertainment = Vec::new();
    let mut cat_kids = Vec::new();
    let mut cat_music = Vec::new();

    let mut final_channels = Vec::with_capacity(unique_channels.len());

    for ch in unique_channels {
        final_channels.push(ch.clone());
        let g = ch.group.to_lowercase();
        let n = ch.name.to_lowercase();
        let p = ch.provider.to_lowercase();
        let id_low = ch.id.to_lowercase();

        let is_india = is_vip_channel(&ch.name, &ch.id)
            || p.contains("india")
            || p.contains("bengali")
            || p.contains("hindi")
            || p.contains("bangladesh")
            || g.contains("india")
            || g.contains("bangla")
            || g.contains("hindi")
            || id_low.contains(".in@")
            || id_low.ends_with(".in")
            || id_low.contains(".bd@")
            || id_low.ends_with(".bd")
            || n.contains("hindi")
            || n.contains("bangla")
            || n.contains("bengali");

        if is_india {
            cat_india.push(ch.clone());
        }

        if g.contains("news") || n.contains("news") {
            cat_news.push(ch.clone());
        } else if g.contains("sport") || n.contains("sport") || n.contains("cricket") || n.contains("football") {
            cat_sports.push(ch.clone());
        } else if g.contains("movie") || g.contains("cinema") || n.contains("cinema") || n.contains("movie") {
            cat_movies.push(ch.clone());
        } else if g.contains("kid") || g.contains("animat") || n.contains("cartoon") || n.contains("disney") {
            cat_kids.push(ch.clone());
        } else if g.contains("music") || n.contains("music") || n.contains("sangeet") {
            cat_music.push(ch.clone());
        } else {
            cat_entertainment.push(ch.clone());
        }
    }

    // Write Master Playlists
    println!("\n💾 Writing Master Playlists to {:?}...", playlists_dir);
    fs::write(playlists_dir.join("morningtv_all.m3u"), format_m3u(&final_channels))?;
    fs::write(playlists_dir.join("morningtv_india.m3u"), format_m3u(&cat_india))?;
    fs::write(playlists_dir.join("morningtv_news.m3u"), format_m3u(&cat_news))?;
    fs::write(playlists_dir.join("morningtv_sports.m3u"), format_m3u(&cat_sports))?;
    fs::write(playlists_dir.join("morningtv_movies.m3u"), format_m3u(&cat_movies))?;
    fs::write(playlists_dir.join("morningtv_entertainment.m3u"), format_m3u(&cat_entertainment))?;
    fs::write(playlists_dir.join("morningtv_kids.m3u"), format_m3u(&cat_kids))?;
    fs::write(playlists_dir.join("morningtv_music.m3u"), format_m3u(&cat_music))?;

    // Provider distribution stats
    let mut provider_counts: HashMap<String, usize> = HashMap::new();
    for ch in &final_channels {
        *provider_counts.entry(ch.provider.clone()).or_insert(0) += 1;
    }

    // Telemetry JSON
    let status_json = serde_json::json!({
        "updated_at": chrono::Utc::now().to_rfc3339(),
        "engine": "MorningTV Rust Tokio Sentinel 3.0",
        "total_raw_scanned": total_raw_count,
        "unique_candidates": total_candidates,
        "verified_playable": final_channels.len(),
        "dead_purged": dead_total,
        "mirrors_healed": healed_total,
        "providers": provider_counts,
        "categories": {
            "all": final_channels.len(),
            "india": cat_india.len(),
            "news": cat_news.len(),
            "sports": cat_sports.len(),
            "movies": cat_movies.len(),
            "entertainment": cat_entertainment.len(),
            "kids": cat_kids.len(),
            "music": cat_music.len()
        }
    });

    fs::write(playlists_dir.join("status.json"), serde_json::to_string_pretty(&status_json)?)?;

    println!("\n🎉 SENTINEL AUDIT COMPLETE in {:.2}s!", total_start.elapsed().as_secs_f64());
    println!("   Total Verified Playable Channels: {}", final_channels.len());
    println!("   Status Manifest: {:?}", playlists_dir.join("status.json"));
    println!("===============================================================\n");

    Ok(())
}
