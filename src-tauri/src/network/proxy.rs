// src-tauri/src/network/proxy.rs
// Local HTTP streaming proxy to eliminate CORS restrictions, follow redirects,
// and bypass ISP/User-Agent/Referer blocks for FAST & live streams (Pluto, Samsung TV Plus, Free-TV)

use std::io::Cursor;
use std::sync::Arc;
use std::thread;
use tiny_http::{Header, Method, Response, Server, StatusCode};
use url::Url;

pub struct StreamProxy;

impl StreamProxy {
    pub const PORT: u16 = 18181;

    pub fn start() {
        thread::spawn(|| {
            let addr = format!("127.0.0.1:{}", Self::PORT);
            let server = match Server::http(&addr) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to bind stream proxy on {}: {}", addr, e);
                    return;
                }
            };

            let client = Arc::new(
                reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_secs(25))
                    .connect_timeout(std::time::Duration::from_secs(10))
                    .danger_accept_invalid_certs(true)
                    .redirect(reqwest::redirect::Policy::limited(10))
                    .build()
                    .unwrap_or_default(),
            );

            for request in server.incoming_requests() {
                let client = Arc::clone(&client);

                // Handle CORS preflight OPTIONS request
                if request.method() == &Method::Options {
                    let res = Response::empty(StatusCode(200))
                        .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
                        .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, OPTIONS"[..]).unwrap())
                        .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"*"[..]).unwrap());
                    let _ = request.respond(res);
                    continue;
                }

                let req_url = request.url().to_string();
                thread::spawn(move || {
                    Self::handle_request(request, &req_url, &client);
                });
            }
        });
    }

    fn respond_empty_cors(request: tiny_http::Request, status: u16) {
        let res = Response::empty(StatusCode(status))
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS, HEAD"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"*"[..]).unwrap())
            .with_header(Header::from_bytes(&b"Access-Control-Expose-Headers"[..], &b"*"[..]).unwrap());
        let _ = request.respond(res);
    }

    fn handle_request(request: tiny_http::Request, req_url: &str, client: &reqwest::blocking::Client) {
        // Extract "url=" query parameter
        let target_url = match req_url.find("url=") {
            Some(idx) => {
                let query = &req_url[idx + 4..];
                let decoded = urlencoding_decode(query);
                if decoded.is_empty() {
                    Self::respond_empty_cors(request, 400);
                    return;
                }
                decoded
            }
            None => {
                Self::respond_empty_cors(request, 404);
                return;
            }
        };

        // Build request with provider-appropriate headers (Pluto TV, Samsung TV Plus, Amagi, etc.)
        let mut req_builder = client
            .get(&target_url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .header("Accept", "*/*")
            .header("Connection", "keep-alive");

        let lower = target_url.to_lowercase();
        if lower.contains("pluto.tv") {
            req_builder = req_builder
                .header("Referer", "https://pluto.tv/")
                .header("Origin", "https://pluto.tv");
        } else if lower.contains("samsung") || lower.contains("amagi.tv") {
            req_builder = req_builder
                .header("Referer", "https://www.samsungtvplus.com/")
                .header("Origin", "https://www.samsungtvplus.com");
        }

        let upstream_res = match req_builder.send() {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Stream proxy fetch error for {}: {}", target_url, e);
                Self::respond_empty_cors(request, 502);
                return;
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

        let bytes = match upstream_res.bytes() {
            Ok(b) => b,
            Err(_) => {
                Self::respond_empty_cors(request, 502);
                return;
            }
        };

        let is_m3u8 = target_url.contains(".m3u8")
            || effective_url.contains(".m3u8")
            || content_type.contains("mpegurl")
            || bytes.starts_with(b"#EXTM3U");

        if is_m3u8 {
            // Rewrite M3U8 URLs using the post-redirect effective URL as the base
            if let Ok(text) = std::str::from_utf8(&bytes) {
                let rewritten = rewrite_m3u8(text, &effective_url);
                let res = Response::from_string(rewritten)
                    .with_status_code(StatusCode(200))
                    .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/vnd.apple.mpegurl"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Cache-Control"[..], &b"no-cache"[..]).unwrap());
                let _ = request.respond(res);
                return;
            }
        }

        // Binary audio/video segments (.ts, .aac, .m4s, etc.)
        // Note: Do NOT add duplicate Content-Length header - tiny_http automatically adds it from Some(len)
        let len = bytes.len();
        let ctype = if content_type.is_empty() {
            "video/mp2t".to_string()
        } else {
            content_type
        };
        let res = Response::new(
            StatusCode(200),
            vec![
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                Header::from_bytes(&b"Content-Type"[..], ctype.as_bytes()).unwrap(),
                Header::from_bytes(&b"Cache-Control"[..], &b"public, max-age=3600"[..]).unwrap(),
            ],
            Cursor::new(bytes),
            Some(len),
            None,
        );
        let _ = request.respond(res);
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
