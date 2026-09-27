// src-tauri/src/network/proxy.rs
// Ultra-High-Performance Async HTTP Streaming Proxy built on Axum & Tokio
// Includes In-Memory RAM Segment Caching, Predictive Channel Pre-Warming,
// CORS bypass, 301/302 redirect tracking, and zero-copy byte streaming.

use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use url::Url;

#[derive(Clone)]
struct CachedItem {
    data: Bytes,
    content_type: String,
    created_at: Instant,
    is_manifest: bool,
}

#[derive(Clone)]
struct ProxyState {
    client: Arc<reqwest::Client>,
    cache: Arc<RwLock<HashMap<String, CachedItem>>>,
}

impl ProxyState {
    async fn get_cached(&self, url: &str) -> Option<CachedItem> {
        let cache = self.cache.read().await;
        if let Some(item) = cache.get(url) {
            let max_age_secs = if item.is_manifest { 4 } else { 30 };
            if item.created_at.elapsed().as_secs() < max_age_secs {
                return Some(item.clone());
            }
        }
        None
    }

    async fn set_cached(&self, url: String, data: Bytes, content_type: String, is_manifest: bool) {
        let mut cache = self.cache.write().await;
        // Evict expired entries if cache is growing
        if cache.len() > 35 {
            cache.retain(|_, v| {
                let max_age = if v.is_manifest { 4 } else { 30 };
                v.created_at.elapsed().as_secs() < max_age
            });
        }
        cache.insert(
            url,
            CachedItem {
                data,
                content_type,
                created_at: Instant::now(),
                is_manifest,
            },
        );
    }
}

pub struct StreamProxy;

impl StreamProxy {
    pub const PORT: u16 = 18181;

    pub fn start() {
        tauri::async_runtime::spawn(async move {
            let addr = SocketAddr::from(([127, 0, 0, 1], Self::PORT));

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .connect_timeout(std::time::Duration::from_secs(30))
                .danger_accept_invalid_certs(true)
                .redirect(reqwest::redirect::Policy::limited(10))
                .pool_max_idle_per_host(40)
                .pool_idle_timeout(std::time::Duration::from_secs(60))
                .tcp_keepalive(std::time::Duration::from_secs(30))
                .tcp_nodelay(true)
                .build()
                .unwrap_or_default();

            let state = ProxyState {
                client: Arc::new(client),
                cache: Arc::new(RwLock::new(HashMap::new())),
            };

            let app = Router::new()
                .route("/stream", get(handle_stream))
                .route("/prewarm", get(handle_prewarm))
                .route("/return_to_novatv", get(handle_return))
                .layer(CorsLayer::permissive())
                .with_state(state);

            match tokio::net::TcpListener::bind(addr).await {
                Ok(listener) => {
                    log::info!("Axum streaming proxy listening on http://{}", addr);
                    let _ = axum::serve(listener, app).await;
                }
                Err(e) => {
                    log::error!("Failed to bind Axum stream proxy on {}: {}", addr, e);
                }
            }
        });
    }
}

async fn handle_return() -> Response {
    (StatusCode::OK, "Returning to MorningTV").into_response()
}

/// Predictive RAM pre-warming endpoint:
/// Called in the background when the user hovers or switches to a channel
async fn handle_prewarm(
    State(state): State<ProxyState>,
    uri: Uri,
) -> Response {
    let query_str = uri.query().unwrap_or("");
    let target_url = match query_str.find("url=") {
        Some(idx) => {
            let raw = &query_str[idx + 4..];
            let decoded = urlencoding_decode(raw);
            if decoded.is_empty() {
                return (StatusCode::BAD_REQUEST, "Missing URL parameter").into_response();
            }
            decoded
        }
        None => return (StatusCode::BAD_REQUEST, "Missing URL parameter").into_response(),
    };

    // Spawn non-blocking background task to prewarm manifest and first segment into RAM
    let state_clone = state.clone();
    tokio::spawn(async move {
        prewarm_stream_into_ram(state_clone, target_url).await;
    });

    (StatusCode::OK, "Prewarm queued").into_response()
}

async fn prewarm_stream_into_ram(state: ProxyState, url: String) {
    if state.get_cached(&url).await.is_some() {
        return;
    }

    let client = &state.client;
    let res = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .send()
        .await;

    let res = match res {
        Ok(r) if r.status().is_success() => r,
        _ => return,
    };

    let effective_url = res.url().as_str().to_string();
    let text = match res.text().await {
        Ok(t) => t,
        _ => return,
    };

    let rewritten = rewrite_m3u8(&text, &effective_url);
    let bytes = Bytes::from(rewritten);
    state
        .set_cached(
            url.clone(),
            bytes,
            "application/vnd.apple.mpegurl".to_string(),
            true,
        )
        .await;

    // Parse text to find child playlist or first video segment
    let base_url = Url::parse(&effective_url).ok();
    let mut segment_to_fetch = None;

    for line in text.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let resolved = if let Some(ref b) = base_url {
            b.join(trimmed).map(|u| u.to_string()).unwrap_or_else(|_| trimmed.to_string())
        } else {
            trimmed.to_string()
        };
        segment_to_fetch = Some(resolved);
        break;
    }

    if let Some(seg_url) = segment_to_fetch {
        // If it's a child .m3u8 playlist, pre-fetch it
        if seg_url.contains(".m3u8") {
            if let Ok(child_res) = client.get(&seg_url).timeout(std::time::Duration::from_secs(4)).send().await {
                if let Ok(child_text) = child_res.text().await {
                    let child_rewritten = rewrite_m3u8(&child_text, &seg_url);
                    state
                        .set_cached(
                            seg_url.clone(),
                            Bytes::from(child_rewritten.clone()),
                            "application/vnd.apple.mpegurl".to_string(),
                            true,
                        )
                        .await;

                    // Now find the latest segment in child playlist
                    let child_base = Url::parse(&seg_url).ok();
                    for cline in child_text.lines().rev() {
                        let ctrim = cline.trim();
                        if ctrim.is_empty() || ctrim.starts_with('#') {
                            continue;
                        }
                        let resolved_ts = if let Some(ref cb) = child_base {
                            cb.join(ctrim).map(|u| u.to_string()).unwrap_or_else(|_| ctrim.to_string())
                        } else {
                            ctrim.to_string()
                        };
                        // Pre-fetch this single video TS/m4s segment into RAM!
                        if let Ok(seg_res) = client.get(&resolved_ts).timeout(std::time::Duration::from_secs(5)).send().await {
                            if let Ok(seg_bytes) = seg_res.bytes().await {
                                state.set_cached(resolved_ts, seg_bytes, "video/mp2t".to_string(), false).await;
                                log::info!("Pre-warmed live video segment in RAM for: {}", url);
                            }
                        }
                        break;
                    }
                }
            }
        } else {
            // It was a direct TS segment
            if let Ok(seg_res) = client.get(&seg_url).timeout(std::time::Duration::from_secs(5)).send().await {
                if let Ok(seg_bytes) = seg_res.bytes().await {
                    state.set_cached(seg_url, seg_bytes, "video/mp2t".to_string(), false).await;
                    log::info!("Pre-warmed direct live segment in RAM for: {}", url);
                }
            }
        }
    }
}

async fn handle_stream(
    State(state): State<ProxyState>,
    incoming_headers: HeaderMap,
    uri: Uri,
) -> Response {
    let query_str = uri.query().unwrap_or("");
    let target_url = match query_str.find("url=") {
        Some(idx) => {
            let raw = &query_str[idx + 4..];
            let decoded = urlencoding_decode(raw);
            if decoded.is_empty() {
                return (StatusCode::BAD_REQUEST, "Missing URL parameter").into_response();
            }
            decoded
        }
        None => return (StatusCode::NOT_FOUND, "Not Found").into_response(),
    };

    // 1. FAST PATH: In-Memory RAM Cache (Instant sub-millisecond return!)
    if let Some(cached) = state.get_cached(&target_url).await {
        let mut headers = HeaderMap::new();
        if let Ok(val) = HeaderValue::from_str(&cached.content_type) {
            headers.insert(axum::http::header::CONTENT_TYPE, val);
        }
        headers.insert(
            axum::http::header::CONTENT_LENGTH,
            HeaderValue::from(cached.data.len()),
        );
        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_static("*"),
        );
        headers.insert(
            axum::http::header::CACHE_CONTROL,
            HeaderValue::from_static(if cached.is_manifest {
                "no-cache, no-store, must-revalidate"
            } else {
                "public, max-age=3600"
            }),
        );
        headers.insert(
            axum::http::header::ACCEPT_RANGES,
            HeaderValue::from_static("bytes"),
        );
        return (StatusCode::OK, headers, Body::from(cached.data)).into_response();
    }

    let lower = target_url.to_lowercase();
    let mut req_builder = state.client
        .get(&target_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept", "*/*")
        .header("Accept-Language", "en-US,en;q=0.9");

    // Forward Range header for byte-range streams (fMP4 / HLS byte-ranges) and seeking
    if let Some(range) = incoming_headers.get(axum::http::header::RANGE) {
        if let Ok(val) = range.to_str() {
            req_builder = req_builder.header(reqwest::header::RANGE, val);
        }
    }

    if lower.contains("pluto.tv") {
        req_builder = req_builder
            .header("Referer", "https://pluto.tv/")
            .header("Origin", "https://pluto.tv");
    } else if lower.contains("samsung") || lower.contains("amagi.tv") {
        req_builder = req_builder
            .header("Referer", "https://www.samsungtvplus.com/")
            .header("Origin", "https://www.samsungtvplus.com");
    }

    // Resilient retry loop (up to 3 attempts with exponential backoff) for unstable networks
    let mut upstream_res = None;
    let mut last_err = None;

    for attempt in 0..3 {
        let req = match req_builder.try_clone() {
            Some(r) => r,
            None => {
                break;
            }
        };

        match req.send().await {
            Ok(res) => {
                upstream_res = Some(res);
                break;
            }
            Err(e) => {
                log::warn!(
                    "Stream proxy attempt {} failed for {}: {}",
                    attempt + 1,
                    target_url,
                    e
                );
                last_err = Some(e);
                if attempt < 2 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(150 * (attempt as u64 + 1))).await;
                }
            }
        }
    }

    // Fallback if clone failed or retries exhausted
    let upstream_res = match upstream_res {
        Some(res) => res,
        None => {
            // One final direct attempt if try_clone was unavailable
            match req_builder.send().await {
                Ok(res) => res,
                Err(e) => {
                    log::warn!(
                        "Stream proxy fetch exhausted retries for {}: {:?} (last: {:?})",
                        target_url,
                        e,
                        last_err
                    );
                    return (StatusCode::BAD_GATEWAY, "Upstream fetch error").into_response();
                }
            }
        }
    };

    // Capture effective URL after 301/302 redirects (CRUCIAL for Samsung jmp2.uk -> amagi.tv)
    let effective_url = upstream_res.url().as_str().to_string();
    let upstream_status = upstream_res.status();

    let content_type = upstream_res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let is_m3u8 = target_url.contains(".m3u8")
        || effective_url.contains(".m3u8")
        || content_type.contains("mpegurl");

    if is_m3u8 {
        match upstream_res.text().await {
            Ok(manifest) => {
                let rewritten = rewrite_m3u8(&manifest, &effective_url);
                let bytes = Bytes::from(rewritten);
                state
                    .set_cached(
                        target_url.clone(),
                        bytes.clone(),
                        "application/vnd.apple.mpegurl".to_string(),
                        true,
                    )
                    .await;

                let mut headers = HeaderMap::new();
                headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/vnd.apple.mpegurl"),
                );
                headers.insert(
                    axum::http::header::CACHE_CONTROL,
                    HeaderValue::from_static("no-cache, no-store, must-revalidate"),
                );
                headers.insert(
                    axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
                    HeaderValue::from_static("*"),
                );
                (headers, Body::from(bytes)).into_response()
            }
            Err(_) => (StatusCode::BAD_GATEWAY, "Failed to read manifest text").into_response(),
        }
    } else {
        // High-performance zero-copy async stream piping for TS / AAC / MP4 segments
        let status = StatusCode::from_u16(upstream_status.as_u16()).unwrap_or(StatusCode::OK);
        let mut headers = HeaderMap::new();

        let ctype = if content_type.is_empty() {
            "video/mp2t".to_string()
        } else {
            content_type
        };
        if let Ok(val) = HeaderValue::from_str(&ctype) {
            headers.insert(axum::http::header::CONTENT_TYPE, val);
        }

        // Forward Content-Range for byte-range responses (206 Partial Content)
        if let Some(content_range) = upstream_res.headers().get(reqwest::header::CONTENT_RANGE) {
            headers.insert(axum::http::header::CONTENT_RANGE, content_range.clone());
        }

        // Enable byte-range seeking
        headers.insert(
            axum::http::header::ACCEPT_RANGES,
            HeaderValue::from_static("bytes"),
        );

        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_static("*"),
        );

        let is_range_req = incoming_headers.contains_key(axum::http::header::RANGE);
        let content_length = upstream_res.content_length();

        // If Range header was NOT requested and segment size is reasonable (< 6MB),
        // read full bytes and save to RAM cache for instant replay/reconnects!
        if !is_range_req && content_length.map_or(true, |l| l < 6 * 1024 * 1024) {
            match upstream_res.bytes().await {
                Ok(bytes) => {
                    headers.insert(
                        axum::http::header::CONTENT_LENGTH,
                        HeaderValue::from(bytes.len()),
                    );
                    headers.insert(
                        axum::http::header::CACHE_CONTROL,
                        HeaderValue::from_static("public, max-age=3600"),
                    );
                    state
                        .set_cached(target_url.clone(), bytes.clone(), ctype, false)
                        .await;
                    (status, headers, Body::from(bytes)).into_response()
                }
                Err(_) => (StatusCode::BAD_GATEWAY, "Failed reading upstream segment").into_response(),
            }
        } else {
            if let Some(len) = content_length {
                headers.insert(axum::http::header::CONTENT_LENGTH, HeaderValue::from(len));
            }
            let stream = upstream_res.bytes_stream();
            let body = Body::from_stream(stream);
            (status, headers, body).into_response()
        }
    }
}

fn rewrite_m3u8(manifest: &str, base_url_str: &str) -> String {
    let base_url = Url::parse(base_url_str).ok();
    let mut output = String::with_capacity(manifest.len() + 1024);

    for line in manifest.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            output.push('\n');
            continue;
        }

        if trimmed.starts_with('#') {
            // Rewrite URI="..." inside tags such as #EXT-X-MEDIA, #EXT-X-KEY, #EXT-X-MAP
            if let Some(start) = trimmed.find("URI=\"") {
                let prefix_len = start + 5;
                let after_prefix = &trimmed[prefix_len..];
                if let Some(end) = after_prefix.find('"') {
                    let raw_uri = &after_prefix[..end];
                    if !raw_uri.starts_with("http://127.0.0.1:") {
                        let resolved_uri = if let Some(ref base) = base_url {
                            base.join(raw_uri).map(|u| u.to_string()).unwrap_or_else(|_| raw_uri.to_string())
                        } else {
                            raw_uri.to_string()
                        };
                        let proxied = format!(
                            "http://127.0.0.1:{}/stream?url={}",
                            StreamProxy::PORT,
                            urlencoding_encode(&resolved_uri)
                        );
                        let mut new_line = String::with_capacity(trimmed.len() + 120);
                        new_line.push_str(&trimmed[..prefix_len]);
                        new_line.push_str(&proxied);
                        new_line.push_str(&after_prefix[end..]);
                        output.push_str(&new_line);
                        output.push('\n');
                        continue;
                    }
                }
            }

            output.push_str(trimmed);
            output.push('\n');
            continue;
        }

        // Avoid re-proxying if already pointing to local proxy
        if trimmed.starts_with("http://127.0.0.1:") {
            output.push_str(trimmed);
            output.push('\n');
            continue;
        }

        // This is a chunk or child playlist URL
        let resolved = if let Some(ref base) = base_url {
            base.join(trimmed).map(|u| u.to_string()).unwrap_or_else(|_| trimmed.to_string())
        } else {
            trimmed.to_string()
        };

        // Route through local proxy
        output.push_str(&format!(
            "http://127.0.0.1:{}/stream?url={}\n",
            StreamProxy::PORT,
            urlencoding_encode(&resolved)
        ));
    }

    output
}

// Preserves '+' characters so Base64 and JWT signatures (Pluto TV, signed CDNs) are NOT corrupted
fn urlencoding_decode(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let h1 = chars.next().unwrap_or(b'0') as char;
            let h2 = chars.next().unwrap_or(b'0') as char;
            if let Ok(val) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                bytes.push(val);
            }
        } else {
            // Keep '+' as '+' (do not convert to space!)
            bytes.push(b);
        }
    }
    String::from_utf8(bytes).unwrap_or_else(|_| s.to_string())
}

fn urlencoding_encode(s: &str) -> String {
    let mut res = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~' {
            res.push(b as char);
        } else {
            res.push_str(&format!("%{:02X}", b));
        }
    }
    res
}
