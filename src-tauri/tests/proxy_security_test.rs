// tests/proxy_security_test.rs
// Automated tests for local Axum proxy security: Token Auth, Anti-SSRF, and LRU Cache Bounding

use app_lib::domain::QualityTier;
use app_lib::network::proxy::{
    is_private_or_loopback_host, validate_target_url, verify_auth, SegmentLruCache, StreamProxy,
};
use axum::body::Bytes;
use axum::http::{HeaderMap, HeaderValue, Uri};

#[test]
fn test_proxy_auth_token_generation_and_verification() {
    let token = StreamProxy::get_auth_token();
    assert!(!token.is_empty(), "Token must not be empty");
    assert_eq!(token.len(), 32, "UUID simple token should be 32 hex chars");

    // 1. Valid token in query param
    let uri: Uri = format!("http://127.0.0.1:18181/stream?url=https://example.com/live.m3u8&token={}", token)
        .parse()
        .expect("Valid URI");
    let headers = HeaderMap::new();
    assert!(verify_auth(&uri, &headers), "Valid token in query must pass");

    // 2. Invalid token in query param
    let bad_uri: Uri = "http://127.0.0.1:18181/stream?url=https://example.com/live.m3u8&token=invalid_token"
        .parse()
        .expect("Valid URI");
    assert!(!verify_auth(&bad_uri, &headers), "Invalid token in query must be rejected");

    // 3. Missing token
    let no_token_uri: Uri = "http://127.0.0.1:18181/stream?url=https://example.com/live.m3u8"
        .parse()
        .expect("Valid URI");
    assert!(!verify_auth(&no_token_uri, &headers), "Missing token must be rejected");

    // 4. Valid token in Header X-Proxy-Token
    let mut auth_headers = HeaderMap::new();
    auth_headers.insert("x-proxy-token", HeaderValue::from_str(token).unwrap());
    assert!(verify_auth(&no_token_uri, &auth_headers), "Valid token in header must pass");
}

#[test]
fn test_anti_ssrf_host_filtering() {
    // Blocked hosts
    assert!(is_private_or_loopback_host("localhost"));
    assert!(is_private_or_loopback_host("test.localhost"));
    assert!(is_private_or_loopback_host("127.0.0.1"));
    assert!(is_private_or_loopback_host("127.0.0.50"));
    assert!(is_private_or_loopback_host("0.0.0.0"));
    assert!(is_private_or_loopback_host("::1"));

    // Private RFC1918
    assert!(is_private_or_loopback_host("10.0.0.1"));
    assert!(is_private_or_loopback_host("172.16.0.1"));
    assert!(is_private_or_loopback_host("192.168.1.1"));
    assert!(is_private_or_loopback_host("192.168.0.254"));

    // Cloud metadata / link-local
    assert!(is_private_or_loopback_host("169.254.169.254"));
    assert!(is_private_or_loopback_host("server.local"));
    assert!(is_private_or_loopback_host("internal.lan"));

    // Allowed public hosts
    assert!(!is_private_or_loopback_host("example.com"));
    assert!(!is_private_or_loopback_host("cdn.pluto.tv"));
    assert!(!is_private_or_loopback_host("live.akamaized.net"));
    assert!(!is_private_or_loopback_host("8.8.8.8"));
    assert!(!is_private_or_loopback_host("1.1.1.1"));
}

#[test]
fn test_validate_target_url_security() {
    // Valid public streaming URL
    assert!(validate_target_url("https://cdn.example.com/hls/live.m3u8").is_ok());
    assert!(validate_target_url("http://stream.tv.net/chunk.ts").is_ok());

    // SSRF target URLs must error
    assert!(validate_target_url("http://127.0.0.1:8080/admin").is_err());
    assert!(validate_target_url("http://localhost:3000/api").is_err());
    assert!(validate_target_url("http://192.168.1.1/setup.cgi").is_err());
    assert!(validate_target_url("http://169.254.169.254/latest/meta-data/").is_err());

    // Non-HTTP schemes must error
    assert!(validate_target_url("file:///etc/passwd").is_err());
    assert!(validate_target_url("ftp://example.com/file").is_err());
}

#[test]
fn test_segment_lru_cache_bounded_memory() {
    let mut cache = SegmentLruCache::new(3);

    // Insert 3 segments
    cache.insert("seg1.ts".to_string(), Bytes::from_static(b"data1"), "video/mp2t".to_string(), false);
    cache.insert("seg2.ts".to_string(), Bytes::from_static(b"data2"), "video/mp2t".to_string(), false);
    cache.insert("seg3.ts".to_string(), Bytes::from_static(b"data3"), "video/mp2t".to_string(), false);

    assert!(cache.get("seg1.ts").is_some());
    assert!(cache.get("seg2.ts").is_some());
    assert!(cache.get("seg3.ts").is_some());

    // Insert 4th segment - should evict oldest (seg1)
    cache.insert("seg4.ts".to_string(), Bytes::from_static(b"data4"), "video/mp2t".to_string(), false);

    assert!(cache.get("seg1.ts").is_none(), "Oldest segment must be evicted");
    assert!(cache.get("seg2.ts").is_some());
    assert!(cache.get("seg3.ts").is_some());
    assert!(cache.get("seg4.ts").is_some());
}

#[test]
fn test_quality_tier_mappings() {
    assert_eq!(QualityTier::from_index(0), QualityTier::Auto);
    assert_eq!(QualityTier::from_index(1), QualityTier::UltraLow);
    assert_eq!(QualityTier::from_index(2), QualityTier::Low);
    assert_eq!(QualityTier::from_index(3), QualityTier::Medium);
    assert_eq!(QualityTier::from_index(4), QualityTier::High);

    assert_eq!(QualityTier::Auto.to_index(), 0);
    assert_eq!(QualityTier::High.to_index(), 4);

    assert_eq!(QualityTier::High.display_name(), "1080p (FHD)");
    assert_eq!(QualityTier::Medium.display_name(), "720p (HD)");
}

#[test]
fn test_extract_target_url_with_nested_params() {
    use app_lib::network::proxy::extract_target_url;

    // Normal query
    let q1 = "url=https%3A%2F%2Fexample.com%2Flive.m3u8&token=abc123";
    assert_eq!(extract_target_url(q1), Some("https://example.com/live.m3u8".to_string()));

    // Target URL containing nested query parameters and tokens
    let q2 = "url=https%3A%2F%2Fcdn.provider.com%2Fstream.m3u8%3Fauth%3Dsecret%26exp%3D12345&token=abc123";
    assert_eq!(
        extract_target_url(q2),
        Some("https://cdn.provider.com/stream.m3u8?auth=secret&exp=12345".to_string())
    );

    // Empty query
    assert_eq!(extract_target_url(""), None);
    assert_eq!(extract_target_url("foo=bar"), None);
}

#[tokio::test]
async fn test_validate_target_url_async_dns_ssrf_blocking() {
    use app_lib::network::proxy::validate_target_url_async;

    // Direct loopback IP
    assert!(validate_target_url_async("http://127.0.0.1:8080/manifest.m3u8").await.is_err());
    assert!(validate_target_url_async("http://127.0.0.99:8080/manifest.m3u8").await.is_err());

    // Hostname resolving to loopback
    assert!(validate_target_url_async("http://localhost:8080/manifest.m3u8").await.is_err());

    // Link-local cloud metadata
    assert!(validate_target_url_async("http://169.254.169.254/latest/meta-data/").await.is_err());

    // Private RFC1918
    assert!(validate_target_url_async("http://10.0.0.1/stream.m3u8").await.is_err());
    assert!(validate_target_url_async("http://192.168.1.100/stream.m3u8").await.is_err());
    assert!(validate_target_url_async("http://172.16.0.5/stream.m3u8").await.is_err());

    // Allowed public streaming URL
    assert!(validate_target_url_async("https://example.com/live.m3u8").await.is_ok());
}

#[test]
fn test_proxy_dynamic_port_reporting() {
    let port = StreamProxy::get_port();
    assert!(port > 0, "Proxy port must be greater than 0");
}

