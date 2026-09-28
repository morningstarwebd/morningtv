<div align="center">

# 🌅 MorningTV

### High Performance Native Windows Live TV Player & Cloud Stream Sentinel

[![Release](https://img.shields.io/badge/Release-v1.0.0-emerald?style=for-the-badge&logo=github)](https://github.com/morningstarwebd/morningtv/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-blue?style=for-the-badge&logo=windows)](https://github.com/morningstarwebd/morningtv/releases/latest)
[![Rust](https://img.shields.io/badge/Engine-Rust%20%2B%20Tokio-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Framework-Tauri%20v2-purple?style=for-the-badge&logo=tauri)](https://tauri.app)
[![License](https://img.shields.io/badge/License-MIT-amber?style=for-the-badge)](LICENSE)

<br/>

MorningTV is a lightweight, blazing fast Windows desktop application engineered for smooth, uninterrupted live television streaming. Powered by an in-process Rust Tokio proxy, dynamic adaptive buffering, predictive RAM pre-warming, and an automated cloud auditor that keeps stream playlists verified around the clock.

[Download MorningTV Installer](https://github.com/morningstarwebd/morningtv/releases/latest) • [Explore Playlists](#live-verified-playlists) • [Architecture](#core-architecture) • [Building from Source](#building-from-source)

</div>

<br/>

## Key Capabilities

### 100% Offline Embedded Installer
The Windows setup executable includes the full Microsoft Edge WebView2 runtime bundled directly inside the NSIS payload. You can install and launch MorningTV on completely offline machines or fresh Windows installations without downloading secondary components.

### In-Process Tokio Axum Stream Proxy
MorningTV hosts a local Axum HTTP streaming service running on an ephemeral loopback port. The proxy handles upstream authentication headers, circumvents browser CORS limitations, and buffers video chunks in memory before delivering them to the presentation layer.

### YouTube Style Dynamic Adaptive Buffering
Rather than locking the player into a small static buffer, MorningTV dynamically expands its forward buffer cushion from 5 seconds on startup up to 30 seconds during stable broadband playback. Temporary network jitter, packet drops, or transient Wi-Fi drops are absorbed effortlessly without video stutters.

### Predictive RAM Pre-Warming
When browsing channels, the background engine pre-fetches the master manifests and initial transport segments of neighboring channels into local memory. Switching to the next or previous channel feels immediate and seamless.

### Zero-Blackout Visual Continuity
Standard media players freeze or show a dead black frame while connecting to a new live stream. MorningTV displays an ambient frosted channel identity aura with metadata during stream initialization, preserving visual polish between channel switches.

### Automated Cloud Stream Sentinel 3.0
A specialized multi-threaded Tokio engine audits all upstream feeds in cloud runners every 12 hours. Streams undergo byte-level inspection to verify `#EXTM3U` headers and MPEG-TS sync bytes (`0x47`). Broken links and fake HTTP error pages are pruned automatically.

### Clean Process Tree Termination
Custom NSIS installer hooks execute Windows kernel process tree termination before installs and updates. This ensures background worker threads release file handles cleanly, eliminating annoying file lock alerts during upgrades.

<br/>

## Core Architecture

```
                    ┌────────────────────────────────────────┐
                    │       MorningTV Windows Frontend       │
                    │   React 19 + TypeScript + Tailwind v4  │
                    └───────────────────┬────────────────────┘
                                        │
                         HLS Media Flow │ IPC Commands
                                        ▼
                    ┌────────────────────────────────────────┐
                    │      Tauri v2 Native Rust Backend      │
                    │  SQLite Channel Cache + App State      │
                    └───────────────────┬────────────────────┘
                                        │
                          Loopback HTTP │ 127.0.0.1:RandomPort
                                        ▼
                    ┌────────────────────────────────────────┐
                    │      In-Process Axum Stream Proxy      │
                    │  Chunk Cache • Header Rewrite • Memory │
                    └───────────────────┬────────────────────┘
                                        │
                         High-Speed TLS │ Streaming Chunks
                                        ▼
                    ┌────────────────────────────────────────┐
                    │      Remote CDN & Upstream Feeds       │
                    │   FAST Feeds • Public Domain • News    │
                    └────────────────────────────────────────┘
```

<br/>

## Live Verified Playlists

MorningTV publishes auto-healed, 100% verified IPTV playlists ready for use in any compatible media player such as MorningTV Desktop, VLC, or Kodi.

| Channel Category | Coverage | Raw M3U Playlist URL |
| :--- | :--- | :--- |
| **Master Index (All Channels)** | Complete Collection | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u` |
| **News & World Information** | 24/7 International | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_news.m3u` |
| **Movies & Entertainment** | Cinema, Series, Drama | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_entertainment.m3u` |
| **Sports & Active Events** | Live Stadium Feeds | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_sports.m3u` |
| **Kids & Animation** | Family Friendly Content | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_kids.m3u` |
| **India & Regional** | Hindi, Bengali, Regional | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_india.m3u` |

<br/>

## Keyboard Shortcuts

Navigate MorningTV effortlessly using your keyboard or remote control:

| Key | Action |
| :--- | :--- |
| `Space` / `K` | Play or pause live stream |
| `M` | Toggle audio mute |
| `F` / `F11` | Toggle full screen mode |
| `Arrow Up` / `Arrow Down` | Adjust volume level |
| `Arrow Right` / `Arrow Left` | Switch to next or previous channel |
| `S` | Open channel search bar |
| `Escape` | Close dialogs, exit search, or return to player |

<br/>

## Installation

### Recommended Download
1. Head to the [Latest Releases Page](https://github.com/morningstarwebd/morningtv/releases/latest).
2. Download `MorningTV_1.0.0_x64-setup.exe`.
3. Run the installer. Because WebView2 is embedded, installation works without an internet connection.

### Silent / Enterprise Install
```powershell
# Silent installation for the current user
.\MorningTV_1.0.0_x64-setup.exe /S
```

<br/>

## Building from Source

### Prerequisites
* Windows 10 or 11 (64-bit)
* Node.js 20 or higher
* Rust 1.77.2 or higher
* Visual Studio Build Tools with C++ workload

### Step by Step Build

```powershell
# 1. Clone repository
git clone https://github.com/morningstarwebd/morningtv.git
cd morningtv

# 2. Install JavaScript dependencies
npm install

# 3. Run development desktop server
npm run tauri:dev

# 4. Compile production signed installer
npm run release
```

<br/>

## Running Stream Sentinel Locally

The Stream Sentinel engine can be executed independently to audit and sanitize your local playlist files:

```powershell
# Run the Rust Tokio Sentinel auditor
npm run sync
```

The auditor scans all configured upstream feeds concurrently, validates HLS video segments, and outputs freshly healed `.m3u` playlists into the `playlists/` directory.

<br/>

## Contributing

Contributions from the open source community are warmly welcome.

1. Fork the repository.
2. Create a dedicated feature branch: `git checkout -b feature/new-capability`.
3. Ensure formatting and diagnostics pass: `npm run lint` and `npm run cargo:check`.
4. Commit your changes: `git commit -m "Add new stream filtering capability"`.
5. Push to your branch: `git push origin feature/new-capability`.
6. Open a Pull Request on GitHub.

<br/>

## Legal & Compliance

MorningTV is an open source software player and media indexer. It does not host, broadcast, or retransmit copyrighted video files or media streams. All playlists point strictly to publicly accessible, Free-To-Air (FTA), and authorized FAST television broadcasts.

For questions or inquiries regarding upstream content, refer to [DISCLAIMER.md](DISCLAIMER.md).

<br/>

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for complete details.
