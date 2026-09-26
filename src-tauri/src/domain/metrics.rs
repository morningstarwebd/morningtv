// src/domain/metrics.rs
// Network bandwidth and buffer telemetry domain models

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub current_speed_bps: f64,
    pub fast_ewma_bps: f64,
    pub slow_ewma_bps: f64,
    pub buffer_duration_secs: f64,
    pub condition: NetworkCondition,
}

impl Default for NetworkMetrics {
    fn default() -> Self {
        Self {
            current_speed_bps: 0.0,
            fast_ewma_bps: 0.0,
            slow_ewma_bps: 0.0,
            buffer_duration_secs: 0.0,
            condition: NetworkCondition::Optimal,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkCondition {
    Optimal,     // > 2.5 Mbps, buffer > 10s
    Moderate,    // 800 kbps - 2.5 Mbps
    Constrained, // 350 kbps - 800 kbps
    Critical,    // < 350 kbps or buffer < 3s (underrun imminent)
}

impl NetworkMetrics {
    #[allow(dead_code)]
    pub fn formatted_speed(&self) -> String {
        let bps = self.fast_ewma_bps;
        if bps < 1_000.0 {
            format!("{:.0} bps", bps)
        } else if bps < 1_000_000.0 {
            format!("{:.1} kbps", bps / 1_000.0)
        } else {
            format!("{:.2} Mbps", bps / 1_000_000.0)
        }
    }
}
