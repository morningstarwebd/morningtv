// tests/proxy_rewrite_test.rs
// Comprehensive unit tests for M3U8 playlist rewriting and URI attribute handling

use app_lib::network::proxy::rewrite_m3u8;

#[test]
fn test_rewrite_m3u8_relative_urls() {
    let manifest = "\
#EXTM3U
#EXT-X-VERSION:3
#EXTINF:10.0,
segment1.ts
#EXTINF:10.0,
segment2.ts
";
    let base_url = "https://cdn.example.com/live/playlist.m3u8";
    let token = "test_token_123";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    assert!(rewritten.contains("#EXTM3U"));
    assert!(rewritten.contains("http://127.0.0.1:"));
    assert!(rewritten.contains("/stream?url="));
    assert!(rewritten.contains("token=test_token_123"));
    assert!(rewritten.contains("https%3A%2F%2Fcdn.example.com%2Flive%2Fsegment1.ts"));
    assert!(rewritten.contains("https%3A%2F%2Fcdn.example.com%2Flive%2Fsegment2.ts"));
}

#[test]
fn test_rewrite_m3u8_absolute_urls() {
    let manifest = "\
#EXTM3U
#EXTINF:6.0,
https://edge.video.net/chunk01.ts
#EXTINF:6.0,
https://edge.video.net/chunk02.ts
";
    let base_url = "https://cdn.example.com/stream.m3u8";
    let token = "tok456";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    assert!(rewritten.contains("https%3A%2F%2Fedge.video.net%2Fchunk01.ts"));
    assert!(rewritten.contains("https%3A%2F%2Fedge.video.net%2Fchunk02.ts"));
    assert!(rewritten.contains("token=tok456"));
}

#[test]
fn test_rewrite_m3u8_with_uri_attributes() {
    let manifest = "\
#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI=\"key.php?id=123\",IV=0x01
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"English\",URI=\"audio.m3u8\"
#EXTINF:10.0,
segment.ts
";
    let base_url = "https://stream.provider.com/hls/master.m3u8";
    let token = "aes_token";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    assert!(rewritten.contains("#EXT-X-KEY:METHOD=AES-128,URI=\"http://127.0.0.1:"));
    assert!(rewritten.contains("https%3A%2F%2Fstream.provider.com%2Fhls%2Fkey.php%3Fid%3D123"));
    assert!(rewritten.contains("#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"English\",URI=\"http://127.0.0.1:"));
    assert!(rewritten.contains("https%3A%2F%2Fstream.provider.com%2Fhls%2Faudio.m3u8"));
}

#[test]
fn test_rewrite_m3u8_preserves_already_proxied_urls() {
    let manifest = "\
#EXTM3U
#EXTINF:5.0,
http://127.0.0.1:18181/stream?url=https%3A%2F%2Fexample.com%2Fseg1.ts&token=old_token
";
    let base_url = "https://example.com/playlist.m3u8";
    let token = "new_token";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    // Should NOT double-proxy already proxied localhost URL
    let count = rewritten.matches("http://127.0.0.1:").count();
    assert_eq!(count, 1);
}

#[test]
fn test_rewrite_m3u8_empty_manifest() {
    let manifest = "";
    let base_url = "https://cdn.example.com/empty.m3u8";
    let token = "tok";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    assert_eq!(rewritten, "");
}

#[test]
fn test_rewrite_m3u8_comment_only_manifest() {
    let manifest = "\
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
";
    let base_url = "https://cdn.example.com/meta.m3u8";
    let token = "tok";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    assert!(rewritten.contains("#EXTM3U"));
    assert!(rewritten.contains("#EXT-X-TARGETDURATION:10"));
    assert!(!rewritten.contains("/stream?url="));
}

#[test]
fn test_rewrite_m3u8_preserves_query_params_on_relative_urls() {
    let manifest = "\
#EXTM3U
#EXTINF:6.0,
segment01.ts
#EXTINF:6.0,
segment02.ts?custom=param
";
    let base_url = "https://cdn.example.com/hls/live.m3u8?token=secret123&exp=999999";
    let token = "proxy_tok";

    let rewritten = rewrite_m3u8(manifest, base_url, token);
    // segment01.ts lacks query params, so it must inherit token=secret123&exp=999999 from base_url
    assert!(rewritten.contains("segment01.ts%3Ftoken%3Dsecret123%26exp%3D999999"));
    // segment02.ts has its own custom query param, so it retains its own query param
    assert!(rewritten.contains("segment02.ts%3Fcustom%3Dparam"));
}
