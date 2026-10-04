// src/storage/logo_cache.rs
// High-performance incremental local disk cache for TV channel logos
// Features: 0-CORS proxying, automatic delta downloading, disk persistence, and elegant SVG monogram fallbacks.

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

static PRECACHE_RUNNING: AtomicBool = AtomicBool::new(false);

/// Resolves the dedicated local directory for storing cached channel logos
pub fn get_logos_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::config_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("MorningTV").join("logos");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Fast 64-bit deterministic hash for URLs
fn hash_str(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &byte in s.as_bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Detects the image MIME type from the magic bytes
pub fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.len() >= 8 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" {
        "image/png"
    } else if bytes.len() >= 3 && &bytes[0..3] == b"\xFF\xD8\xFF" {
        "image/jpeg"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.len() >= 6 && (&bytes[0..6] == b"GIF87a" || &bytes[0..6] == b"GIF89a") {
        "image/gif"
    } else if bytes.len() >= 4 && (bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml")) {
        "image/svg+xml"
    } else {
        "image/png"
    }
}

/// Generates a premium Apple TV-style SVG monogram badge for missing/broken logos
pub fn generate_svg_monogram(name: &str) -> (Vec<u8>, String) {
    let clean = sentinel::clean_channel_name(name);
    let words: Vec<&str> = clean.split_whitespace().collect();

    let initials = if words.is_empty() {
        "TV".to_string()
    } else if words.len() == 1 {
        words[0].chars().take(2).collect::<String>().to_uppercase()
    } else {
        format!(
            "{}{}",
            words[0].chars().next().unwrap_or('T'),
            words[1].chars().next().unwrap_or('V')
        )
        .to_uppercase()
    };

    let display_text = if initials.trim().is_empty() {
        "TV"
    } else {
        &initials
    };

    // Deterministic pleasing gradient based on name hash
    let hash = hash_str(&clean);
    let gradients = [
        ("#6366f1", "#4338ca"), // Indigo
        ("#ec4899", "#be185d"), // Rose
        ("#8b5cf6", "#6d28d9"), // Violet
        ("#3b82f6", "#1d4ed8"), // Royal Blue
        ("#06b6d4", "#0e7490"), // Cyan
        ("#10b981", "#047857"), // Emerald
        ("#f59e0b", "#b45309"), // Amber
        ("#ef4444", "#b91c1c"), // Ruby
    ];
    let (c1, c2) = gradients[(hash as usize) % gradients.len()];

    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 100\" width=\"160\" height=\"100\">\n\
         <defs>\n\
           <linearGradient id=\"g_{:x}\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n\
             <stop offset=\"0%\" stop-color=\"{}\" />\n\
             <stop offset=\"100%\" stop-color=\"{}\" />\n\
           </linearGradient>\n\
         </defs>\n\
         <rect width=\"160\" height=\"100\" rx=\"14\" fill=\"url(#g_{:x})\" fill-opacity=\"0.9\" />\n\
         <rect width=\"158\" height=\"98\" x=\"1\" y=\"1\" rx=\"13\" fill=\"none\" stroke=\"rgba(255,255,255,0.18)\" stroke-width=\"1.5\" />\n\
         <text x=\"50%\" y=\"54%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"#ffffff\" font-family=\"system-ui, sans-serif\" font-weight=\"700\" font-size=\"28\" letter-spacing=\"1.5\">{}</text>\n\
        </svg>",
        hash, c1, c2, hash, display_text
    );

    (svg.into_bytes(), "image/svg+xml".to_string())
}

/// Maps popular TV channels without logos (or broken logos) to verified high-res logos
pub fn find_canonical_logo_url(name: &str) -> Option<&'static str> {
    let lower: String = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();

    if lower.contains("zeebangla") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Zee_Bangla.png")
    } else if lower.contains("starjalsha") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Star_Jalsha.png")
    } else if lower.contains("colorsbangla") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Colors_Bangla.png")
    } else if lower.contains("abpananda") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/ABP_Ananda.png")
    } else if lower.contains("sonyaath") {
        Some("https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_SONY_8/images/LOGO_HD/image.png")
    } else if lower.contains("sonymax") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Sony_Max.png")
    } else if lower.contains("colorshd") || lower == "colors" {
        Some("https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_COLORS/images/LOGO_HD/image.png")
    } else if lower.contains("zeenews") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Zee_News.png")
    } else if lower.contains("zeecinema") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Zee_Cinema.png")
    } else if lower.contains("zeetv") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Zee_TV.png")
    } else if lower.contains("starplus") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Star_Plus.png")
    } else if lower.contains("starsports") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Star_Sports_1.png")
    } else if lower.contains("ddbangla") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/DD_Bangla.png")
    } else if lower.contains("ddsports") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/DD_Sports.png")
    } else if lower.contains("calcuttanews") {
        Some("https://tvpnlogopus.samsungcloud.tv/platform/sub/la/channel/INBA33000100H/logo.png")
    } else if lower.contains("kolkatatv") {
        Some("https://tvpnlogopus.samsungcloud.tv/platform/sub/la/channel/INBA3300009G9/logo.png")
    } else if lower.contains("tv9bangla") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/TV9_Bangla.png")
    } else if lower.contains("news18bangla") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/News18_Bangla.png")
    } else if lower.contains("republicbangla") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Republic_Bangla.png")
    } else if lower.contains("aajtak") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Aaj_Tak.png")
    } else if lower.contains("ndtvindia") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/NDTV_India.png")
    } else if lower.contains("discovery") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Discovery.png")
    } else if lower.contains("cartoonnetwork") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Cartoon_Network.png")
    } else if lower.contains("pogo") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Pogo.png")
    } else if lower.contains("nickelodeon") || lower == "nick" {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Nick.png")
    } else if lower.contains("sonic") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Sonic_Nickelodeon.png")
    } else if lower.contains("mtv") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/MTV_Beats.png")
    } else if lower.contains("9xm") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/9XM.png")
    } else if lower.contains("b4umusic") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/B4U_Music.png")
    } else if lower.contains("b4umovies") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/B4U_Movies.png")
    } else if lower.contains("goldmines") {
        Some("https://jiotvimages.cdn.jio.com/dare_images/images/Goldmines.png")
    } else if lower.contains("tsports") {
        Some("https://tvpnlogopus.samsungcloud.tv/platform/sub/la/channel/INBA3300015O7/logo.png")
    } else if lower.contains("gazitv") || lower == "gtv" {
        Some("https://tvpnlogopus.samsungcloud.tv/platform/sub/la/channel/INBA3300016N9/logo.png")
    } else {
        None
    }
}

/// Fetches a logo from the local disk cache or downloads and caches it incrementally
pub async fn get_or_fetch_logo(url: &str, name: &str) -> (Vec<u8>, String) {
    let mut target_url = url.trim();

    // If channel has no logo, check canonical repository first
    if target_url.is_empty() || (!target_url.starts_with("http://") && !target_url.starts_with("https://")) {
        if let Some(canonical) = find_canonical_logo_url(name) {
            target_url = canonical;
        } else {
            return generate_svg_monogram(name);
        }
    }

    let logos_dir = get_logos_dir();
    let file_hash = hash_str(target_url);
    let cache_file = logos_dir.join(format!("{:016x}.cache", file_hash));

    // ── STEP 1: Check Local Disk Cache (0ms local SSD read) ──
    if let Ok(metadata) = fs::metadata(&cache_file) {
        if metadata.len() > 100 {
            if let Ok(bytes) = fs::read(&cache_file) {
                let mime = detect_image_mime(&bytes).to_string();
                return (bytes, mime);
            }
        }
    }

    // ── STEP 2: Cache Miss - Download incrementally from Remote ──
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .connect_timeout(Duration::from_secs(3))
        .build()
    {
        Ok(c) => c,
        Err(_) => return generate_svg_monogram(name),
    };

    let fetch_res = client
        .get(target_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
        .send()
        .await;

    let bytes = match fetch_res {
        Ok(r) if r.status().is_success() => {
            match r.bytes().await {
                Ok(b) if b.len() > 80 && b.len() < 5 * 1024 * 1024 => Some(b.to_vec()),
                _ => None,
            }
        }
        _ => None,
    };

    if let Some(b) = bytes {
        let mime = detect_image_mime(&b);
        if mime != "image/png" || b.starts_with(b"\x89PNG") || b.starts_with(b"RIFF") || b.starts_with(b"\xFF\xD8\xFF") || b.starts_with(b"<svg") {
            // Atomically persist to disk cache
            let temp_file = logos_dir.join(format!("{:016x}.tmp", file_hash));
            if fs::write(&temp_file, &b).is_ok() {
                let _ = fs::rename(&temp_file, &cache_file);
            }
            return (b, mime.to_string());
        }
    }

    // ── STEP 3: Fallback - If target URL failed, try canonical logo for known channel ──
    if let Some(canonical) = find_canonical_logo_url(name) {
        if canonical != target_url {
            let canon_hash = hash_str(canonical);
            let canon_cache_file = logos_dir.join(format!("{:016x}.cache", canon_hash));

            if let Ok(metadata) = fs::metadata(&canon_cache_file) {
                if metadata.len() > 100 {
                    if let Ok(b) = fs::read(&canon_cache_file) {
                        let mime = detect_image_mime(&b).to_string();
                        return (b, mime);
                    }
                }
            }

            if let Ok(r) = client.get(canonical).send().await {
                if r.status().is_success() {
                    if let Ok(b) = r.bytes().await {
                        if b.len() > 80 {
                            let b_vec = b.to_vec();
                            let _ = fs::write(&canon_cache_file, &b_vec);
                            return (b_vec, "image/png".to_string());
                        }
                    }
                }
            }
        }
    }

    generate_svg_monogram(name)
}

/// Background worker that quietly pre-caches logos for provided channels during idle time
pub fn spawn_precache_worker(channels: Vec<(String, String)>) {
    if PRECACHE_RUNNING.swap(true, Ordering::SeqCst) {
        return; // Already running
    }

    tokio::spawn(async move {
        let logos_dir = get_logos_dir();
        for (url, name) in channels {
            let trimmed = url.trim();
            if trimmed.is_empty() || (!trimmed.starts_with("http://") && !trimmed.starts_with("https://")) {
                continue;
            }

            let file_hash = hash_str(trimmed);
            let cache_file = logos_dir.join(format!("{:016x}.cache", file_hash));

            // Skip if already downloaded
            if cache_file.exists() {
                continue;
            }

            // Gently fetch
            let _ = get_or_fetch_logo(trimmed, &name).await;

            // Polite pause between requests to prevent network/CPU congestion
            tokio::time::sleep(Duration::from_millis(60)).await;
        }

        PRECACHE_RUNNING.store(false, Ordering::SeqCst);
    });
}
