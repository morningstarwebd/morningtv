// tests/settings_test.rs
// Unit tests for AppSettings serialization, defaults, and quality tier preferences

use app_lib::config::AppSettings;
use app_lib::domain::QualityTier;

#[test]
fn test_settings_default_values() {
    let settings = AppSettings::default();
    assert_eq!(settings.volume, 85);
    assert!(!settings.is_muted);
    assert_eq!(settings.preferred_quality, QualityTier::Auto);
    assert!(settings.auto_adaptive_bitrate);
    assert!(settings.playlist_url.contains("morningtv"));
    assert!(settings.last_played_channel_id.is_none());
}

#[test]
fn test_settings_serde_roundtrip() {
    let mut settings = AppSettings::default();
    settings.volume = 95;
    settings.is_muted = true;
    settings.preferred_quality = QualityTier::High;
    settings.last_played_channel_id = Some("chan_123".to_string());

    let json = serde_json::to_string(&settings).expect("serialization failed");
    let deserialized: AppSettings = serde_json::from_str(&json).expect("deserialization failed");

    assert_eq!(deserialized.volume, 95);
    assert!(deserialized.is_muted);
    assert_eq!(deserialized.preferred_quality, QualityTier::High);
    assert_eq!(deserialized.last_played_channel_id, Some("chan_123".to_string()));
}

#[test]
fn test_settings_handles_corrupt_json() {
    let corrupt_json = "{ invalid_json: true, ";
    let result = serde_json::from_str::<AppSettings>(corrupt_json);
    assert!(result.is_err());
}

#[test]
fn test_quality_tier_serialization() {
    let tiers = vec![
        (QualityTier::Auto, "\"Auto\"", "Auto", 0),
        (QualityTier::UltraLow, "\"UltraLow\"", "360p (Low Bandwidth)", 1),
        (QualityTier::Low, "\"Low\"", "480p (SD)", 2),
        (QualityTier::Medium, "\"Medium\"", "720p (HD)", 3),
        (QualityTier::High, "\"High\"", "1080p (FHD)", 4),
    ];

    for (tier, expected_json, expected_display, expected_idx) in tiers {
        let json = serde_json::to_string(&tier).expect("tier serialization failed");
        assert_eq!(json, expected_json);
        let parsed: QualityTier = serde_json::from_str(&json).expect("tier deserialization failed");
        assert_eq!(parsed, tier);
        assert_eq!(tier.display_name(), expected_display);
        assert_eq!(tier.to_index(), expected_idx);
        assert_eq!(QualityTier::from_index(expected_idx), tier);
    }
}
