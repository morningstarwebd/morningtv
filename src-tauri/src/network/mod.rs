// src/network/mod.rs
// Network module re-exports

pub mod client;
pub mod ffmpeg_bridge;
pub mod proxy;

pub use client::ResilientHttpClient;
pub use ffmpeg_bridge::FfmpegBridge;
pub use proxy::StreamProxy;
