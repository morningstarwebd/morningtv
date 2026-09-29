<div align="center">

# 🌅 MorningTV

### High Performance Native Windows Live TV Player & Cloud Stream Sentinel

<br/>

[![Release](https://img.shields.io/badge/Official_Release-v1.0.0-00E676?style=for-the-badge&logo=github&logoColor=black)](https://github.com/morningstarwebd/morningtv/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows_10_|_11-00B0FF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/morningstarwebd/morningtv/releases/latest)
[![Engine](https://img.shields.io/badge/Streaming_Engine-Rust_+_Tokio-FF6D00?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Framework](https://img.shields.io/badge/GUI_Framework-Tauri_v2-7C4DFF?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![License](https://img.shields.io/badge/License-MIT-FFD600?style=for-the-badge&logoColor=black)](LICENSE)
[![Production Audit](https://img.shields.io/badge/Audit_Score-READY_100%2F100-00E676?style=for-the-badge&logo=shield&logoColor=white)](#-production-readiness--security)
[![Tests](https://img.shields.io/badge/Tests-61%2F61_Passing-7C4DFF?style=for-the-badge&logo=githubactions&logoColor=white)](#%EF%B8%8F-building-from-source)

<br/>

MorningTV is a native Windows desktop application for watching live television with zero lag, zero buffering, and zero blackout transitions. Built from scratch with Rust, Tokio, Axum, React 19, and Tauri v2, it includes an in-process streaming proxy, YouTube-style adaptive buffering, predictive channel pre-warming, a Web Audio API volume amplifier, and a cloud-native Tokio stream auditor that keeps thousands of channels verified around the clock.

<br/>

[📥 Download Windows Setup (Offline Embedded)](https://github.com/morningstarwebd/morningtv/releases/latest) • [📋 Copy Playlists](#-one-click-copy-playlists) • [🔬 Architecture](#-system-architecture-deep-dive) • [⌨️ Controls](#%EF%B8%8F-keyboard-shortcuts) • [🛠️ Build](#%EF%B8%8F-building-from-source) • [📜 License](#-license)

</div>

<br/>

---

## 📋 One-Click Copy Playlists

Every playlist is hosted directly on GitHub's enterprise CDN with 99.99% uptime. Hover over any code box below and click the **Copy (📋)** button on the top right corner. Then paste the URL into MorningTV Desktop, VLC Media Player, Kodi, TiviMate, OTTNavigator, or any IPTV app.

### 🌐 Master Index (All Verified Channels)
Complete collection of every verified stream across all categories:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u
```

### 📰 News & World Information
Live 24/7 international news, business, and weather:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_news.m3u
```

### 🎬 Movies & Entertainment
HD cinema, drama series, lifestyle, reality TV, and classics:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_entertainment.m3u
```

### ⚽ Sports & Live Events
Motorsports, stadium broadcasts, combat sports, and tournament feeds:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_sports.m3u
```

### 🎵 Music & Live Performances
Music videos, concert recordings, and radio visualization channels:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_music.m3u
```

### 👶 Kids & Animation
Safe, family-friendly cartoons, educational shows, and animated features:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_kids.m3u
```

### 🇮🇳 India & Regional Broadcasters
Hindi, Bengali, and South Asian public broadcasts:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_india.m3u
```

<br/>

---

## 💎 Key Capabilities

| # | Feature | What It Does |
| :---: | :--- | :--- |
| 1 | **100% Offline Embedded Installer** | The NSIS setup executable bundles the complete Microsoft Edge WebView2 runtime (~209 MB). Fresh Windows machines install and launch MorningTV with zero internet downloads. |
| 2 | **In-Process Tokio Axum Stream Proxy** | A full HTTP streaming server runs inside the application on `127.0.0.1:18181`. It rewrites upstream headers, injects broadcast User-Agent strings, bypasses CORS, and caches transport segments in RAM. |
| 3 | **YouTube-Style Dynamic Adaptive Buffering** | Buffer cushion starts at 5 seconds for instant playback, then dynamically expands to 30 seconds during stable broadband. ISP packet jitter is absorbed without any video stutter. |
| 4 | **Predictive RAM Pre-Warming** | Background Tokio tasks silently pre-fetch manifests and first video segments of adjacent channels. Channel switching completes in under 50 milliseconds. |
| 5 | **Zero-Blackout Visual Continuity** | During channel transitions, a frosted-glass ambient aura with channel metadata replaces the traditional black screen. |
| 6 | **Web Audio API Volume Amplifier** | Sound Booster engine powered by the Web Audio API with `GainNode` (up to 300% amplification) and `DynamicsCompressorNode` (anti-clipping protection) for broadcast loudness normalization. |
| 7 | **Multi-URL Fallback Streams** | Each channel can carry multiple backup stream URLs. If the primary CDN goes down, the player automatically switches to the next healthy mirror within seconds. |
| 8 | **Stream Sentinel 3.0 Cloud Auditor** | A standalone Rust Tokio binary scans 10,000+ streams in parallel every 6 hours via GitHub Actions. Validates `#EXTM3U` headers and MPEG-TS `0x47` sync bytes. Dead feeds are purged automatically. |
| 9 | **SQLite Offline Channel Cache** | Parsed channel data is persisted to a local SQLite database (`%APPDATA%/MorningTV/morningtv.db`). The app launches instantly from cache even when offline. |
| 10 | **Minisign Cryptographic Signing** | Every release installer is digitally signed with a Minisign Ed25519 key. The auto-updater verifies signatures before applying patches. |
| 11 | **Single Instance Enforcement** | If MorningTV is already running and the user launches a second instance, the existing window is brought to focus instead of spawning a duplicate. |
| 12 | **Process Tree Terminator Hooks** | Custom NSIS installer hooks call `taskkill /F /T` to terminate the entire process tree (main binary, WebView2, GPU helpers, proxy threads) before file replacement during updates. |

<br/>

---

## 🔬 System Architecture Deep Dive

### High-Level System Topology

```
 ┌─────────────────────────────────────────────────────────────────────────────────────┐
 │                              MorningTV Desktop Application                          │
 │                                                                                     │
 │  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
 │  │                         PRESENTATION LAYER (WebView2)                          │ │
 │  │                                                                                │ │
 │  │   React 19 + TypeScript + Tailwind CSS v4 + Zustand State + hls.js Player      │ │
 │  │                                                                                │ │
 │  │   Components:                                                                  │ │
 │  │     VideoPlayer ─ AppleTVChannelShelf ─ AppleTVTopBar ─ AppleTVDock            │ │
 │  │     SettingsDialog ─ StreamQualityPopover ─ SoundBoosterControl                │ │
 │  │     YouTubeModal ─ UpdateModal ─ ShortcutsModal ─ ToastBanner                  │ │
 │  │     MorningTVLogo ─ AppleTVCard ─ AppleTVCardSkeleton                          │ │
 │  │                                                                                │ │
 │  │   Hooks: useBackgroundRefresh (6-hour silent playlist sync)                    │ │
 │  │   Utils: AudioBoosterManager (Web Audio API GainNode + DynamicsCompressor)     │ │
 │  │   Store: appStore.ts (Zustand with 25+ actions, favorites, search, settings)   │ │
 │  └───────────────────────────────┬─────────────────────────────────────────────────┘ │
 │                                  │ Tauri IPC invoke()                                │
 │  ┌───────────────────────────────▼─────────────────────────────────────────────────┐ │
 │  │                         NATIVE RUST BACKEND (Tauri v2)                         │ │
 │  │                                                                                │ │
 │  │   lib.rs ─ Application Bootstrap & Command Registration (17 IPC Commands)      │ │
 │  │   app.rs ─ Central AppState (channels, categories, search, favorites, cache)   │ │
 │  │   error.rs ─ Typed Error Hierarchy (AppError, PlaylistError, NetworkError,     │ │
 │  │              StorageError, ConfigError) with thiserror derive macros            │ │
 │  │                                                                                │ │
 │  │   Commands Module:                                                             │ │
 │  │     channels.rs ─ get_channels, select_channel, toggle_favorite, search,       │ │
 │  │                   force_refresh, background_refresh, check_playlist_update      │ │
 │  │     settings.rs ─ get_settings, save_settings                                  │ │
 │  │     telemetry.rs ─ OS-level network stats via sysinfo (RX/TX bytes/sec)        │ │
 │  │     youtube.rs ─ YouTube TV & Hotstar integration commands                     │ │
 │  │                                                                                │ │
 │  │   Playlist Module:                                                             │ │
 │  │     parser.rs ─ Streaming M3U parser with fallback URL support                 │ │
 │  │     fetcher.rs ─ Remote playlist downloader with retry logic                   │ │
 │  │     filter.rs ─ Category and search query channel filtering                    │ │
 │  │                                                                                │ │
 │  │   Domain Module:                                                               │ │
 │  │     channel.rs ─ Channel entity (ID, name, logo, group, URLs, provider)        │ │
 │  │     quality.rs ─ QualityTier enum (Auto, 360p, 480p, 720p, 1080p)              │ │
 │  │                                                                                │ │
 │  │   Storage Module (SQLite via rusqlite):                                        │ │
 │  │     db.rs ─ Database connection, migration runner (3 tables, 2 indexes)        │ │
 │  │     channel_cache.rs ─ Bulk save/load with 6-hour TTL freshness check          │ │
 │  │     favorites.rs ─ Persistent favorite channel toggle                          │ │
 │  │     history.rs ─ Recently played channel tracking                              │ │
 │  │                                                                                │ │
 │  │   Config Module:                                                               │ │
 │  │     defaults.rs ─ App constants (name, version, playlist URL, buffer sizes)    │ │
 │  │     settings.rs ─ JSON-serialized user preferences (%APPDATA%/MorningTV/)      │ │
 │  │                                                                                │ │
 │  │   Network Module:                                                              │ │
 │  │     client.rs ─ ResilientHttpClient with exponential backoff retry             │ │
 │  │     proxy.rs ─ Axum streaming proxy (590 lines of battle-tested proxy code)    │ │
 │  └───────────────────────────────┬─────────────────────────────────────────────────┘ │
 │                                  │ Loopback HTTP (127.0.0.1:18181)                   │
 │  ┌───────────────────────────────▼─────────────────────────────────────────────────┐ │
 │  │                   IN-PROCESS AXUM STREAMING PROXY SERVER                       │ │
 │  │                                                                                │ │
 │  │   Routes:                                                                      │ │
 │  │     GET /stream?url={encoded} ─ Proxied stream with header injection           │ │
 │  │     GET /prewarm?url={encoded} ─ Non-blocking background RAM pre-fetch         │ │
 │  │     GET /return_to_morningtv ─ Health check / return endpoint                  │ │
 │  │                                                                                │ │
 │  │   Features:                                                                    │ │
 │  │     In-memory CachedItem store (HashMap<String, CachedItem>)                   │ │
 │  │     Manifest TTL: 4 seconds | Segment TTL: 30 seconds                          │ │
 │  │     Auto-eviction when cache exceeds 35 entries                                │ │
 │  │     M3U8 URL rewriting (relative paths to absolute proxy-routed URLs)          │ │
 │  │     301/302 redirect following with final URL tracking                         │ │
 │  │     Connection pool: 40 idle connections per host with TCP keepalive            │ │
 │  │     Full CORS permissive layer via tower-http                                  │ │
 │  └───────────────────────────────┬─────────────────────────────────────────────────┘ │
 └──────────────────────────────────┼──────────────────────────────────────────────────┘
                                    │ Outbound HTTPS (TLS 1.3 via rustls)
                                    ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────┐
 │                       EXTERNAL BROADCAST INFRASTRUCTURE                             │
 │                                                                                     │
 │   Akamai CDN ─ CloudFront ─ Cloudflare ─ Fastly ─ Samsung TV Plus ─ Pluto TV       │
 │   Free-TV Project ─ IPTV-Org ─ Public Domain FTA Broadcasters                      │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

<br/>

### Tauri IPC Command Reference

The frontend communicates with the Rust backend through 17 registered IPC commands:

| Command | Module | Purpose |
| :--- | :--- | :--- |
| `get_channels` | channels.rs | Returns the current filtered channel list |
| `get_total_channel_count` | channels.rs | Returns total count of all loaded channels |
| `get_categories` | channels.rs | Returns extracted category/group list |
| `select_channel` | channels.rs | Sets active channel and records play history |
| `toggle_favorite` | channels.rs | Adds or removes a channel from favorites |
| `set_category` | channels.rs | Filters channels by selected category group |
| `search_channels` | channels.rs | Full-text search across channel names and groups |
| `load_playlist` | channels.rs | Loads channels from a remote or local M3U source |
| `reset_playlist` | channels.rs | Resets to the default GitHub-hosted master playlist |
| `force_refresh_channels` | channels.rs | Force-fetches fresh data bypassing SQLite cache |
| `check_playlist_update` | channels.rs | Checks status.json for remote playlist updates |
| `background_refresh_playlist` | channels.rs | Silent background re-sync without UI interruption |
| `get_settings` | settings.rs | Returns current user preferences from disk |
| `save_settings` | settings.rs | Persists updated settings to JSON config file |
| `cycle_quality` | channels.rs | Cycles through quality tiers (Auto, 360p, 480p, 720p, 1080p) |
| `get_system_network_stats` | telemetry.rs | Returns live OS-level network RX/TX throughput |
| `open_youtube` / `open_hotstar` | youtube.rs | Launches embedded YouTube TV or Hotstar sessions |

<br/>

### SQLite Database Schema

MorningTV persists data in `%APPDATA%/MorningTV/morningtv.db` with the following schema:

```sql
-- Favorite channels (persisted across sessions)
CREATE TABLE favorites (
    channel_id   TEXT PRIMARY KEY,
    channel_name TEXT NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Recently played channels
CREATE TABLE history (
    channel_id   TEXT PRIMARY KEY,
    channel_name TEXT NOT NULL,
    channel_url  TEXT NOT NULL,
    last_played  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full channel cache with TTL freshness (6 hours)
CREATE TABLE channels_cache (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    group_title TEXT    NOT NULL DEFAULT 'General',
    logo        TEXT,
    fallbacks   TEXT    NOT NULL DEFAULT '[]',
    provider    TEXT,
    cached_at   INTEGER NOT NULL
);

CREATE INDEX idx_cache_group ON channels_cache(group_title);
CREATE INDEX idx_cache_time  ON channels_cache(cached_at);
```

<br/>

### Zustand Global State Store

The frontend state is managed by a single Zustand store ([`appStore.ts`](src/stores/appStore.ts)) exposing 25+ reactive actions:

| Action Group | Key Methods |
| :--- | :--- |
| **Initialization** | `init()`, `loadChannels()`, `loadSettings()` |
| **Channel Navigation** | `selectChannel()`, `nextChannel()`, `prevChannel()` |
| **Search & Filter** | `searchChannels()`, `setCategory()`, `resetPlaylist()` |
| **Favorites** | `toggleFavorite()` |
| **Playback Control** | `setVolume()`, `toggleMute()`, `setIsPlaying()` |
| **Quality** | `cycleQuality()`, `setPreferredQuality()` |
| **UI State** | `showToast()`, `setSettingsOpen()`, `setShortcutsOpen()` |
| **Updates** | `checkForUpdates()`, `installUpdate()` |
| **Telemetry** | `fetchNetworkStats()` |

<br/>

### M3U Playlist Parser

The native Rust parser ([`parser.rs`](src-tauri/src/playlist/parser.rs)) handles extended M3U with full attribute extraction:

| Parsed Directive | Extracted Data |
| :--- | :--- |
| `#EXTINF:` | Channel name, `tvg-logo`, `tvg-id`, `group-title`, `provider` |
| `#EXTVLCOPT:http-user-agent=` | Custom User-Agent header for CDN authentication |
| `#EXTVLCOPT:http-referrer=` | Custom Referer header for CDN validation |
| `#EXTFALLBACK:` / `#EXT-X-FALLBACK:` | Backup stream URLs for automatic failover |

Duplicate channels (same name) are automatically merged: the first URL becomes the primary, subsequent URLs become fallback mirrors.

<br/>

### Web Audio API Sound Engine

The [`AudioBoosterManager`](src/utils/audioBooster.ts) creates a real-time audio processing pipeline:

```
Video Element ──► MediaElementAudioSourceNode
                       │
                       ▼
                  GainNode (0.0x to 3.0x amplification)
                       │
                       ▼
               DynamicsCompressorNode
                 Threshold: -18 dB (default) / -12 dB (normalized)
                 Knee: 12 dB / 8 dB
                 Ratio: 4:1 / 4.5:1
                 Attack: 3 ms
                 Release: 250 ms / 200 ms
                       │
                       ▼
                AudioContext.destination (Speakers)
```

Two operating modes:
1. **Default mode:** Anti-distortion limiter prevents harsh clipping when Sound Booster exceeds 100%.
2. **Broadcast normalization mode:** Smooths out loudness differences between channels (varying broadcast standards across international feeds).

<br/>

### Error Type Hierarchy

MorningTV uses a typed error system built with `thiserror` derive macros:

```
AppError (top-level)
 ├── PlaylistError
 │    ├── InvalidFormat
 │    ├── HeaderMissing
 │    ├── DownloadFailed(String)
 │    ├── FileNotFound(String)
 │    └── ChannelNotFound(String)
 ├── NetworkError
 │    ├── RequestFailed(reqwest::Error)
 │    ├── Timeout(u64)
 │    ├── Unreachable(String)
 │    └── BufferUnderrun
 ├── StorageError
 │    ├── Sqlite(rusqlite::Error)
 │    ├── MigrationFailed(String)
 │    └── Serialization(serde_json::Error)
 ├── ConfigError
 │    ├── ReadFailed(String)
 │    ├── WriteFailed(String)
 │    └── InvalidValue(String)
 ├── Ui(String)
 └── Io(std::io::Error)
```

<br/>

### Stream Sentinel 3.0 Cloud Pipeline

The Sentinel is a standalone Rust binary ([`crates/sentinel/`](crates/sentinel/)) that runs in GitHub Actions every 6 hours:

```
[28 Upstream Public Feed Providers]
  IPTV-Org (India, Bengali, Hindi, Bangladesh, International)
  Samsung TV Plus (India, US, UK, Germany, Brazil, Italy)
  Pluto TV (US, UK, Italy)
  Plex FAST ─ Tubi ─ Free-TV Project ─ PBS
           │
           ▼
[GitHub Actions Runner (ubuntu-latest)]
  Rust 1.77+ compiled release binary
  120 concurrent Tokio worker semaphore
           │
           ▼
[Deep Byte-Level Probe Engine]
  1. HTTP Range Request: bytes=0-1024
  2. Header Validation: #EXTM3U present?
  3. MPEG-TS Sync Byte: 0x47 found in payload?
  4. HTML Fake Page Detection: rejects Cloudflare challenge screens
  5. 301/302 Redirect Resolution: follows to final working endpoint
           │
           ▼
[Category Routing & Deduplication]
  News ─ Entertainment ─ Sports ─ Movies ─ Music ─ Kids ─ India
           │
           ▼
[Output 7 Clean .m3u Playlists + status.json]
  Auto-committed & pushed to GitHub by MorningTV Sentinel Bot
```

<br/>

---

## ⌨️ Keyboard Shortcuts

| Key | Function |
| :---: | :--- |
| <kbd>Space</kbd> / <kbd>K</kbd> | Play or pause the live stream |
| <kbd>M</kbd> | Toggle audio mute |
| <kbd>F</kbd> / <kbd>F11</kbd> | Toggle full screen playback |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Increase or decrease volume level |
| <kbd>→</kbd> / <kbd>←</kbd> | Switch to the next or previous channel |
| <kbd>S</kbd> | Open the quick channel search overlay |
| <kbd>Esc</kbd> | Exit full screen, close dialogs, or cancel search |

<br/>

---

## 🚀 Installation

### Standard Installation
1. Open the [Official GitHub Releases](https://github.com/morningstarwebd/morningtv/releases/latest) page.
2. Download `MorningTV_1.0.0_x64-setup.exe` (~209 MB).
3. Run the installer. The embedded WebView2 runtime installs automatically on machines that lack it. No internet connection is required.

### Silent / Automated Enterprise Deployment
```powershell
.\MorningTV_1.0.0_x64-setup.exe /S
```

### Auto-Updates
MorningTV checks for updates 3 seconds after launch. When a new version is available, a native update dialog presents the option to download and install. All updates are cryptographically verified using Minisign Ed25519 signatures before execution.

<br/>

---

## 🛠️ Building from Source

### Prerequisites
* Windows 10 or Windows 11 (64-bit)
* Node.js 20 or higher
* Rust 1.77.2 or higher (install via [rustup.rs](https://rustup.rs))
* Visual Studio Build Tools with the **Desktop development with C++** workload

### Development Build

```powershell
# 1. Clone the repository
git clone https://github.com/morningstarwebd/morningtv.git
cd morningtv

# 2. Install frontend dependencies
npm install

# 3. Launch the live development environment (hot-reload frontend + native Rust backend)
npm run tauri:dev

# 4. Run code quality validation
npm run lint            # ESLint + Biome check
npm run cargo:check     # Rust compiler diagnostics
```

### Production Release Build

```powershell
# Build the signed NSIS installer with embedded WebView2 and publish to GitHub Releases
npm run release
```

This single command performs the full pipeline:
1. TypeScript type checking (`tsc -b`)
2. Vite production bundle (`vite build`)
3. Rust release compilation (`cargo build --release`)
4. NSIS installer packaging with offline WebView2 embedding
5. Minisign cryptographic signature generation
6. `latest.json` auto-updater manifest creation
7. Git commit, tag, and push to origin
8. GitHub Release publication with all artifacts

### Running the Stream Sentinel Locally

```powershell
# Run the Rust Tokio multi-threaded stream auditor
npm run sync

# Alternatively, the legacy Node.js auditor (slower, but functional)
npm run sync:node
```

<br/>

---

## 📁 Project Structure

```
morningtv/
├── src/                              # Frontend (React 19 + TypeScript)
│   ├── App.tsx                       # Root component with Apple TV layout composition
│   ├── main.tsx                      # React DOM entry point
│   ├── index.css                     # Tailwind v4 base styles
│   ├── components/
│   │   ├── VideoPlayer.tsx           # HLS.js video engine with adaptive buffering (1,105 lines)
│   │   ├── AppleTVChannelShelf.tsx   # Horizontal scrollable channel browser (shelf UI)
│   │   ├── AppleTVTopBar.tsx         # Top navigation bar with search and category tabs
│   │   ├── AppleTVDock.tsx           # Bottom floating control dock
│   │   ├── AppleTVCard.tsx           # Individual channel card with hover effects
│   │   ├── AppleTVCardSkeleton.tsx   # Loading skeleton placeholder
│   │   ├── SettingsDialog.tsx        # Full settings panel (864 lines, 6 tabs)
│   │   ├── StreamQualityPopover.tsx  # Real-time stream HUD with network telemetry
│   │   ├── SoundBoosterControl.tsx   # Volume amplification slider (0-300%)
│   │   ├── YouTubeModal.tsx          # Embedded YouTube TV player
│   │   ├── UpdateModal.tsx           # Native software update dialog
│   │   ├── ShortcutsModal.tsx        # Keyboard shortcuts reference
│   │   ├── ToastBanner.tsx           # Floating notification system
│   │   └── MorningTVLogo.tsx         # Inline SVG brand logo component
│   ├── hooks/
│   │   └── useBackgroundRefresh.ts   # 6-hour silent playlist sync hook
│   ├── stores/
│   │   └── appStore.ts              # Zustand global state (25,000 bytes, 25+ actions)
│   ├── services/
│   │   └── updaterService.ts        # Tauri plugin-updater integration
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces mirroring Rust domain
│   └── utils/
│       ├── audioBooster.ts          # Web Audio API volume engine (up to 300%)
│       └── speedFormatter.ts        # Network throughput formatting utility
│
├── src-tauri/                        # Native Rust Backend (Tauri v2)
│   ├── Cargo.toml                    # Rust dependencies (16 crates)
│   ├── tauri.conf.json               # Window config, NSIS, offline WebView2, updater
│   └── src/
│       ├── main.rs                   # Rust binary entry point
│       ├── lib.rs                    # Tauri app builder with 17 IPC commands
│       ├── app.rs                    # Central AppState coordinator
│       ├── error.rs                  # Typed error hierarchy (5 error enums)
│       ├── config/
│       │   ├── defaults.rs           # App constants and version
│       │   └── settings.rs           # JSON-serialized user preferences
│       ├── domain/
│       │   ├── channel.rs            # Channel entity with FNV-1a ID generation
│       │   └── quality.rs            # QualityTier enum (Auto through 1080p)
│       ├── network/
│       │   ├── client.rs             # Resilient HTTP client with exponential backoff
│       │   └── proxy.rs              # Axum streaming proxy server (590 lines)
│       ├── playlist/
│       │   ├── parser.rs             # M3U parser with fallback URL merging
│       │   ├── fetcher.rs            # Remote playlist downloader
│       │   └── filter.rs             # Category and search filtering engine
│       └── storage/
│           ├── db.rs                 # SQLite connection and schema migrations
│           ├── channel_cache.rs      # Bulk channel cache with TTL
│           ├── favorites.rs          # Favorite channel persistence
│           └── history.rs            # Play history recorder
│
├── crates/sentinel/                  # Standalone Rust Stream Auditor
│   ├── Cargo.toml                    # Sentinel-specific dependencies
│   └── src/main.rs                   # 745-line Tokio multi-threaded probe engine
│
├── scripts/
│   ├── one-click-release.js          # Automated 9-step release pipeline
│   ├── build-installer.js            # NSIS packaging helper
│   ├── sync_and_heal.mjs            # Legacy Node.js stream auditor (backup)
│   ├── morningtv.key                 # Minisign Ed25519 private signing key
│   └── morningtv.key.pub            # Minisign public verification key
│
├── assets/
│   ├── morningtv-installer.nsi       # Custom NSIS installer template (437 lines)
│   ├── installer-hooks.nsh           # Process tree terminator hooks
│   └── LICENSE.txt                   # Installer license display
│
├── playlists/                        # Auto-healed verified M3U playlists
│   ├── morningtv_all.m3u             # Master index
│   ├── morningtv_news.m3u
│   ├── morningtv_entertainment.m3u
│   ├── morningtv_sports.m3u
│   ├── morningtv_movies.m3u
│   ├── morningtv_music.m3u
│   ├── morningtv_kids.m3u
│   ├── morningtv_india.m3u
│   └── status.json                  # Playlist freshness metadata
│
├── .github/workflows/
│   └── sentinel.yml                  # GitHub Actions cron (every 6 hours)
│
├── latest.json                       # Auto-updater manifest (version, signature, URL)
├── RELEASE_NOTES.md                  # Current release changelog
├── DISCLAIMER.md                     # Legal and DMCA compliance notice
├── LICENSE                           # MIT License
├── vite.config.ts                    # Vite + React + Tailwind CSS v4 configuration
├── biome.json                        # Biome linter and formatter rules
├── eslint.config.js                  # ESLint flat config with React Hooks rules
├── tsconfig.json                     # TypeScript project references
└── package.json                      # npm scripts and dependency manifest
```

<br/>

---

## 🔧 Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :---: | :--- |
| **Runtime** | Rust | 1.77+ | Native backend binary, streaming proxy, and Sentinel auditor |
| **Async Engine** | Tokio | 1.40 | Multi-threaded async runtime for proxy, pre-warming, and background tasks |
| **HTTP Server** | Axum | 0.7 | In-process streaming proxy with routing, state, and middleware |
| **HTTP Client** | reqwest | 0.12 | TLS connections with rustls, connection pooling, and gzip support |
| **Database** | rusqlite | 0.31 | Embedded SQLite with bundled C library (zero system dependency) |
| **Desktop Framework** | Tauri | 2.12 | Native window management, IPC, updater, process lifecycle |
| **Frontend** | React | 19.3 | Component-based UI with hooks and concurrent rendering |
| **State Management** | Zustand | 5.0 | Lightweight reactive state with selector subscriptions |
| **Video Player** | hls.js | 1.7 | Adaptive HLS playback with quality level switching |
| **Styling** | Tailwind CSS | 4.3 | Utility-first CSS with JIT compilation |
| **Bundler** | Vite | 8.3 | Lightning fast development server and production bundler |
| **Type System** | TypeScript | 6.0 | End-to-end type safety across the frontend codebase |
| **Linting** | ESLint + Biome | 10.x / 2.x | Code quality enforcement with zero-config formatting |
| **Serialization** | serde + serde_json | 1.0 | Rust/TypeScript data interchange via JSON |
| **Error Handling** | thiserror | 1.0 | Derive macros for typed error enum hierarchies |
| **Logging** | tauri-plugin-log | 2.x | Structured application logging with level filtering |
| **Auto-Updater** | tauri-plugin-updater | 2.13 | Signed binary delta updates from GitHub Releases |
| **Signing** | Minisign | Ed25519 | Cryptographic release artifact verification |
| **CI/CD** | GitHub Actions | N/A | Automated Sentinel runs and playlist maintenance |
| **Installer** | NSIS | 3.x | Windows installer with offline WebView2 embedding |
| **Icons** | Lucide React | 1.47 | Consistent open-source SVG icon library |

<br/>

---

## 🤝 Contributing

Contributions are welcomed from developers of all experience levels:

1. **Fork** the repository on GitHub.
2. **Create** a feature branch: `git checkout -b feature/stream-enhancement`.
3. **Validate** code quality: `npm run ci` (runs linting, unit tests, frontend build, and cargo check).
4. **Commit** with a clear message: `git commit -m "feat: add multi-bitrate quality selector"`.
5. **Push** to your fork: `git push origin feature/stream-enhancement`.
6. **Open** a Pull Request on GitHub using our [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).

For complete contributor guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). For security reports, refer to [SECURITY.md](SECURITY.md). For version history, see [CHANGELOG.md](CHANGELOG.md).

### Development Tips
* Frontend hot-reload is active during `npm run tauri:dev`. TypeScript and CSS changes reflect instantly.
* Rust backend changes require a recompile (Tauri handles this automatically in dev mode).
* Run `npm run sync` to test the Stream Sentinel locally before pushing playlist changes.
* Run `npm test` to execute all 54 frontend and Rust tests.
* The Biome formatter enforces consistent code style. Run `npx biome check --write src` to auto-fix.

<br/>

---

## 📜 License

```
MIT License

Copyright (c) 2026 MorningTV Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

<br/>

---

## ⚖️ Legal Notice & DMCA Compliance

MorningTV is an open-source media player and public stream indexer. The software does **not** host, store, broadcast, or retransmit any video, audio, or media content.

* All playlist entries point exclusively to publicly accessible third-party streams.
* Channel names, logos, and trademarks belong to their respective copyright holders and are used under nominative fair use for identification only.
* MorningTV complies with the **Digital Millennium Copyright Act (DMCA)**. If you are a copyright holder and believe a link infringes your rights, please open an **Issue** or submit a **Pull Request** identifying the specific URL. The entry will be reviewed and removed within 24 hours.

Full details: [DISCLAIMER.md](DISCLAIMER.md)

<br/>

---

<div align="center">

**MorningTV** is built with precision engineering for open-source live streaming.

[![Star on GitHub](https://img.shields.io/github/stars/morningstarwebd/morningtv?style=social)](https://github.com/morningstarwebd/morningtv)

</div>
