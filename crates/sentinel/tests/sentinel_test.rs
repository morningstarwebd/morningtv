// crates/sentinel/tests/sentinel_test.rs
// Unit tests for the MorningTV Sentinel Engine

use sentinel::{
    extract_attribute, format_m3u, is_valid_stream_payload, is_valid_stream_payload_with_content_type,
    is_vip_channel, matches_backup_mirror_key, normalize_channel_key, parse_m3u, ChannelItem,
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

    // Strips resolution tags to merge identical channels
    let key_clean = normalize_channel_key("ABP Ananda (1080p)", "");
    let key_base = normalize_channel_key("ABP Ananda", "");
    assert_eq!(key_clean, key_base);

    // Handles Free-TV markdown links in tvg-id
    let key_md = normalize_channel_key("ABP Ananda", "[ABP Ananda](https://bengali.abplive.com/)");
    assert_eq!(key_md, "abpananda");

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

#[test]
fn test_html_bot_challenge_detection_strings() {
    let html_page = b"<!DOCTYPE html><html><head><title>Cloudflare DDOS</title></head></html>";
    let head = String::from_utf8_lossy(&html_page[..html_page.len().min(512)]).to_lowercase();
    let is_html_error = head.contains("<!doctype html")
        || head.contains("<html")
        || head.contains("cloudflare")
        || head.contains("access denied");
    assert!(is_html_error, "Must detect Cloudflare bot challenge as invalid stream");
}

#[test]
fn test_mpeg_ts_sync_byte_validation() {
    // Aligned 3-packet MPEG-TS payload (188 bytes each, all starting with 0x47)
    let mut valid_ts = vec![0u8; 188 * 3];
    valid_ts[0] = 0x47;
    valid_ts[188] = 0x47;
    valid_ts[376] = 0x47;
    assert!(is_valid_stream_payload(&valid_ts), "Should accept aligned MPEG-TS stream");

    // Random non-TS payload containing single 'G' byte (0x47) in the middle
    let mut random_data = vec![0x10u8; 400];
    random_data[42] = 0x47; // 'G'
    assert!(!is_valid_stream_payload(&random_data), "Should reject random payload containing isolated 0x47");

    let corrupt_payload = vec![0x00, 0x01, 0x02, 0x03];
    assert!(!is_valid_stream_payload(&corrupt_payload));
}

#[test]
fn test_hls_stream_payload_validation() {
    let valid_media_playlist = b"#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nseg1.ts\n";
    assert!(is_valid_stream_payload(valid_media_playlist));

    let valid_master_playlist = b"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1280000\nchunklist.m3u8\n";
    assert!(is_valid_stream_payload(valid_master_playlist));

    // String containing .m3u8 without valid HLS header or directives
    let fake_m3u8 = b"Hello world! This is a link to stream.m3u8 but not a playlist.";
    assert!(!is_valid_stream_payload(fake_m3u8));

    // HTML error response
    let html_404 = b"<!DOCTYPE html><html><body>404 Not Found</body></html>";
    assert!(!is_valid_stream_payload(html_404));
}

#[test]
fn test_fmp4_payload_validation() {
    // fMP4 box header: 4 bytes length, followed by "ftyp"
    let mut fmp4 = vec![0u8; 32];
    fmp4[0..4].copy_from_slice(&[0x00, 0x00, 0x00, 0x20]);
    fmp4[4..8].copy_from_slice(b"ftyp");
    assert!(is_valid_stream_payload(&fmp4));
}

#[test]
fn test_backup_mirror_key_matching_exactness() {
    // Colors HD should match
    assert!(matches_backup_mirror_key("Colors HD", "colorshdin", "colorshd"));
    assert!(matches_backup_mirror_key("Colors", "colorsin", "colorshd"));

    // Regional variants MUST NEVER match Colors HD mirror
    assert!(!matches_backup_mirror_key("Colors Gujarati", "colorsgujaratiin", "colorshd"));
    assert!(!matches_backup_mirror_key("Colors Rishtey", "colorsrishteyin", "colorshd"));
    assert!(!matches_backup_mirror_key("Colors Cineplex", "colorscineplexin", "colorshd"));
    assert!(!matches_backup_mirror_key("Colors Bangla", "colorsbanglain", "colorshd"));
    assert!(!matches_backup_mirror_key("Colors Marathi", "colorsmarathiin", "colorshd"));
    assert!(!matches_backup_mirror_key("Colors Tamil", "colorstamilin", "colorshd"));
    assert!(!matches_backup_mirror_key("Colors Infinity", "colorsinfinityin", "colorshd"));

    // Bengali channels match properly
    assert!(matches_backup_mirror_key("Zee Bangla HD", "zeebangla@in", "zeebangla"));
    assert!(matches_backup_mirror_key("Star Jalsha HD", "starjalsha@in", "starjalsha"));
    assert!(matches_backup_mirror_key("T Sports HD", "tsports@bd", "tsports"));
}

#[test]
fn test_multimedia_payload_dash_webm_flv_and_content_type() {
    // DASH manifest
    let dash = b"<?xml version=\"1.0\"?><MPD xmlns=\"urn:mpeg:dash:schema:mpd:2011\"></MPD>";
    assert!(is_valid_stream_payload(dash));

    // WebM / MKV EBML
    let webm = vec![0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00];
    assert!(is_valid_stream_payload(&webm));

    // FLV
    let flv = vec![0x46, 0x4C, 0x56, 0x01, 0x05, 0x00];
    assert!(is_valid_stream_payload(&flv));

    // Content-Type mpegurl
    let mpegurl_bytes = b"#EXTM3U\nchunklist.m3u8\n";
    assert!(is_valid_stream_payload_with_content_type(mpegurl_bytes, "application/vnd.apple.mpegurl"));

    // HTML error with video content-type should still be rejected
    let html_err = b"<!DOCTYPE html><html><body>Error 404</body></html>";
    assert!(!is_valid_stream_payload_with_content_type(html_err, "video/mp4"));
}
