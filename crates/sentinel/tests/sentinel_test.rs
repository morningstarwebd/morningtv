// crates/sentinel/tests/sentinel_test.rs
// Unit tests for the MorningTV Sentinel Engine

use sentinel::{
    extract_attribute, format_m3u, is_vip_channel, normalize_channel_key, parse_m3u, ChannelItem,
};

#[test]
fn test_parse_m3u_from_raw_content() {
    let raw = r#"#EXTM3U
#EXTINF:-1 tvg-id="zeebangla@in" tvg-name="Zee Bangla" tvg-logo="https://example.com/logo.png" group-title="India",Zee Bangla HD
#EXTFALLBACK: https://backup.example.com/live.m3u8
https://main.example.com/live.m3u8
#EXTINF:-1 tvg-id="starplus" group-title="Entertainment",Star Plus
https://stream.starplus.com/hls.m3u8
"#;

    let items = parse_m3u(raw, "General", "TestProvider", false);
    assert_eq!(items.len(), 2);

    let ch1 = &items[0];
    assert_eq!(ch1.name, "Zee Bangla HD");
    assert_eq!(ch1.id, "zeebangla@in");
    assert_eq!(ch1.group, "India");
    assert_eq!(ch1.provider, "TestProvider");
    assert!(ch1.fallbacks.contains(&"https://backup.example.com/live.m3u8".to_string()));
    assert!(ch1.is_vip, "Zee Bangla should be flagged as VIP");

    let ch2 = &items[1];
    assert_eq!(ch2.name, "Star Plus");
    assert_eq!(ch2.group, "Entertainment");
    assert_eq!(ch2.url, "https://stream.starplus.com/hls.m3u8");
}

#[test]
fn test_normalize_channel_key_deduplication() {
    // Normalizes tvg-id with domain
    let key1 = normalize_channel_key("Zee Bangla HD", "zeebangla@in");
    assert_eq!(key1, "zeebangla");

    // Normalizes punctuation and spaces
    let key2 = normalize_channel_key("SONY  SAB!! (HD)", "");
    assert_eq!(key2, "sonysabhd");

    // Two channels with different casing/spacing normalize identically
    let key3 = normalize_channel_key("Star Sports 1", "");
    let key4 = normalize_channel_key("star  sports 1 (In)", "");
    assert!(key4.starts_with(&key3));
}

#[test]
fn test_vip_channel_detection() {
    assert!(is_vip_channel("Zee Bangla", ""));
    assert!(is_vip_channel("Star Jalsha Cinema", ""));
    assert!(is_vip_channel("Sony Aath", ""));
    assert!(is_vip_channel("Colors Bangla", ""));
    assert!(is_vip_channel("ABP Ananda", ""));
    assert!(is_vip_channel("DD Sports", ""));
    assert!(is_vip_channel("Random Channel", "dd sports tvg"));
    assert!(!is_vip_channel("Random Unrelated Channel", "random_id"));
}

#[test]
fn test_extract_attribute() {
    let line = r#"#EXTINF:-1 tvg-id="ch_123" tvg-logo="https://img.com/1.png" group-title="News",Channel 1"#;
    assert_eq!(extract_attribute(line, "tvg-id"), Some("ch_123".to_string()));
    assert_eq!(extract_attribute(line, "tvg-logo"), Some("https://img.com/1.png".to_string()));
    assert_eq!(extract_attribute(line, "group-title"), Some("News".to_string()));
    assert_eq!(extract_attribute(line, "nonexistent"), None);
}

#[test]
fn test_format_m3u_output_valid() {
    let channels = vec![
        ChannelItem {
            name: "DD News".to_string(),
            id: "ddnews".to_string(),
            logo: "https://example.com/dd.png".to_string(),
            group: "News".to_string(),
            provider: "Doordarshan".to_string(),
            url: "https://cdn.example.com/ddnews.m3u8".to_string(),
            fallbacks: vec!["https://mirror.example.com/ddnews.m3u8".to_string()],
            is_fast_cdn: true,
            is_vip: false,
        },
    ];

    let output = format_m3u(&channels);
    assert!(output.starts_with("#EXTM3U\n"));
    assert!(output.contains("#EXTINF:-1 tvg-id=\"ddnews\""));
    assert!(output.contains("group-title=\"News\""));
    assert!(output.contains("#EXTFALLBACK: https://mirror.example.com/ddnews.m3u8"));
    assert!(output.contains("https://cdn.example.com/ddnews.m3u8"));
}
