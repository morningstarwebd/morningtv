// src/network/mod.rs
// Network module re-exports

pub mod ai_brain;
pub mod client;
pub mod client_sentinel;
pub mod ffmpeg_bridge;
pub mod proxy;

pub use ai_brain::AiBrain;
pub use client::ResilientHttpClient;
pub use client_sentinel::ClientSentinel;
pub use ffmpeg_bridge::FfmpegBridge;
pub use proxy::StreamProxy;
