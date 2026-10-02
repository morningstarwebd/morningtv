// src/config/defaults.rs
// Default values and constants for MorningTV player

pub const APP_NAME: &str = "MorningTV";
pub const APP_VERSION: &str = "1.1.2";

// Default remote verified master IPTV playlist
pub const DEFAULT_PLAYLIST_URL: &str = "https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u";
pub const STATUS_JSON_URL: &str = "https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/status.json";

// Streaming and buffering defaults
pub const DEFAULT_CACHE_SECS: u32 = 30;
pub const DEFAULT_NETWORK_TIMEOUT_SECS: u32 = 25;

// Audio defaults
pub const DEFAULT_VOLUME: i64 = 85;

// Window defaults
pub const DEFAULT_WINDOW_WIDTH: u32 = 1280;
pub const DEFAULT_WINDOW_HEIGHT: u32 = 720;
