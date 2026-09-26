// src/network/mod.rs
// Network module re-exports

pub mod adaptive;
pub mod client;
pub mod monitor;
pub mod proxy;

pub use adaptive::AdaptiveBitrateController;
pub use client::ResilientHttpClient;
pub use monitor::BandwidthMonitor;
pub use proxy::StreamProxy;
