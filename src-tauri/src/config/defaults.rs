// src/config/defaults.rs
// Default values and constants for MorningTV player

#![allow(dead_code)]

pub const APP_NAME: &str = "MorningTV";
pub const APP_VERSION: &str = "1.0.0";

// Default remote verified master IPTV playlist
pub const DEFAULT_PLAYLIST_URL: &str = "https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u";
pub const STATUS_JSON_URL: &str = "https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/status.json";

// Low-Bandwidth MPV Defaults
pub const DEFAULT_CACHE_SECS: u32 = 30;
pub const DEFAULT_DEMUXER_MAX_BYTES: u64 = 64 * 1024 * 1024; // 64 MiB
pub const DEFAULT_DEMUXER_READAHEAD_SECS: u32 = 25;
pub const DEFAULT_CACHE_PAUSE_WAIT: u32 = 3;
pub const DEFAULT_NETWORK_TIMEOUT_SECS: u32 = 25;

// Audio defaults
pub const DEFAULT_VOLUME: i64 = 85;

// Window defaults
pub const DEFAULT_WINDOW_WIDTH: u32 = 1280;
pub const DEFAULT_WINDOW_HEIGHT: u32 = 720;
