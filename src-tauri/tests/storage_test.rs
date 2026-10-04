// tests/storage_test.rs
// Automated test suite for SQLite channel cache and metadata persistence

use app_lib::domain::{Channel, ChannelId};
use app_lib::storage::{ChannelCacheRepository, Database};

#[test]
fn test_sqlite_channel_cache_roundtrip_with_headers() {
    let db = Database::open_in_memory().expect("Failed to init in-memory database");
    let repo = ChannelCacheRepository::new(db);

    let test_channel = Channel {
        id: ChannelId::new("channel-101"),
        name: "Test HD News".to_string(),
        logo: Some("https://example.com/logo.png".to_string()),
        group: "News".to_string(),
        url: "https://example.com/stream.m3u8".to_string(),
        fallback_urls: vec!["https://backup.com/stream.m3u8".to_string()],
        provider: Some("MorningTV".to_string()),
        http_user_agent: Some("CustomPlayer/2.0".to_string()),
        http_referrer: Some("https://auth.example.com/".to_string()),
        is_favorite: false,
        is_verified: true,
    };

    // Save channel into SQLite cache
    let channels = vec![test_channel.clone()];
    repo.save_all(&channels).expect("Failed to save channels");

    // Retrieve channels and verify complete data integrity
    let loaded = repo.load_all().expect("Failed to load channels");
    assert_eq!(loaded.len(), 1, "Expected exactly 1 channel in cache");

    let loaded_ch = &loaded[0];
    assert_eq!(loaded_ch.id, test_channel.id);
    assert_eq!(loaded_ch.name, test_channel.name);
    assert_eq!(loaded_ch.group, test_channel.group);
    assert_eq!(loaded_ch.url, test_channel.url);
    assert_eq!(loaded_ch.fallback_urls, test_channel.fallback_urls);
    assert_eq!(loaded_ch.provider, test_channel.provider);
    assert_eq!(
        loaded_ch.http_user_agent,
        Some("CustomPlayer/2.0".to_string()),
        "http_user_agent must be preserved across SQLite round-trip"
    );
    assert_eq!(
        loaded_ch.http_referrer,
        Some("https://auth.example.com/".to_string()),
        "http_referrer must be preserved across SQLite round-trip"
    );
}

#[test]
fn test_app_metadata_last_synced_persistence() {
    let db = Database::open_in_memory().expect("Failed to init in-memory database");
    let repo = ChannelCacheRepository::new(db);

    // Initial state: last synced timestamp should be None
    assert_eq!(repo.get_last_synced_at().expect("query ok"), None);

    // Set last synced timestamp
    let iso_timestamp = "2026-09-28T12:00:00Z";
    repo.set_last_synced_at(iso_timestamp).expect("save timestamp ok");

    // Read back timestamp and verify persistence
    let retrieved = repo.get_last_synced_at().expect("query ok");
    assert_eq!(
        retrieved,
        Some(iso_timestamp.to_string()),
        "Timestamp must be persisted accurately in app_metadata"
    );
}

#[test]
fn test_channel_cache_clear_and_empty() {
    let db = Database::open_in_memory().expect("Failed to init in-memory database");
    let repo = ChannelCacheRepository::new(db);

    let ch1 = Channel {
        id: ChannelId::new("fav-1"),
        name: "Sports Live".to_string(),
        logo: None,
        group: "Sports".to_string(),
        url: "https://example.com/sport.m3u8".to_string(),
        fallback_urls: vec![],
        provider: Some("Default".to_string()),
        http_user_agent: None,
        http_referrer: None,
        is_favorite: false,
        is_verified: true,
    };

    repo.save_all(&[ch1]).expect("save ok");
    assert_eq!(repo.load_all().unwrap().len(), 1);

    repo.clear().expect("clear ok");
    assert_eq!(repo.load_all().unwrap().len(), 0, "Cache must be empty after clear");
}
