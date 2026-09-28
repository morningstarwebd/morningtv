// tests/playlist_test.rs
// Automated tests for M3U/M3U8 parser

use app_lib::playlist::M3uParser;

#[test]
fn test_parse_valid_m3u() {
    let sample = r#"#EXTM3U
#EXTINF:-1 tvg-id="test1" tvg-name="Channel One" tvg-logo="https://example.com/logo1.png" group-title="News",Channel One
https://example.com/live/ch1.m3u8
#EXTINF:-1 tvg-id="test2" group-title="Sports",Channel Two
https://example.com/live/ch2.m3u8
"#;

    let channels = M3uParser::parse(sample).expect("Failed to parse M3U");
    assert_eq!(channels.len(), 2);
    assert_eq!(channels[0].name, "Channel One");
    assert_eq!(channels[0].group, "News");
    assert_eq!(channels[0].url, "https://example.com/live/ch1.m3u8");
    assert_eq!(channels[1].name, "Channel Two");
    assert_eq!(channels[1].group, "Sports");
}

#[test]
fn test_parse_with_vlc_options() {
    let sample = r#"#EXTM3U
#EXTINF:-1 tvg-name="Special Feed",Special Feed
#EXTVLCOPT:http-user-agent=CustomUA/1.0
#EXTVLCOPT:http-referrer=https://stream.example.com
https://example.com/live/feed.m3u8
"#;

    let channels = M3uParser::parse(sample).expect("Failed to parse M3U");
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].http_user_agent, Some("CustomUA/1.0".to_string()));
    assert_eq!(
        channels[0].http_referrer,
        Some("https://stream.example.com".to_string())
    );
}

#[test]
fn test_empty_m3u_fails() {
    let sample = "";
    assert!(M3uParser::parse(sample).is_err());
}

#[test]
fn test_parse_m3u_with_fallback_directives() {
    let sample = r#"#EXTM3U
#EXTINF:-1 tvg-name="CNN Live",CNN Live
#EXTFALLBACK:https://fallback.example.com/cnn1.m3u8
#EXT-X-FALLBACK:https://fallback.example.com/cnn2.m3u8
https://primary.example.com/cnn.m3u8
"#;

    let channels = M3uParser::parse(sample).expect("Failed to parse M3U");
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].url, "https://primary.example.com/cnn.m3u8");
    assert_eq!(channels[0].fallback_urls.len(), 2);
    assert!(channels[0].fallback_urls.contains(&"https://fallback.example.com/cnn1.m3u8".to_string()));
    assert!(channels[0].fallback_urls.contains(&"https://fallback.example.com/cnn2.m3u8".to_string()));
}

#[test]
fn test_parse_m3u_merges_duplicate_url_entries() {
    let sample = r#"#EXTM3U
#EXTINF:-1 tvg-name="ESPN HD" group-title="Sports",ESPN HD
#EXTFALLBACK:https://fallback.example.com/espn1.m3u8
https://stream1.example.com/espn.m3u8
#EXTINF:-1 tvg-name="ESPN HD" group-title="Sports",ESPN HD
#EXTFALLBACK:https://fallback.example.com/espn2.m3u8
https://stream1.example.com/espn.m3u8
"#;

    let channels = M3uParser::parse(sample).expect("Failed to parse M3U");
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].url, "https://stream1.example.com/espn.m3u8");
    assert_eq!(channels[0].fallback_urls.len(), 2);
    assert!(channels[0].fallback_urls.contains(&"https://fallback.example.com/espn1.m3u8".to_string()));
    assert!(channels[0].fallback_urls.contains(&"https://fallback.example.com/espn2.m3u8".to_string()));
}

#[test]
fn test_parse_m3u_provider_attribute() {
    let sample = r#"#EXTM3U
#EXTINF:-1 tvg-name="Star Gold" group-title="Movies" provider="JioHotstar",Star Gold
https://stream.example.com/stargold.m3u8
"#;

    let channels = M3uParser::parse(sample).expect("Failed to parse M3U");
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].provider, Some("JioHotstar".to_string()));
}

