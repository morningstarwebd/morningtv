// src-tauri/src/network/proxy.rs
// Ultra-High-Performance Async HTTP Streaming Proxy built on Axum & Tokio
// Eliminates CORS restrictions, follows 301/302 redirects, spoofs provider headers,
// and streams video segments via zero-copy async piping (Body::from_stream)

use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use url::Url;

pub struct StreamProxy;

impl StreamProxy {
    pub const PORT: u16 = 18181;

    pub fn start() {
        tauri::async_runtime::spawn(async move {
            let addr = SocketAddr::from(([127, 0, 0, 1], Self::PORT));

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(25))
                .connect_timeout(std::time::Duration::from_secs(10))
                .danger_accept_invalid_certs(true)
                .redirect(reqwest::redirect::Policy::limited(10))
                .pool_max_idle_per_host(25)
                .tcp_keepalive(std::time::Duration::from_secs(15))
                .build()
                .unwrap_or_default();

            let app = Router::new()
                .route("/stream", get(handle_stream))
                .route("/return_to_novatv", get(handle_return))
                .layer(CorsLayer::permissive())
                .with_state(Arc::new(client));

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

async fn handle_stream(
    State(client): State<Arc<reqwest::Client>>,
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

    let lower = target_url.to_lowercase();
    let mut req_builder = client
        .get(&target_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .header("Accept", "*/*")
        .header("Connection", "keep-alive");

    if lower.contains("pluto.tv") {
        req_builder = req_builder
            .header("Referer", "https://pluto.tv/")
            .header("Origin", "https://pluto.tv");
    } else if lower.contains("samsung") || lower.contains("amagi.tv") {
        req_builder = req_builder
            .header("Referer", "https://www.samsungtvplus.com/")
            .header("Origin", "https://www.samsungtvplus.com");
    }

    let upstream_res = match req_builder.send().await {
        Ok(res) => res,
        Err(e) => {
            log::warn!("Stream proxy fetch error for {}: {}", target_url, e);
            return (StatusCode::BAD_GATEWAY, "Upstream fetch error").into_response();
        }
    };

    // Capture effective URL after 301/302 redirects (CRUCIAL for Samsung jmp2.uk -> amagi.tv)
    let effective_url = upstream_res.url().as_str().to_string();

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
                let mut headers = HeaderMap::new();
                headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/vnd.apple.mpegurl"),
                );
                headers.insert(
                    axum::http::header::CACHE_CONTROL,
                    HeaderValue::from_static("no-cache"),
                );
                (headers, rewritten).into_response()
            }
            Err(_) => (StatusCode::BAD_GATEWAY, "Failed to read manifest text").into_response(),
        }
    } else {
        // High-performance zero-copy async stream piping
        let status = StatusCode::from_u16(upstream_res.status().as_u16()).unwrap_or(StatusCode::OK);
        let mut headers = HeaderMap::new();
        let ctype = if content_type.is_empty() {
            "video/mp2t"
        } else {
            &content_type
        };
        if let Ok(val) = HeaderValue::from_str(ctype) {
            headers.insert(axum::http::header::CONTENT_TYPE, val);
        }
        headers.insert(
            axum::http::header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=3600"),
        );

        let stream = upstream_res.bytes_stream();
        let body = Body::from_stream(stream);
        (status, headers, body).into_response()
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
