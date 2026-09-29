// src-tauri/tests/proxy_integration_test.rs
// Integration tests covering the proxy pipeline, health, metrics, and security boundaries

use app_lib::network::proxy::{
    extract_target_url, is_private_or_loopback_ip, rewrite_m3u8, sanitize_url_for_log,
    validate_target_url_async, verify_auth, StreamProxy, MAX_M3U8_SIZE, MAX_SEGMENT_SIZE,
};
use axum::http::{HeaderMap, HeaderValue, Uri};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

#[test]
fn test_proxy_metrics_snapshot_structure() {
    let snapshot = StreamProxy::get_metrics_snapshot();
    assert_eq!(snapshot["status"], "healthy");
    assert_eq!(snapshot["service"], "MorningTV Stream Proxy");
    assert!(snapshot["total_requests"].is_number());
    assert!(snapshot["cache_hits"].is_number());
    assert!(snapshot["cache_misses"].is_number());
    assert!(snapshot["ssrf_blocks"].is_number());
    assert!(snapshot["auth_failures"].is_number());
}

#[test]
fn test_verify_auth_header_and_query() {
    let token = StreamProxy::get_auth_token();
    assert!(!token.is_empty(), "Token must be non-empty");

    // 1. Valid X-Proxy-Token Header
    let mut headers = HeaderMap::new();
    headers.insert("x-proxy-token", HeaderValue::from_str(token).unwrap());
    let uri: Uri = "/stream?url=https%3A%2F%2Fexample.com%2Fstream.m3u8".parse().unwrap();
    assert!(verify_auth(&uri, &headers));

    // 2. Invalid Header
    let mut bad_headers = HeaderMap::new();
    bad_headers.insert("x-proxy-token", HeaderValue::from_static("invalid_token"));
    assert!(!verify_auth(&uri, &bad_headers));

    // 3. Valid Query Token without header
    let empty_headers = HeaderMap::new();
    let query_uri: Uri = format!("/stream?url=https%3A%2F%2Fexample.com%2Fstream.m3u8&token={}", token)
        .parse()
        .unwrap();
    assert!(verify_auth(&query_uri, &empty_headers));

    // 4. Invalid Query Token
    let bad_query_uri: Uri = "/stream?url=https%3A%2F%2Fexample.com%2Fstream.m3u8&token=wrong"
        .parse()
        .unwrap();
    assert!(!verify_auth(&bad_query_uri, &empty_headers));
}

#[test]
fn test_ipv6_and_mapped_ipv4_ssrf_blocking() {
    // IPv4-mapped IPv6 loopback
    let mapped_loopback = IpAddr::V6(Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001)); // ::ffff:127.0.0.1
    assert!(is_private_or_loopback_ip(&mapped_loopback));

    // IPv4-mapped RFC1918 (192.168.1.1)
    let mapped_rfc1918 = IpAddr::V6(Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0101));
    assert!(is_private_or_loopback_ip(&mapped_rfc1918));

    // IPv6 Loopback (::1)
    let v6_loopback = IpAddr::V6(Ipv6Addr::LOCALHOST);
    assert!(is_private_or_loopback_ip(&v6_loopback));

    // IPv6 Unspecified (::)
    let v6_unspec = IpAddr::V6(Ipv6Addr::UNSPECIFIED);
    assert!(is_private_or_loopback_ip(&v6_unspec));

    // IPv6 Unique Local (fc00::1)
    let v6_unique_local: IpAddr = "fc00::1".parse().unwrap();
    assert!(is_private_or_loopback_ip(&v6_unique_local));

    // IPv6 Link-Local (fe80::1)
    let v6_link_local: IpAddr = "fe80::1".parse().unwrap();
    assert!(is_private_or_loopback_ip(&v6_link_local));

    // Public IPv6 (Cloudflare DNS: 2606:4700:4700::1111)
    let v6_public: IpAddr = "2606:4700:4700::1111".parse().unwrap();
    assert!(!is_private_or_loopback_ip(&v6_public));

    // Public IPv4 (Google DNS: 8.8.8.8)
    let v4_public = IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8));
    assert!(!is_private_or_loopback_ip(&v4_public));
}

#[tokio::test]
async fn test_async_dns_ssrf_rejects_localhost_and_metadata() {
    let localhost_result = validate_target_url_async("http://localhost:8080/stream.m3u8").await;
    assert!(localhost_result.is_err(), "Localhost must be rejected");

    let meta_result = validate_target_url_async("http://169.254.169.254/latest/meta-data/").await;
    assert!(meta_result.is_err(), "Cloud metadata must be rejected");

    let rfc1918_result = validate_target_url_async("http://192.168.1.1/admin").await;
    assert!(rfc1918_result.is_err(), "RFC1918 address must be rejected");
}

#[test]
fn test_response_size_limits_constants() {
    assert_eq!(MAX_M3U8_SIZE, 10 * 1024 * 1024, "M3U8 size limit should be 10MB");
    assert_eq!(MAX_SEGMENT_SIZE, 60 * 1024 * 1024, "Segment size limit should be 60MB");
}

#[test]
fn test_m3u8_rewriting_with_nested_tokens_and_queries() {
    let manifest = "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nsegment1.ts?key=abc&expire=12345\n";
    let base_url = "https://cdn.example.com/live/playlist.m3u8";
    let token = "test_token_123";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    assert!(rewritten.contains("http://127.0.0.1:"));
    assert!(rewritten.contains("/stream?url="));
    assert!(rewritten.contains("&token=test_token_123"));
}

#[test]
fn test_sanitize_url_for_log() {
    let clean = "https://example.com/live/stream.m3u8";
    assert_eq!(sanitize_url_for_log(clean), clean);

    let with_amp_token = "https://example.com/live/stream.m3u8?param=1&token=secret123";
    assert_eq!(
        sanitize_url_for_log(with_amp_token),
        "https://example.com/live/stream.m3u8?param=1[TOKEN_REDACTED]"
    );

    let with_q_token = "https://example.com/live/stream.m3u8?token=secret123";
    assert_eq!(
        sanitize_url_for_log(with_q_token),
        "https://example.com/live/stream.m3u8[TOKEN_REDACTED]"
    );
}

#[test]
fn test_extract_target_url_edge_cases() {
    assert_eq!(extract_target_url(""), None);
    assert_eq!(extract_target_url("random_string_without_url"), None);
    assert_eq!(extract_target_url("url="), None);

    let query = "url=https%3A%2F%2Fcdn.example.com%2Fstream.m3u8&token=my_secret_token";
    let extracted = extract_target_url(query);
    assert_eq!(extracted, Some("https://cdn.example.com/stream.m3u8".to_string()));
}

#[test]
fn test_handle_malformed_m3u8_robustness() {
    let garbage = "NOT_A_VALID_MANIFEST\n<html><head>Error</head><body>Forbidden</body></html>";
    let rewritten = rewrite_m3u8(garbage, "https://example.com/stream.m3u8", "tok_xyz");
    assert!(rewritten.contains("http://127.0.0.1:"));
}
