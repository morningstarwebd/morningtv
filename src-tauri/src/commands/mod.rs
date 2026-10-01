// src/commands/mod.rs
// Tauri IPC commands module

pub mod channels;
pub mod epg;
pub mod pip;
pub mod settings;
pub mod system;
pub mod telemetry;
pub mod youtube;

pub use channels::*;
pub use epg::*;
pub use pip::*;
pub use settings::*;
pub use system::*;
pub use telemetry::*;
pub use youtube::*;

