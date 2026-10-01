// src/domain/mod.rs
// Domain models re-exports

pub mod channel;
pub mod epg;
pub mod quality;

pub use channel::{Channel, ChannelId};
pub use epg::{ChannelEpg, EpgProgram};
pub use quality::QualityTier;
