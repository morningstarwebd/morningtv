// src/network/mod.rs
// Network module re-exports

pub mod client;
pub mod proxy;

pub use client::ResilientHttpClient;
pub use proxy::StreamProxy;
