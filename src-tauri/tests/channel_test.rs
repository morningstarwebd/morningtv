// tests/channel_test.rs
// Unit tests for Channel entity, ChannelId hashing, and query matching

use app_lib::domain::{Channel, ChannelId};

#[test]
fn test_channel_id_deterministic() {
    let id1 = ChannelId::generate_from_url("https://stream.net/live.m3u8", "BBC News");
    let id2 = ChannelId::generate_from_url("https://stream.net/live.m3u8", "BBC News");
    assert_eq!(id1, id2);
    assert!(!id1.0.is_empty());
}

#[test]
fn test_channel_id_different_for_different_urls() {
    let id1 = ChannelId::generate_from_url("https://stream.net/live1.m3u8", "BBC News");
    let id2 = ChannelId::generate_from_url("https://stream.net/live2.m3u8", "BBC News");
    assert_ne!(id1, id2);
}

#[test]
fn test_channel_matches_query_case_insensitive() {
    let channel = Channel::new(
        "Discovery Science HD".to_string(),
        Some("https://logo.com/disc.png".to_string()),
        "Documentary".to_string(),
        "https://stream.net/disc.m3u8".to_string(),
        None,
        None,
    );

    assert!(channel.matches_query("discovery"));
    assert!(channel.matches_query("SCIENCE"));
    assert!(channel.matches_query("documentary"));
    assert!(channel.matches_query("doc"));
    assert!(!channel.matches_query("sports"));
}

#[test]
fn test_channel_matches_empty_query() {
    let channel = Channel::new(
        "Sony TEN 1".to_string(),
        None,
        "Sports".to_string(),
        "https://stream.net/sony.m3u8".to_string(),
        None,
        None,
    );

    assert!(channel.matches_query(""));
    assert!(channel.matches_query("   "));
}

#[test]
fn test_channel_with_provider() {
    let channel = Channel::new(
        "Star Sports 1".to_string(),
        None,
        "Sports".to_string(),
        "https://stream.net/star.m3u8".to_string(),
        None,
        None,
    ).with_provider(Some("JioTV".to_string()));

    assert_eq!(channel.provider, Some("JioTV".to_string()));
}
