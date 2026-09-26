// tests/bandwidth_test.rs
// Automated tests for BandwidthMonitor and EWMA calculation

use app_lib::domain::NetworkCondition;
use app_lib::network::BandwidthMonitor;

#[test]
fn test_ewma_speed_smoothing() {
    let monitor = BandwidthMonitor::new();

    // Record sample: 1,000,000 bytes over 1 second = 8,000,000 bps (8 Mbps)
    monitor.record_sample(1_000_000, 1.0);
    let m1 = monitor.get_metrics();
    assert!(m1.fast_ewma_bps > 7_900_000.0);

    // Record sudden drop: 20,000 bytes over 1 second = 160,000 bps (160 kbps)
    monitor.record_sample(20_000, 1.0);
    let m2 = monitor.get_metrics();

    // EWMA fast alpha 0.35 brings it down smoothly without zeroing immediately
    assert!(m2.fast_ewma_bps < m1.fast_ewma_bps);
    assert!(m2.fast_ewma_bps > 160_000.0);
}

#[test]
fn test_critical_buffer_underrun_condition() {
    let monitor = BandwidthMonitor::new();
    // High speed but buffer dangerously low (<2.5s)
    monitor.record_sample(1_000_000, 1.0);
    monitor.update_buffer_state(1.2);

    let metrics = monitor.get_metrics();
    assert_eq!(metrics.condition, NetworkCondition::Critical);
}
