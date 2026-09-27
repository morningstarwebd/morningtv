// src/domain/mod.rs
// Domain models re-exports

pub mod channel;
pub mod quality;

pub use channel::{Channel, ChannelId};
pub use quality::QualityTier;
