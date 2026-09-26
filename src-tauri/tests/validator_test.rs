// tests/validator_test.rs
// Automated tests for StreamValidator actual verification and fake rejection

use app_lib::domain::Channel;
use app_lib::playlist::StreamValidator;

#[tokio::test]
async fn test_fake_stream_rejection() {
    let validator = StreamValidator::new();

    // Testing against a non-streaming web URL (e.g. google.com or httpbin html)
    // A fake stream that returns HTML must NOT be considered an actual stream!
    let res = validator.verify_stream_actual("https://www.google.com").await;
    assert!(!res.is_actual_stream, "HTML pages must be rejected as fake streams");
}

#[tokio::test]
async fn test_verify_and_heal_mirror_promotion() {
    let validator = StreamValidator::new();

    let mut ch = Channel::new(
        "Test Channel".into(),
        None,
        "News".into(),
        "http://invalid.dead.stream.domain/live.m3u8".into(),
        None,
        None,
    );
    ch.fallback_urls = vec!["https://invalid2.dead.stream.domain/live.m3u8".into()];

    let is_alive = validator.verify_and_heal_channel(&mut ch).await;
    // Both are dead domains, must return false
    assert!(!is_alive);
}
