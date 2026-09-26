// src/domain/mod.rs
// Domain models re-exports

pub mod channel;
pub mod metrics;
pub mod quality;

pub use channel::{Channel, ChannelId};
pub use metrics::{NetworkCondition, NetworkMetrics};
pub use quality::QualityTier;
