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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SystemNetworkStats {
    pub rx_bytes_per_sec: u64,
    pub tx_bytes_per_sec: u64,
    pub rx_formatted: String,
    pub tx_formatted: String,
    pub rx_mbps: String,
    pub primary_interface: String,
}

#[tauri::command]
pub async fn get_system_network_stats(
    state: State<'_, SharedAppState>,
) -> Result<SystemNetworkStats, String> {
    let mut guard = state.lock().await;
    let now = std::time::Instant::now();

    let elapsed = if let Some(last) = guard.sys_network_last_tick {
        let dur = now.duration_since(last).as_secs_f64();
        if dur > 0.05 { dur } else { 1.0 }
    } else {
        1.0
    };
    guard.sys_network_last_tick = Some(now);

    let mut total_rx = 0u64;
    let mut total_tx = 0u64;
    let mut primary_iface = "Wi-Fi / Ethernet".to_string();

    if let Some(ref mut networks) = guard.sys_networks {
        networks.refresh(true);
        for (name, data) in networks.iter() {
            let rx = data.received();
            let tx = data.transmitted();
            total_rx += rx;
            total_tx += tx;
            if rx > 0 && primary_iface == "Wi-Fi / Ethernet" {
                primary_iface = name.clone();
            }
        }
    }

    let rx_sec = (total_rx as f64 / elapsed) as u64;
    let tx_sec = (total_tx as f64 / elapsed) as u64;

    fn format_bytes(bytes_sec: u64) -> (String, String) {
        let mbps = format!("{:.1} Mbps", (bytes_sec as f64 * 8.0) / 1_000_000.0);
        let formatted = if bytes_sec < 1024 {
            format!("{} B/s", bytes_sec)
        } else if bytes_sec < 1024 * 1024 {
            format!("{:.1} KB/s", bytes_sec as f64 / 1024.0)
        } else {
            format!("{:.2} MB/s", bytes_sec as f64 / (1024.0 * 1024.0))
        };
        (formatted, mbps)
    }

    let (rx_fmt, rx_mbps) = format_bytes(rx_sec);
    let (tx_fmt, _) = format_bytes(tx_sec);

    Ok(SystemNetworkStats {
        rx_bytes_per_sec: rx_sec,
        tx_bytes_per_sec: tx_sec,
        rx_formatted: rx_fmt,
        tx_formatted: tx_fmt,
        rx_mbps,
        primary_interface: primary_iface,
    })
}
