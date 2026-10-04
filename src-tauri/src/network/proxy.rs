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
    Json, Router,
};
use std::collections::{HashMap, VecDeque};
use std::net::{SocketAddr, ToSocketAddrs};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
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
                // Promote to most-recently-used position in order queue
                if let Some(pos) = self.order.iter().position(|k| k == url) {
                    self.order.remove(pos);
                    self.order.push_back(url.to_string());
                }
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
                log::debug!("Evicted LRU proxy cache segment: {}", oldest);
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

/// Sanitizes a URL for secure logging by removing any ephemeral authentication tokens
pub fn sanitize_url_for_log(url: &str) -> String {
    if let Some(idx) = url.find("&token=") {
        format!("{}[TOKEN_REDACTED]", &url[..idx])
    } else if let Some(idx) = url.find("?token=") {
        format!("{}[TOKEN_REDACTED]", &url[..idx])
    } else {
        url.to_string()
    }
}

impl ProxyState {
    async fn get_cached(&self, url: &str) -> Option<CachedItem> {
        // Phase 1: Read-only freshness check without holding a write lock
        {
            let cache = self.cache.read().await;
            match cache.entries.get(url) {
                Some(item) => {
                    let max_age_secs = if item.is_manifest { 4 } else { 30 };
                    if item.created_at.elapsed().as_secs() >= max_age_secs {
                        return None;
                    }
                }
                None => return None,
            }
        }
        // Phase 2: Promote item in LRU queue with write lock on hit
        let mut cache = self.cache.write().await;
        cache.get(url)
    }

    async fn set_cached(&self, url: String, data: Bytes, content_type: String, is_manifest: bool) {
        let mut cache = self.cache.write().await;
        cache.insert(url, data, content_type, is_manifest);
    }
}

pub struct ProxyMetrics {
    pub total_requests: AtomicU64,
    pub cache_hits: AtomicU64,
    pub cache_misses: AtomicU64,
    pub upstream_errors: AtomicU64,
    pub ssrf_blocks: AtomicU64,
    pub auth_failures: AtomicU64,
}

pub static METRICS: ProxyMetrics = ProxyMetrics {
    total_requests: AtomicU64::new(0),
    cache_hits: AtomicU64::new(0),
    cache_misses: AtomicU64::new(0),
    upstream_errors: AtomicU64::new(0),
    ssrf_blocks: AtomicU64::new(0),
    auth_failures: AtomicU64::new(0),
};

static ACTIVE_REQUESTS: AtomicUsize = AtomicUsize::new(0);
const MAX_CONCURRENT_PROXY_REQUESTS: usize = 64;

struct ActiveRequestGuard;
impl Drop for ActiveRequestGuard {
    fn drop(&mut self) {
        ACTIVE_REQUESTS.fetch_sub(1, Ordering::Relaxed);
    }
}

static ORIGIN_LIMITS: OnceLock<dashmap::DashMap<String, Arc<AtomicUsize>>> = OnceLock::new();
pub const MAX_CONCURRENT_PER_ORIGIN: usize = 64;
pub const MAX_M3U8_SIZE: usize = 10 * 1024 * 1024;    // 10 MB
pub const MAX_SEGMENT_SIZE: u64 = 60 * 1024 * 1024;  // 60 MB

static HOST_SECURITY_CACHE: OnceLock<dashmap::DashMap<String, (Instant, bool)>> = OnceLock::new();

fn get_host_security_cache() -> &'static dashmap::DashMap<String, (Instant, bool)> {
    HOST_SECURITY_CACHE.get_or_init(dashmap::DashMap::new)
}

fn get_origin_limits() -> &'static dashmap::DashMap<String, Arc<AtomicUsize>> {
    ORIGIN_LIMITS.get_or_init(dashmap::DashMap::new)
}

struct OriginGuard {
    counter: Arc<AtomicUsize>,
}

impl Drop for OriginGuard {
    fn drop(&mut self) {
        self.counter.fetch_sub(1, Ordering::Relaxed);
    }
}

static ACTIVE_PREWARM_REQUESTS: AtomicUsize = AtomicUsize::new(0);
pub const MAX_CONCURRENT_PREWARM: usize = 6;

struct PrewarmGuard;
impl Drop for PrewarmGuard {
    fn drop(&mut self) {
        ACTIVE_PREWARM_REQUESTS.fetch_sub(1, Ordering::Relaxed);
    }
}

fn try_acquire_origin(origin: &str) -> Option<OriginGuard> {
    let limits = get_origin_limits();

    // Prevent unbounded memory growth over long uptime
    if limits.len() > 128 {
        limits.retain(|_, counter| counter.load(Ordering::Relaxed) > 0);
    }

    let counter = limits
        .entry(origin.to_string())
        .or_insert_with(|| Arc::new(AtomicUsize::new(0)))
        .clone();

    let cur = counter.fetch_add(1, Ordering::Relaxed);
    if cur >= MAX_CONCURRENT_PER_ORIGIN {
        counter.fetch_sub(1, Ordering::Relaxed);
        None
    } else {
        Some(OriginGuard { counter })
    }
}

static SHUTDOWN_TX: OnceLock<tokio::sync::watch::Sender<bool>> = OnceLock::new();
static PROXY_AUTH_TOKEN: OnceLock<String> = OnceLock::new();
static PROXY_PORT: OnceLock<u16> = OnceLock::new();
static PROXY_START_TIME: OnceLock<Instant> = OnceLock::new();

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

    /// Signals graceful shutdown to the proxy listener and in-flight handlers
    pub fn shutdown() {
        if let Some(tx) = SHUTDOWN_TX.get() {
            let _ = tx.send(true);
            tracing::info!("Sent graceful shutdown signal to stream proxy");
        }
    }

    /// Returns a structured metrics snapshot
    pub fn get_metrics_snapshot() -> serde_json::Value {
        let uptime = PROXY_START_TIME
            .get()
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);
        serde_json::json!({
            "status": "healthy",
            "service": "MorningTV Stream Proxy",
            "version": crate::config::APP_VERSION,
            "port": StreamProxy::get_port(),
            "uptime_secs": uptime,
            "active_requests": ACTIVE_REQUESTS.load(Ordering::Relaxed),
            "origin_limits_size": get_origin_limits().len(),
            "total_requests": METRICS.total_requests.load(Ordering::Relaxed),
            "cache_hits": METRICS.cache_hits.load(Ordering::Relaxed),
            "cache_misses": METRICS.cache_misses.load(Ordering::Relaxed),
            "upstream_errors": METRICS.upstream_errors.load(Ordering::Relaxed),
            "ssrf_blocks": METRICS.ssrf_blocks.load(Ordering::Relaxed),
            "auth_failures": METRICS.auth_failures.load(Ordering::Relaxed),
        })
    }

    pub fn start() {
        tauri::async_runtime::spawn(async move {
            let (shutdown_tx, mut shutdown_rx) = tokio::sync::watch::channel(false);
            let _ = SHUTDOWN_TX.set(shutdown_tx);

            let _ = Self::get_auth_token(); // ensure initialized
            PROXY_START_TIME.get_or_init(Instant::now);

            // Periodic background cleanup of idle origin rate-limit counters (every 5 minutes)
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
                loop {
                    interval.tick().await;
                    let limits = get_origin_limits();
                    limits.retain(|_, counter| counter.load(Ordering::Relaxed) > 0);
                }
            });

            let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 10 {
                    return attempt.stop();
                }
                let next_url = attempt.url();
                let next_url_str = next_url.as_str();

                if let Err(err) = validate_target_url(next_url_str) {
                    tracing::warn!("SSRF blocked in redirect: {} ({})", next_url_str, err);
                    return attempt.stop();
                }

                if let Some(host) = next_url.host_str() {
                    let port = next_url.port_or_known_default().unwrap_or(80);
                    if let Ok(addrs) = (host, port).to_socket_addrs() {
                        for addr in addrs {
                            if is_private_or_loopback_ip(&addr.ip()) {
                                tracing::warn!(
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
                .danger_accept_invalid_certs(true)
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
                .route("/transcode", get(handle_transcode))
                .route("/prewarm", get(handle_prewarm))
                .route("/logo", get(handle_logo))
                .route("/health", get(handle_health))
                .route("/metrics", get(handle_metrics))
                .route("/return_to_morningtv", get(handle_return))
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
                        tracing::info!(
                            "Axum streaming proxy listening on http://127.0.0.1:{} (Secured with Ephemeral Token + Anti-SSRF)",
                            actual_port
                        );
                        bound_listener = Some(listener);
                        break;
                    }
                    Err(e) => {
                        tracing::warn!("Port {} unavailable for Axum proxy: {}", port, e);
                    }
                }
            }

            if let Some(listener) = bound_listener {
                let server = axum::serve(listener, app).with_graceful_shutdown(async move {
                    let _ = shutdown_rx.changed().await;
                    tracing::info!("Axum stream proxy shutdown signal received, draining connections...");
                });
                if let Err(e) = server.await {
                    tracing::error!("Axum proxy server exited with error: {}", e);
                }
            } else {
                tracing::error!("CRITICAL: Failed to bind Axum stream proxy on any candidate port");
            }
        });
    }
}

async fn handle_transcode(incoming_headers: HeaderMap, uri: Uri) -> Response {
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

    if let Err(err_msg) = validate_target_url_async(&target_url).await {
        return (StatusCode::BAD_REQUEST, err_msg).into_response();
    }

    match super::ffmpeg_bridge::FfmpegBridge::spawn_remux_stream(&target_url).await {
        Ok(body) => {
            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("video/mp2t"),
            );
            headers.insert(
                axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
                HeaderValue::from_static("*"),
            );
            headers.insert(
                axum::http::header::CACHE_CONTROL,
                HeaderValue::from_static("no-cache, no-store, must-revalidate"),
            );
            (StatusCode::OK, headers, body).into_response()
        }
        Err(e) => {
            tracing::warn!("FFmpeg remuxing error: {}", e);
            (StatusCode::BAD_GATEWAY, format!("Remux failed: {}", e)).into_response()
        }
    }
}

async fn handle_return() -> Response {
    (StatusCode::OK, "Returning to MorningTV").into_response()
}

async fn handle_logo(uri: Uri) -> Response {
    let query_str = uri.query().unwrap_or("");
    let (target_url, channel_name) = parse_logo_query(query_str);

    let (bytes, content_type) =
        crate::storage::logo_cache::get_or_fetch_logo(&target_url, &channel_name).await;

    let mut headers = HeaderMap::new();
    if let Ok(val) = HeaderValue::from_str(&content_type) {
        headers.insert(axum::http::header::CONTENT_TYPE, val);
    }
    headers.insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    headers.insert(
        axum::http::header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );

    (StatusCode::OK, headers, Body::from(bytes)).into_response()
}

async fn handle_health(uri: Uri, headers: HeaderMap, State(state): State<ProxyState>) -> Response {
    if !verify_auth(&uri, &headers) {
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "healthy",
                "service": "MorningTV Stream Proxy"
            })),
        )
            .into_response();
    }

    let uptime = PROXY_START_TIME
        .get()
        .map(|t| t.elapsed().as_secs())
        .unwrap_or(0);
    let cache_len = {
        let cache = state.cache.read().await;
        cache.entries.len()
    };
    let active = ACTIVE_REQUESTS.load(Ordering::Relaxed);
    let body = serde_json::json!({
        "status": "healthy",
        "service": "MorningTV Stream Proxy",
        "version": crate::config::APP_VERSION,
        "port": StreamProxy::get_port(),
        "uptime_secs": uptime,
        "active_requests": active,
        "cache_entries": cache_len,
        "origin_limits_size": get_origin_limits().len(),
        "metrics": {
            "total_requests": METRICS.total_requests.load(Ordering::Relaxed),
            "cache_hits": METRICS.cache_hits.load(Ordering::Relaxed),
            "cache_misses": METRICS.cache_misses.load(Ordering::Relaxed),
            "upstream_errors": METRICS.upstream_errors.load(Ordering::Relaxed),
            "ssrf_blocks": METRICS.ssrf_blocks.load(Ordering::Relaxed),
            "auth_failures": METRICS.auth_failures.load(Ordering::Relaxed),
        }
    });
    (StatusCode::OK, Json(body)).into_response()
}

async fn handle_metrics(uri: Uri, headers: HeaderMap) -> Response {
    if !verify_auth(&uri, &headers) {
        return (StatusCode::FORBIDDEN, "Forbidden: Invalid or missing proxy token").into_response();
    }
    (StatusCode::OK, Json(StreamProxy::get_metrics_snapshot())).into_response()
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

/// Safely extracts target logo URL and channel name without corrupting parameters
pub fn parse_logo_query(query_str: &str) -> (String, String) {
    if query_str.is_empty() {
        return (String::new(), String::new());
    }

    let mut target_url = String::new();
    let mut channel_name = String::new();

    if let Some(name_pos) = query_str.find("&name=") {
        let url_part = &query_str[..name_pos];
        let name_part = &query_str[name_pos + 6..];

        let raw_url = if let Some(stripped) = url_part.strip_prefix("url=") {
            stripped
        } else {
            url_part
        };
        target_url = urlencoding_decode(raw_url);

        let raw_name = if let Some(amp) = name_part.find('&') {
            &name_part[..amp]
        } else {
            name_part
        };
        channel_name = urlencoding_decode(raw_name);
    } else if let Some(url_pos) = query_str.find("&url=") {
        let name_part = &query_str[..url_pos];
        let url_part = &query_str[url_pos + 5..];

        let raw_name = if let Some(stripped) = name_part.strip_prefix("name=") {
            stripped
        } else {
            name_part
        };
        channel_name = urlencoding_decode(raw_name);

        let raw_url = if let Some(amp) = url_part.find('&') {
            &url_part[..amp]
        } else {
            url_part
        };
        target_url = urlencoding_decode(raw_url);
    } else if let Some(stripped) = query_str.strip_prefix("url=") {
        target_url = urlencoding_decode(stripped);
    } else if let Some(stripped) = query_str.strip_prefix("name=") {
        channel_name = urlencoding_decode(stripped);
    } else {
        target_url = urlencoding_decode(query_str);
    }

    (target_url, channel_name)
}

/// Robust query parameter extractor that safely preserves target URLs containing '&' and nested stream tokens
pub fn extract_target_url(query_str: &str) -> Option<String> {
    if query_str.is_empty() {
        return None;
    }
    let idx = if query_str.starts_with("url=") {
        Some(4)
    } else {
        query_str.find("&url=").map(|pos| pos + 5)
    }?;

    let after = &query_str[idx..];
    // Check if query_str has token= after url= (trailing proxy auth token)
    let raw_url = if let Some(token_pos) = after.rfind("&token=") {
        &after[..token_pos]
    } else {
        after
    };
    let decoded = urlencoding_decode(raw_url);
    if !decoded.is_empty() {
        return Some(decoded);
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
            // Task 4.2: IPv4-mapped IPv6 (::ffff:x.x.x.x)
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_private_or_loopback_ip(&std::net::IpAddr::V4(v4));
            }
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

/// Asynchronous validation that actively performs DNS lookup with an in-memory security cache
pub async fn validate_target_url_async(target_url: &str) -> Result<Url, &'static str> {
    let parsed = validate_target_url(target_url)?;
    let host = parsed.host_str().ok_or("Target URL has no host")?;
    let port = parsed.port_or_known_default().unwrap_or(80);

    let cache = get_host_security_cache();
    let cache_key = format!("{}:{}", host, port);

    if let Some(entry) = cache.get(&cache_key) {
        let (cached_at, is_safe) = *entry.value();
        if cached_at.elapsed() < std::time::Duration::from_secs(1800) {
            if is_safe {
                return Ok(parsed);
            } else {
                return Err("Target host resolves to a private, loopback, or metadata address (SSRF blocked)");
            }
        }
    }

    // Perform DNS lookup only if not in cache or expired
    let host_port = format!("{}:{}", host, port);
    if let Ok(addrs) = tokio::net::lookup_host(&host_port).await {
        for addr in addrs {
            if is_private_or_loopback_ip(&addr.ip()) {
                cache.insert(cache_key, (Instant::now(), false));
                return Err("Target host resolves to a private, loopback, or metadata address (SSRF blocked)");
            }
        }
    }

    cache.insert(cache_key, (Instant::now(), true));
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

    let active_prewarm = ACTIVE_PREWARM_REQUESTS.fetch_add(1, Ordering::Relaxed);
    if active_prewarm >= MAX_CONCURRENT_PREWARM {
        ACTIVE_PREWARM_REQUESTS.fetch_sub(1, Ordering::Relaxed);
        return (StatusCode::TOO_MANY_REQUESTS, "Prewarm queue capacity reached").into_response();
    }
    let guard = PrewarmGuard;

    let query_str = uri.query().unwrap_or("");
    let target_url = match extract_target_url(query_str) {
        Some(url) => url,
        None => {
            return (StatusCode::BAD_REQUEST, "Missing URL parameter").into_response();
        }
    };

    if let Err(err) = validate_target_url_async(&target_url).await {
        return (StatusCode::BAD_REQUEST, err).into_response();
    }

    let state_clone = state.clone();
    tokio::spawn(async move {
        let _guard = guard;
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
        if validate_target_url(&seg_url).is_err() {
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
                        if validate_target_url(&resolved_ts).is_ok() {
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
    let req_start = Instant::now();
    METRICS.total_requests.fetch_add(1, Ordering::Relaxed);

    // Concurrency limit to protect system resources
    let active = ACTIVE_REQUESTS.fetch_add(1, Ordering::Relaxed);
    if active >= MAX_CONCURRENT_PROXY_REQUESTS {
        ACTIVE_REQUESTS.fetch_sub(1, Ordering::Relaxed);
        return (
            StatusCode::TOO_MANY_REQUESTS,
            "Too many concurrent proxy requests",
        )
            .into_response();
    }
    let _req_guard = ActiveRequestGuard;

    // 0. AUTHENTICATION & ACCESS CONTROL
    if !verify_auth(&uri, &incoming_headers) {
        METRICS.auth_failures.fetch_add(1, Ordering::Relaxed);
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
        METRICS.ssrf_blocks.fetch_add(1, Ordering::Relaxed);
        tracing::warn!("SSRF or invalid URL blocked by stream proxy: {} ({})", sanitize_url_for_log(&target_url), err_msg);
        return (StatusCode::BAD_REQUEST, err_msg).into_response();
    }

    // Task 4.4: Per-origin rate limiting
    let origin_host = Url::parse(&target_url)
        .ok()
        .and_then(|u| u.host_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "default".to_string());

    let _origin_guard = match try_acquire_origin(&origin_host) {
        Some(g) => g,
        None => {
            tracing::warn!(host = %origin_host, "Per-origin concurrency limit exceeded");
            return (
                StatusCode::TOO_MANY_REQUESTS,
                "Too many concurrent requests to this upstream host",
            )
                .into_response();
        }
    };

    // 2. FAST PATH: In-Memory RAM Cache (Instant sub-millisecond return!)
    if let Some(cached) = state.get_cached(&target_url).await {
        METRICS.cache_hits.fetch_add(1, Ordering::Relaxed);
        tracing::debug!(
            url = %sanitize_url_for_log(&target_url),
            duration_ms = req_start.elapsed().as_millis(),
            cached = true,
            "Served from RAM cache"
        );
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
    METRICS.cache_misses.fetch_add(1, Ordering::Relaxed);

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
                tracing::warn!(
                    attempt = attempt + 1,
                    url = %sanitize_url_for_log(&target_url),
                    error = %e,
                    "Stream proxy attempt failed"
                );
                last_err = Some(e);
                if attempt < 2 {
                    // Resilient backoff: 350ms, 750ms for unstable/lossy network recovery
                    let backoff_ms = if attempt == 0 { 350 } else { 750 };
                    tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                }
            }
        }
    }

    let upstream_res = match upstream_res {
        Some(res) => res,
        None => {
            tracing::warn!(
                url = %sanitize_url_for_log(&target_url),
                error = ?last_err,
                "Stream proxy exhausted 3 retries"
            );
            METRICS.upstream_errors.fetch_add(1, Ordering::Relaxed);
            return (StatusCode::BAD_GATEWAY, "Upstream fetch error after retries").into_response();
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
        if !upstream_status.is_success() {
            let status = StatusCode::from_u16(upstream_status.as_u16())
                .unwrap_or(StatusCode::BAD_GATEWAY);
            tracing::warn!(
                url = %sanitize_url_for_log(&target_url),
                status = upstream_status.as_u16(),
                "Upstream returned non-success HTTP status for manifest"
            );
            METRICS.upstream_errors.fetch_add(1, Ordering::Relaxed);
            return (status, "Upstream stream error").into_response();
        }

        // Task 4.1: Response body size limit for manifests
        if let Some(len) = upstream_res.content_length() {
            if len > MAX_M3U8_SIZE as u64 {
                tracing::warn!(url = %sanitize_url_for_log(&target_url), len, "M3U8 manifest exceeds max allowed size");
                return (StatusCode::BAD_GATEWAY, "Manifest too large").into_response();
            }
        }

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

                tracing::info!(
                    url = %sanitize_url_for_log(&target_url),
                    duration_ms = req_start.elapsed().as_millis(),
                    status = 200,
                    is_manifest = true,
                    "Proxy served rewritten manifest"
                );

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
            Err(_) => {
                METRICS.upstream_errors.fetch_add(1, Ordering::Relaxed);
                (StatusCode::BAD_GATEWAY, "Failed to read manifest text").into_response()
            }
        }
    } else {
        // Task 4.1: Response body size limit for segments
        let content_length = upstream_res.content_length();
        if let Some(len) = content_length {
            if len > MAX_SEGMENT_SIZE {
                tracing::warn!(url = %sanitize_url_for_log(&target_url), len, "Segment exceeds max allowed size");
                return (StatusCode::BAD_GATEWAY, "Segment too large").into_response();
            }
        }

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

        const MAX_BUFFERED_SIZE: u64 = 10 * 1024 * 1024; // 10MB
        let is_range_req = incoming_headers.contains_key(axum::http::header::RANGE);

        if !is_range_req && content_length.is_some_and(|l| l < MAX_BUFFERED_SIZE) {
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

                    tracing::info!(
                        url = %sanitize_url_for_log(&target_url),
                        duration_ms = req_start.elapsed().as_millis(),
                        status = status.as_u16(),
                        cached = false,
                        "Proxy served and cached segment"
                    );

                    (status, headers, Body::from(bytes)).into_response()
                }
                Err(_) => {
                    METRICS.upstream_errors.fetch_add(1, Ordering::Relaxed);
                    (StatusCode::BAD_GATEWAY, "Failed reading upstream segment").into_response()
                }
            }
        } else {
            if let Some(len) = content_length {
                headers.insert(axum::http::header::CONTENT_LENGTH, HeaderValue::from(len));
            }
            let stream = upstream_res.bytes_stream();
            let body = Body::from_stream(stream);

            tracing::info!(
                url = %sanitize_url_for_log(&target_url),
                duration_ms = req_start.elapsed().as_millis(),
                status = status.as_u16(),
                streamed = true,
                "Proxy streaming segment"
            );

            (status, headers, body).into_response()
        }
    }
}

pub fn rewrite_m3u8(manifest: &str, base_url_str: &str, token: &str) -> String {
    use std::fmt::Write as _;

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
                            if let Ok(mut u) = base.join(raw_uri) {
                                if u.query().is_none() && base.query().is_some() {
                                    u.set_query(base.query());
                                }
                                u.to_string()
                            } else {
                                raw_uri.to_string()
                            }
                        } else {
                            raw_uri.to_string()
                        };
                        output.push_str(&trimmed[..prefix_len]);
                        let _ = write!(
                            output,
                            "http://127.0.0.1:{}/stream?url={}&token={}",
                            port,
                            urlencoding_encode(&resolved_uri),
                            token
                        );
                        output.push_str(&after_prefix[end..]);
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
            if let Ok(mut u) = base.join(trimmed) {
                if u.query().is_none() && base.query().is_some() {
                    u.set_query(base.query());
                }
                u.to_string()
            } else {
                trimmed.to_string()
            }
        } else {
            trimmed.to_string()
        };

        let _ = writeln!(
            output,
            "http://127.0.0.1:{}/stream?url={}&token={}",
            port,
            urlencoding_encode(&resolved),
            token
        );
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
