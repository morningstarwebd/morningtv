// src/config/mod.rs
// Configuration module exports

pub mod defaults;
pub mod settings;

pub use defaults::*;
pub use settings::{AppSettings, AiPermissionLevel};
