// tests/sentinel_and_cache_test.rs
// Comprehensive automated test suite for logo disk cache, local ISP sentinel, stream healing, and SQLite cache updates.

use app_lib::domain::{Channel, ChannelId};
use app_lib::storage::logo_cache::{
    detect_image_mime, find_canonical_logo_url, generate_svg_monogram,
};
use app_lib::storage::{ChannelCacheRepository, Database};

#[test]
fn test_logo_cache_mime_detection_accuracy() {
    // PNG magic bytes
    let png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR";
    assert_eq!(detect_image_mime(png_header), "image/png");

    // JPEG magic bytes
    let jpeg_header = b"\xFF\xD8\xFF\xE0\x00\x10JFIF";
    assert_eq!(detect_image_mime(jpeg_header), "image/jpeg");

    // WebP magic bytes
    let webp_header = b"RIFF\x00\x00\x00\x00WEBPVP8 ";
    assert_eq!(detect_image_mime(webp_header), "image/webp");

    // GIF magic bytes
    let gif_header = b"GIF89a\x01\x00\x01\x00";
    assert_eq!(detect_image_mime(gif_header), "image/gif");

    // SVG xml tag
    let svg_content = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
    assert_eq!(detect_image_mime(svg_content), "image/svg+xml");
}

#[test]
fn test_svg_monogram_badge_generation() {
    let (svg_bytes, mime) = generate_svg_monogram("Zee Bangla HD (1080p)");
    assert_eq!(mime, "image/svg+xml");

    let svg_str = String::from_utf8(svg_bytes).expect("Valid UTF-8 SVG");
    assert!(svg_str.contains("<svg"), "Must contain root SVG tag");
    assert!(svg_str.contains("ZB"), "Must extract initials 'ZB' for Zee Bangla");
    assert!(svg_str.contains("linearGradient"), "Must have dynamic brand gradient");

    let (svg_bytes_abp, _) = generate_svg_monogram("ABP Ananda");
    let svg_abp = String::from_utf8(svg_bytes_abp).expect("Valid UTF-8 SVG");
    assert!(svg_abp.contains("AA"), "Must extract initials 'AA' for ABP Ananda");
}

#[test]
fn test_canonical_logo_lookup_for_popular_channels() {
    assert!(find_canonical_logo_url("Zee Bangla").is_some());
    assert!(find_canonical_logo_url("Star Jalsha HD").is_some());
    assert!(find_canonical_logo_url("ABP Ananda").is_some());
    assert!(find_canonical_logo_url("Sony Aath (576p)").is_some());
    assert!(find_canonical_logo_url("Colors HD").is_some());
    assert!(find_canonical_logo_url("Aaj Tak News").is_some());
    assert!(find_canonical_logo_url("Cartoon Network").is_some());

    // Unknown foreign/generic channel should safely return None (to fall back to monogram)
    assert!(find_canonical_logo_url("Unknown Channel 999XYZ").is_none());
}

#[test]
fn test_sqlite_channel_stream_update_and_fallbacks() {
    let db = Database::open_in_memory().expect("Init in-memory db");
    let repo = ChannelCacheRepository::new(db);

    let test_channel = Channel {
        id: ChannelId::new("zeebangla-1"),
        name: "Zee Bangla".to_string(),
        logo: Some("https://example.com/zb.png".to_string()),
        group: "India".to_string(),
        url: "https://dead-server.com/live.m3u8".to_string(),
        fallback_urls: vec![
            "https://working-backup-1.com/live.m3u8".to_string(),
            "https://working-backup-2.com/live.m3u8".to_string(),
        ],
        provider: Some("IPTV-Org".to_string()),
        http_user_agent: None,
        http_referrer: None,
        is_favorite: true,
        is_verified: true,
    };

    repo.save_all(&[test_channel.clone()]).expect("Save channel");

    // Perform an in-place stream promotion (swap dead primary with working fallback)
    let new_primary = "https://working-backup-1.com/live.m3u8";
    let new_fallbacks = vec![
        "https://dead-server.com/live.m3u8".to_string(),
        "https://working-backup-2.com/live.m3u8".to_string(),
    ];

    repo.update_channel_stream("zeebangla-1", new_primary, &new_fallbacks)
        .expect("Stream update ok");

    let loaded = repo.load_all().expect("Load all");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].url, new_primary);
    assert_eq!(loaded[0].fallback_urls, new_fallbacks);
}

#[test]
fn test_last_local_verified_at_metadata_persistence() {
    let db = Database::open_in_memory().expect("Init in-memory db");
    let repo = ChannelCacheRepository::new(db);

    // Initial state: None
    assert_eq!(repo.get_last_local_verified_at().expect("query ok"), None);

    let test_timestamp = "2026-10-03T18:00:00Z";
    repo.set_last_local_verified_at(test_timestamp)
        .expect("set timestamp");

    let fetched = repo.get_last_local_verified_at().expect("fetch timestamp");
    assert_eq!(fetched, Some(test_timestamp.to_string()));
}

#[test]
fn test_backup_mirror_promotion_and_verification_persistence() {
    let db = Database::open_in_memory().expect("Init in-memory db");
    let repo = ChannelCacheRepository::new(db);

    let mut test_channel = Channel {
        id: ChannelId::new("colorshd-1"),
        name: "Colors HD".to_string(),
        logo: Some("https://example.com/colors.png".to_string()),
        group: "India".to_string(),
        url: "https://dead-server.com/colors.m3u8".to_string(),
        fallback_urls: vec!["https://slow-backup.com/colors.m3u8".to_string()],
        provider: Some("IPTV-Org".to_string()),
        http_user_agent: None,
        http_referrer: None,
        is_favorite: true,
        is_verified: false,
    };

    repo.save_all(&[test_channel.clone()]).expect("Initial save");

    // Simulate backup mirror promotion
    let backup_mirror = "https://healed-cdn.com/colorshd.m3u8".to_string();
    let old_primary = std::mem::replace(&mut test_channel.url, backup_mirror.clone());
    test_channel.fallback_urls.insert(0, old_primary);
    test_channel.is_verified = true;

    repo.save_all(&[test_channel.clone()]).expect("Updated save");

    let loaded = repo.load_all().expect("Load all");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].url, backup_mirror);
    assert_eq!(loaded[0].is_verified, true);
    assert_eq!(loaded[0].fallback_urls[0], "https://dead-server.com/colors.m3u8");
}

