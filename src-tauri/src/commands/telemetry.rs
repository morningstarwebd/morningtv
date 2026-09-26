// src/commands/telemetry.rs
// Tauri IPC command handlers for bandwidth monitoring and adaptive bitrate

use crate::app::SharedAppState;
use crate::domain::{NetworkMetrics, QualityTier};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn record_metrics(
    app_handle: AppHandle,
    buffer_secs: f64,
    bitrate_bps: f64,
    state: State<'_, SharedAppState>,
) -> Result<Option<QualityTier>, String> {
    let mut guard = state.lock().await;
    guard.bandwidth_monitor.update_buffer_state(buffer_secs);
    if bitrate_bps > 0.0 {
        guard.bandwidth_monitor.record_sample(bitrate_bps as usize / 8, 1.0);
    }

    let metrics = guard.bandwidth_monitor.get_metrics();
    let auto_enabled = guard.settings.auto_adaptive_bitrate;
    let recommendation = guard.adaptive_controller.evaluate_and_recommend(&metrics, auto_enabled);

    if let Some(tier) = recommendation {
        guard.settings.preferred_quality = tier;
        let _ = guard.settings.save();
        let _ = app_handle.emit("quality_tier_changed", tier);
    }

    Ok(recommendation)
}

#[tauri::command]
pub async fn get_metrics(state: State<'_, SharedAppState>) -> Result<NetworkMetrics, String> {
    let guard = state.lock().await;
    Ok(guard.bandwidth_monitor.get_metrics())
}
