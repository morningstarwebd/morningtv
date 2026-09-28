// src-tauri/src/network/proxy.rs
// Ultra-High-Performance Async HTTP Streaming Proxy built on Axum & Tokio
// Includes In-Memory RAM Segment Caching, Predictive Channel Pre-Warming,
// CORS bypass, 301/302 redirect tracking, SSRF filtering, and zero-copy byte streaming.

use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::collections::{HashMap, VecDeque};
use std::net::{SocketAddr, ToSocketAddrs};
use std::sync::{Arc, OnceLock};
use std::time::Instant;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use url::Url;

#[derive(Clone)]
pub struct CachedItem {
    pub data: Bytes,
    pub content_type: String,
    pub created_at: Instant,
    pub is_manifest: bool,
}

#[derive(Clone)]
pub struct SegmentLruCache {
    entries: HashMap<String, CachedItem>,
    order: VecDeque<String>,
    capacity: usize,
}

impl SegmentLruCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: HashMap::with_capacity(capacity),
            order: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn get(&mut self, url: &str) -> Option<CachedItem> {
        if let Some(item) = self.entries.get(url) {
            let max_age_secs = if item.is_manifest { 4 } else { 30 };
            if item.created_at.elapsed().as_secs() < max_age_secs {
                return Some(item.clone());
            }
        }
        None
    }

    pub fn insert(&mut self, url: String, data: Bytes, content_type: String, is_manifest: bool) {
        // Evict expired entries if cache is nearing capacity
        if self.entries.len() >= self.capacity {
            self.entries.retain(|_, v| {
                let max_age = if v.is_manifest { 4 } else { 30 };
                v.created_at.elapsed().as_secs() < max_age
            });
            self.order.retain(|k| self.entries.contains_key(k));
        }

        // Evict oldest until under capacity
        while self.entries.len() >= self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            } else {
                break;
            }
        }

        if !self.entries.contains_key(&url) {
            self.order.push_back(url.clone());
        }
        self.entries.insert(
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

#[derive(Clone)]
pub struct ProxyState {
    client: Arc<reqwest::Client>,
    cache: Arc<RwLock<SegmentLruCache>>,
}

impl ProxyState {
    async fn get_cached(&self, url: &str) -> Option<CachedItem> {
        let mut cache = self.cache.write().await;
        cache.get(url)
    }

    async fn set_cached(&self, url: String, data: Bytes, content_type: String, is_manifest: bool) {
        let mut cache = self.cache.write().await;
        cache.insert(url, data, content_type, is_manifest);
    }
}

static PROXY_AUTH_TOKEN: OnceLock<String> = OnceLock::new();
static PROXY_PORT: OnceLock<u16> = OnceLock::new();

pub struct StreamProxy;

impl StreamProxy {
    pub const DEFAULT_PORT: u16 = 18181;
    pub const PORT: u16 = 18181; // backwards compatibility
    pub const MAX_CACHE_SEGMENTS: usize = 50;

    /// Returns the currently bound port, or DEFAULT_PORT if not yet bound
    pub fn get_port() -> u16 {
        *PROXY_PORT.get().unwrap_or(&Self::DEFAULT_PORT)
    }

    /// Returns the active ephemeral session auth token.
    /// Generated randomly on first call using UUID v4.
    pub fn get_auth_token() -> &'static str {
        PROXY_AUTH_TOKEN.get_or_init(|| {
            uuid::Uuid::new_v4().simple().to_string()
        })
    }

    pub fn start() {
        tauri::async_runtime::spawn(async move {
            let _ = Self::get_auth_token(); // ensure initialized

            let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 10 {
                    return attempt.stop();
                }
                let next_url = attempt.url();
                let next_url_str = next_url.as_str();

                if let Err(err) = validate_target_url(next_url_str) {
                    log::warn!("SSRF blocked in redirect: {} ({})", next_url_str, err);
                    return attempt.stop();
                }

                if let Some(host) = next_url.host_str() {
                    let port = next_url.port_or_known_default().unwrap_or(80);
                    if let Ok(addrs) = (host, port).to_socket_addrs() {
                        for addr in addrs {
                            if is_private_or_loopback_ip(&addr.ip()) {
                                log::warn!(
                                    "SSRF blocked in redirect: host {} resolved to private IP {}",
                                    host,
                                    addr.ip()
                                );
                                return attempt.stop();
                            }
                        }
                    }
                }

                attempt.follow()
            });

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .connect_timeout(std::time::Duration::from_secs(30))
                .redirect(redirect_policy)
                .pool_max_idle_per_host(40)
                .pool_idle_timeout(std::time::Duration::from_secs(60))
                .tcp_keepalive(std::time::Duration::from_secs(30))
                .tcp_nodelay(true)
                .build()
                .unwrap_or_default();

            let state = ProxyState {
                client: Arc::new(client),
                cache: Arc::new(RwLock::new(SegmentLruCache::new(Self::MAX_CACHE_SEGMENTS))),
            };

            let app = Router::new()
                .route("/stream", get(handle_stream))
                .route("/prewarm", get(handle_prewarm))
                .route("/return_to_morningtv", get(handle_return))
                .route("/return_to_novatv", get(handle_return))
                .layer(CorsLayer::permissive())
                .with_state(state);

            // Attempt to bind to candidate ports with dynamic fallback to OS ephemeral port (0)
            let candidate_ports = [18181, 18182, 18183, 18184, 18185, 0];
            let mut bound_listener = None;

            for port in candidate_ports {
                let addr = SocketAddr::from(([127, 0, 0, 1], port));
                match tokio::net::TcpListener::bind(addr).await {
                    Ok(listener) => {
                        let actual_port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
                        let _ = PROXY_PORT.set(actual_port);
                        log::info!(
                            "Axum streaming proxy listening on http://127.0.0.1:{} (Secured with Ephemeral Token + Anti-SSRF)",
                            actual_port
                        );
                        bound_listener = Some(listener);
                        break;
                    }
                    Err(e) => {
                        log::warn!("Port {} unavailable for Axum proxy: {}", port, e);
                    }
                }
            }

            if let Some(listener) = bound_listener {
                let _ = axum::serve(listener, app).await;
            } else {
                log::error!("CRITICAL: Failed to bind Axum stream proxy on any candidate port");
            }
        });
    }
}

async fn handle_return() -> Response {
    (StatusCode::OK, "Returning to MorningTV").into_response()
}

/// Validates whether the incoming request contains the valid ephemeral proxy token
pub fn verify_auth(uri: &Uri, headers: &HeaderMap) -> bool {
    let expected = StreamProxy::get_auth_token();

    // Check header: X-Proxy-Token
    if let Some(h_val) = headers.get("x-proxy-token") {
        if let Ok(s) = h_val.to_str() {
            if s.trim() == expected {
                return true;
            }
        }
    }

    // Check query parameter: &token=...
    if let Some(query) = uri.query() {
        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                if k == "token" && v == expected {
                    return true;
                }
            }
        }
    }

    false
}

/// Robust query parameter extractor that safely preserves target URLs containing '&' and nested stream tokens
pub fn extract_target_url(query_str: &str) -> Option<String> {
    if query_str.is_empty() {
        return None;
    }
    if let Some(idx) = query_str.find("url=") {
        let after = &query_str[idx + 4..];
        // Check if query_str has token= after url= (trailing proxy auth token)
        let has_trailing_token = query_str.find("token=").map_or(false, |tok_idx| tok_idx > idx);
        let raw_url = if has_trailing_token {
            if let Some(token_pos) = after.rfind("&token=") {
                &after[..token_pos]
            } else {
                after
            }
        } else {
            after
        };
        let decoded = urlencoding_decode(raw_url);
        if !decoded.is_empty() {
            return Some(decoded);
        }
    }
    None
}

/// Checks whether an IP address belongs to loopback, private, link-local, multicast or broadcast ranges
pub fn is_private_or_loopback_ip(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => {
            v4.is_loopback()            // 127.0.0.0/8
                || v4.is_private()      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                || v4.is_link_local()   // 169.254.0.0/16 (Cloud metadata)
                || v4.is_broadcast()    // 255.255.255.255
                || v4.is_multicast()    // 224.0.0.0/4
                || v4.octets()[0] == 0  // 0.0.0.0/8
        }
        std::net::IpAddr::V6(v6) => {
            v6.is_loopback()            // ::1
                || v6.is_multicast()    // ff00::/8
                || v6.is_unspecified()  // ::
                || ((v6.segments()[0] & 0xfe00) == 0xfc00) // fc00::/7 (unique local)
                || ((v6.segments()[0] & 0xffc0) == 0xfe80) // fe80::/10 (link-local)
        }
    }
}

/// Anti-SSRF literal filter: Rejects localhost, loopback, link-local, and RFC1918 private IP ranges
pub fn is_private_or_loopback_host(host: &str) -> bool {
    let lower = host.trim().to_lowercase();
    if lower.is_empty()
        || lower == "localhost"
        || lower.ends_with(".localhost")
        || lower.ends_with(".local")
        || lower.ends_with(".internal")
        || lower.ends_with(".lan")
    {
        return true;
    }

    if let Ok(ip) = lower.parse::<std::net::IpAddr>() {
        return is_private_or_loopback_ip(&ip);
    }

    false
}

/// Synchronous validation for structural correctness
pub fn validate_target_url(target_url: &str) -> Result<Url, &'static str> {
    let parsed = Url::parse(target_url).map_err(|_| "Invalid URL format")?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err("Only http and https schemes are permitted");
    }
    let host = parsed.host_str().ok_or("Target URL has no host")?;
    if is_private_or_loopback_host(host) {
        return Err("Target host resolves to a private, loopback, or metadata address (SSRF blocked)");
    }
    Ok(parsed)
}

/// Asynchronous validation that actively performs DNS lookup to prevent DNS-rebinding SSRF
pub async fn validate_target_url_async(target_url: &str) -> Result<Url, &'static str> {
    let parsed = validate_target_url(target_url)?;
    let host = parsed.host_str().ok_or("Target URL has no host")?;

    // Perform DNS lookup to detect hostnames resolving to private/loopback/cloud metadata IPs
    let port = parsed.port_or_known_default().unwrap_or(80);
    let host_port = format!("{}:{}", host, port);
    if let Ok(mut addrs) = tokio::net::lookup_host(&host_port).await {
        if let Some(first) = addrs.next() {
            if is_private_or_loopback_ip(&first.ip()) {
                return Err("Target host resolves to a private, loopback, or metadata address (SSRF blocked)");
            }
        }
    }

    Ok(parsed)
}

/// Predictive RAM pre-warming endpoint:
async fn handle_prewarm(
    State(state): State<ProxyState>,
    headers: HeaderMap,
    uri: Uri,
) -> Response {
    if !verify_auth(&uri, &headers) {
        return (StatusCode::FORBIDDEN, "Forbidden: Invalid or missing proxy token").into_response();
    }

    let query_str = uri.query().unwrap_or("");
    let target_url = match extract_target_url(query_str) {
        Some(url) => url,
        None => return (StatusCode::BAD_REQUEST, "Missing URL parameter").into_response(),
    };

    if let Err(err) = validate_target_url_async(&target_url).await {
        return (StatusCode::BAD_REQUEST, err).into_response();
    }

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

    let token = StreamProxy::get_auth_token();
    let rewritten = rewrite_m3u8(&text, &effective_url, token);
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
        if let Err(_) = validate_target_url(&seg_url) {
            return;
        }

        if seg_url.contains(".m3u8") {
            if let Ok(child_res) = client.get(&seg_url).timeout(std::time::Duration::from_secs(4)).send().await {
                if let Ok(child_text) = child_res.text().await {
                    let child_rewritten = rewrite_m3u8(&child_text, &seg_url, token);
                    state
                        .set_cached(
                            seg_url.clone(),
                            Bytes::from(child_rewritten.clone()),
                            "application/vnd.apple.mpegurl".to_string(),
                            true,
                        )
                        .await;

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
                        if let Ok(_) = validate_target_url(&resolved_ts) {
                            if let Ok(seg_res) = client.get(&resolved_ts).timeout(std::time::Duration::from_secs(5)).send().await {
                                if let Ok(seg_bytes) = seg_res.bytes().await {
                                    state.set_cached(resolved_ts, seg_bytes, "video/mp2t".to_string(), false).await;
                                    log::info!("Pre-warmed live video segment in RAM for: {}", url);
                                }
                            }
                        }
                        break;
                    }
                }
            }
        } else {
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
    // 0. AUTHENTICATION & ACCESS CONTROL
    if !verify_auth(&uri, &incoming_headers) {
        return (
            StatusCode::FORBIDDEN,
            "Forbidden: Invalid or missing proxy token",
        )
            .into_response();
    }

    let query_str = uri.query().unwrap_or("");
    let target_url = match extract_target_url(query_str) {
        Some(url) => url,
        None => return (StatusCode::BAD_REQUEST, "Missing URL parameter").into_response(),
    };

    // 1. ANTI-SSRF TARGET URL VALIDATION (ASYNC WITH DNS REBINDING DEFENSE)
    if let Err(err_msg) = validate_target_url_async(&target_url).await {
        log::warn!("SSRF or invalid URL blocked by stream proxy: {} ({})", target_url, err_msg);
        return (StatusCode::BAD_REQUEST, err_msg).into_response();
    }

    // 2. FAST PATH: In-Memory RAM Cache (Instant sub-millisecond return!)
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

    let mut upstream_res = None;
    let mut last_err = None;

    for attempt in 0..3 {
        let req = match req_builder.try_clone() {
            Some(r) => r,
            None => break,
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

    let upstream_res = match upstream_res {
        Some(res) => res,
        None => {
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

    let token = StreamProxy::get_auth_token();

    if is_m3u8 {
        match upstream_res.text().await {
            Ok(manifest) => {
                let rewritten = rewrite_m3u8(&manifest, &effective_url, token);
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

        if let Some(content_range) = upstream_res.headers().get(reqwest::header::CONTENT_RANGE) {
            headers.insert(axum::http::header::CONTENT_RANGE, content_range.clone());
        }

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

pub fn rewrite_m3u8(manifest: &str, base_url_str: &str, token: &str) -> String {
    let port = StreamProxy::get_port();
    let base_url = Url::parse(base_url_str).ok();
    let mut output = String::with_capacity(manifest.len() + 1024);

    for line in manifest.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            output.push('\n');
            continue;
        }

        if trimmed.starts_with('#') {
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
                            "http://127.0.0.1:{}/stream?url={}&token={}",
                            port,
                            urlencoding_encode(&resolved_uri),
                            token
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

        if trimmed.starts_with("http://127.0.0.1:") {
            output.push_str(trimmed);
            output.push('\n');
            continue;
        }

        let resolved = if let Some(ref base) = base_url {
            base.join(trimmed).map(|u| u.to_string()).unwrap_or_else(|_| trimmed.to_string())
        } else {
            trimmed.to_string()
        };

        output.push_str(&format!(
            "http://127.0.0.1:{}/stream?url={}&token={}\n",
            port,
            urlencoding_encode(&resolved),
            token
        ));
    }

    output
}

pub fn urlencoding_decode(s: &str) -> String {
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
            bytes.push(b);
        }
    }
    String::from_utf8(bytes).unwrap_or_else(|_| s.to_string())
}

pub fn urlencoding_encode(s: &str) -> String {
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
