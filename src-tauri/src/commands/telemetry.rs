// src/commands/telemetry.rs
// Isolated OS-level system network telemetry monitor via sysinfo (zero AppState mutex contention)

use std::sync::Mutex;
use tauri::State;

pub struct NetworkMonitorState {
    networks: Mutex<sysinfo::Networks>,
    last_tick: Mutex<std::time::Instant>,
}

impl NetworkMonitorState {
    pub fn new() -> Self {
        Self {
            networks: Mutex::new(sysinfo::Networks::new_with_refreshed_list()),
            last_tick: Mutex::new(std::time::Instant::now()),
        }
    }
}

impl Default for NetworkMonitorState {
    fn default() -> Self {
        Self::new()
    }
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
    state: State<'_, NetworkMonitorState>,
) -> Result<SystemNetworkStats, String> {
    let now = std::time::Instant::now();
    let elapsed = {
        let mut last_guard = state.last_tick.lock().map_err(|e| e.to_string())?;
        let dur = now.duration_since(*last_guard).as_secs_f64();
        *last_guard = now;
        if dur > 0.05 {
            dur
        } else {
            1.0
        }
    };

    let mut total_rx = 0u64;
    let mut total_tx = 0u64;
    let mut primary_iface = "Wi-Fi / Ethernet".to_string();

    {
        let mut networks = state.networks.lock().map_err(|e| e.to_string())?;
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

#[tauri::command]
pub async fn get_proxy_metrics() -> Result<serde_json::Value, String> {
    Ok(crate::network::StreamProxy::get_metrics_snapshot())
}

#[tauri::command]
pub async fn log_frontend_error(
    level: String,
    context: String,
    message: String,
) -> Result<(), String> {
    match level.to_lowercase().as_str() {
        "error" => tracing::error!(context = %context, "[Frontend Error]: {}", message),
        "warn" => tracing::warn!(context = %context, "[Frontend Warn]: {}", message),
        "info" => tracing::info!(context = %context, "[Frontend Info]: {}", message),
        _ => tracing::debug!(context = %context, "[Frontend Debug]: {}", message),
    }
    Ok(())
}
