// src/network/adaptive.rs
// Adaptive Bitrate (ABR) Controller for low-bandwidth live streams

use crate::domain::{NetworkCondition, NetworkMetrics, QualityTier};
use std::time::Instant;

#[derive(Debug)]
pub struct AdaptiveBitrateController {
    current_tier: QualityTier,
    last_switch: Instant,
    consecutive_critical_count: u32,
    consecutive_optimal_count: u32,
}

impl AdaptiveBitrateController {
    pub fn new() -> Self {
        Self {
            current_tier: QualityTier::Auto,
            last_switch: Instant::now(),
            consecutive_critical_count: 0,
            consecutive_optimal_count: 0,
        }
    }

    pub fn evaluate_and_recommend(
        &mut self,
        metrics: &NetworkMetrics,
        is_auto_enabled: bool,
    ) -> Option<QualityTier> {
        if !is_auto_enabled {
            return None;
        }

        match metrics.condition {
            NetworkCondition::Critical => {
                self.consecutive_critical_count += 1;
                self.consecutive_optimal_count = 0;
            }
            NetworkCondition::Optimal => {
                self.consecutive_optimal_count += 1;
                self.consecutive_critical_count = 0;
            }
            _ => {
                self.consecutive_critical_count = 0;
                self.consecutive_optimal_count = 0;
            }
        }

        // Fast downscale rule: 2 consecutive critical ticks -> drop immediately to lowest
        if self.consecutive_critical_count >= 2 && self.current_tier != QualityTier::UltraLow {
            self.current_tier = QualityTier::UltraLow;
            self.last_switch = Instant::now();
            self.consecutive_critical_count = 0;
            return Some(QualityTier::UltraLow);
        }

        // Conservative upscale rule: 10 consecutive optimal ticks and at least 15s since last switch
        if self.consecutive_optimal_count >= 10
            && self.last_switch.elapsed().as_secs() >= 15
            && self.current_tier != QualityTier::High
        {
            let next_tier = match self.current_tier {
                QualityTier::UltraLow => QualityTier::Low,
                QualityTier::Low => QualityTier::Medium,
                QualityTier::Medium => QualityTier::High,
                QualityTier::High | QualityTier::Auto => QualityTier::High,
            };
            self.current_tier = next_tier;
            self.last_switch = Instant::now();
            self.consecutive_optimal_count = 0;
            return Some(next_tier);
        }

        None
    }
}
