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
    assert!(!settings.hide_region_blocked);
}

#[test]
fn test_settings_serde_roundtrip() {
    let mut settings = AppSettings::default();
    settings.volume = 95;
    settings.is_muted = true;
    settings.preferred_quality = QualityTier::High;
    settings.last_played_channel_id = Some("chan_123".to_string());
    settings.hide_region_blocked = true;

    let json = serde_json::to_string(&settings).expect("serialization failed");
    let deserialized: AppSettings = serde_json::from_str(&json).expect("deserialization failed");

    assert_eq!(deserialized.volume, 95);
    assert!(deserialized.is_muted);
    assert_eq!(deserialized.preferred_quality, QualityTier::High);
    assert_eq!(deserialized.last_played_channel_id, Some("chan_123".to_string()));
    assert!(deserialized.hide_region_blocked);
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

#[tokio::test]
async fn test_ai_copilot_fallback_capabilities_query() {
    let ctx = app_lib::network::ai_brain::AiContext {
        current_channel: Some("Zee Bangla".to_string()),
        current_volume: 50,
        is_muted: false,
        active_category: "All".to_string(),
        channel_sample: vec!["Hungama".to_string(), "Zee Bangla HD".to_string()],
    };

    // Bengali tools query
    let res_bn = app_lib::network::AiBrain::chat_with_copilot(
        None,
        None,
        None,
        None,
        "তোমার কাছে কি কি ক্ষমতা আছে",
        None,
        &ctx,
    )
    .await
    .unwrap();

    assert!(res_bn.reply.contains("play_channel"));
    assert!(res_bn.reply.contains("hunt_stream"));
    assert!(res_bn.reply.contains("set_volume"));

    // English tools query
    let res_en = app_lib::network::AiBrain::chat_with_copilot(
        None,
        None,
        None,
        None,
        "What tools do you have?",
        None,
        &ctx,
    )
    .await
    .unwrap();

    assert!(res_en.reply.contains("play_channel"));
    assert!(res_en.reply.contains("hunt_stream"));

    // Phonetic Hungama command
    let res_hugama = app_lib::network::AiBrain::chat_with_copilot(
        None,
        None,
        None,
        None,
        "hugama chalu koro",
        None,
        &ctx,
    )
    .await
    .unwrap();

    assert_eq!(res_hugama.action, Some("play_channel".to_string()));
    assert_eq!(res_hugama.param, Some("Hungama".to_string()));
}

#[tokio::test]
async fn test_ai_permission_levels_and_doctor() {
    use app_lib::config::AiPermissionLevel;
    use app_lib::network::AiBrain;

    // 1. Read-Only mode
    let res_read_only = AiBrain::diagnose_and_heal_stream(
        "Zee Bangla HD",
        AiPermissionLevel::ReadOnly,
        &[],
    ).await;
    assert!(!res_read_only.healed);
    assert!(!res_read_only.requires_user_confirmation);
    assert!(res_read_only.message.contains("Read-Only"));

    // 2. Ask Permission mode
    let res_ask = AiBrain::diagnose_and_heal_stream(
        "Zee Bangla HD",
        AiPermissionLevel::AskPermission,
        &[],
    ).await;
    assert!(!res_ask.healed);
    assert!(res_ask.requires_user_confirmation);
    assert!(res_ask.new_url.is_some());

    // 3. Full Autonomous mode
    let res_full = AiBrain::diagnose_and_heal_stream(
        "Zee Bangla HD",
        AiPermissionLevel::FullAccess,
        &[],
    ).await;
    assert!(res_full.healed);
    assert!(!res_full.requires_user_confirmation);
    assert!(res_full.new_url.is_some());
}

#[tokio::test]
async fn test_ai_vibe_and_epg_and_scheduler() {
    use app_lib::network::AiBrain;

    let sample_channels = vec![
        "Star Sports 1 HD".to_string(),
        "Sony SAB".to_string(),
        "MTV Beats".to_string(),
        "ABP Ananda".to_string(),
        "Hungama".to_string(),
    ];

    // Vibe: Sad / Need laugh
    let vibe_res = AiBrain::recommend_by_vibe("আমার মন খারাপ, কিছু হাসির দেখাও", &sample_channels);
    assert!(vibe_res.is_some());
    let (ch, _) = vibe_res.unwrap();
    assert_eq!(ch, "Sony SAB");

    // EPG: Live cricket query
    let (epg_ch, _) = AiBrain::query_epg("কোন চ্যানেলে খেলা হচ্ছে?", None, &sample_channels);
    assert_eq!(epg_ch, Some("Star Sports 1 HD".to_string()));

    // Scheduler: Sleep timer
    let timer = AiBrain::parse_schedule_intent("Sleep timer 45 minutes");
    assert!(timer.is_some());
    let t = timer.unwrap();
    assert_eq!(t.action_type, "sleep_timer");
    assert_eq!(t.delay_seconds, 45 * 60);
}
