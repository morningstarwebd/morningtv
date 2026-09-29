// src/domain/quality.rs
// Stream quality tiers and adaptive bitrate representations

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum QualityTier {
    #[default]
    Auto,
    UltraLow, // 240p / 360p (~300 - 500 kbps)
    Low,      // 480p (~800 kbps)
    Medium,   // 720p (~1.8 - 2.5 Mbps)
    High,     // 1080p (4+ Mbps)
}

impl QualityTier {
    #[allow(dead_code)]
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Auto => "Auto",
            Self::UltraLow => "360p (Low Bandwidth)",
            Self::Low => "480p (SD)",
            Self::Medium => "720p (HD)",
            Self::High => "1080p (FHD)",
        }
    }

    pub fn from_index(index: i32) -> Self {
        match index {
            1 => Self::UltraLow,
            2 => Self::Low,
            3 => Self::Medium,
            4 => Self::High,
            _ => Self::Auto,
        }
    }

    pub fn to_index(&self) -> i32 {
        match self {
            Self::Auto => 0,
            Self::UltraLow => 1,
            Self::Low => 2,
            Self::Medium => 3,
            Self::High => 4,
        }
    }
}
