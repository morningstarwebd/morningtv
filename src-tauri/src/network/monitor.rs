// src/network/monitor.rs
// Real-time network speed monitor using Exponentially Weighted Moving Average (EWMA)

use crate::domain::{NetworkCondition, NetworkMetrics};
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Debug, Clone)]
pub struct BandwidthMonitor {
    metrics: Arc<Mutex<NetworkMetrics>>,
    last_update: Arc<Mutex<Instant>>,
}

impl BandwidthMonitor {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(Mutex::new(NetworkMetrics::default())),
            last_update: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub fn record_sample(&self, bytes_transferred: usize, duration_secs: f64) {
        if duration_secs <= 0.0 {
            return;
        }

        let bits = (bytes_transferred as f64) * 8.0;
        let instantaneous_bps = bits / duration_secs;

        let mut metrics = self.metrics.lock().unwrap();
        metrics.current_speed_bps = instantaneous_bps;

        // Fast EWMA alpha = 0.35 (adapts quickly to sudden drops)
        if metrics.fast_ewma_bps == 0.0 {
            metrics.fast_ewma_bps = instantaneous_bps;
        } else {
            metrics.fast_ewma_bps = 0.35 * instantaneous_bps + 0.65 * metrics.fast_ewma_bps;
        }

        // Slow EWMA alpha = 0.10 (smooth trend)
        if metrics.slow_ewma_bps == 0.0 {
            metrics.slow_ewma_bps = instantaneous_bps;
        } else {
            metrics.slow_ewma_bps = 0.10 * instantaneous_bps + 0.90 * metrics.slow_ewma_bps;
        }

        metrics.condition = Self::evaluate_condition(metrics.fast_ewma_bps, metrics.buffer_duration_secs);
        *self.last_update.lock().unwrap() = Instant::now();
    }

    pub fn update_buffer_state(&self, buffer_secs: f64) {
        let mut metrics = self.metrics.lock().unwrap();
        metrics.buffer_duration_secs = buffer_secs;
        metrics.condition = Self::evaluate_condition(metrics.fast_ewma_bps, metrics.buffer_duration_secs);
    }

    pub fn get_metrics(&self) -> NetworkMetrics {
        self.metrics.lock().unwrap().clone()
    }

    fn evaluate_condition(speed_bps: f64, buffer_secs: f64) -> NetworkCondition {
        if buffer_secs < 2.5 || (speed_bps > 0.0 && speed_bps < 350_000.0) {
            NetworkCondition::Critical
        } else if buffer_secs < 6.0 || speed_bps < 800_000.0 {
            NetworkCondition::Constrained
        } else if speed_bps < 2_500_000.0 {
            NetworkCondition::Moderate
        } else {
            NetworkCondition::Optimal
        }
    }
}
