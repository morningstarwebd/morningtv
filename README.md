<div align="center">

# 🌅 MorningTV

### High Performance Native Windows Live TV Player & Cloud Stream Sentinel

<br/>

[![Release](https://img.shields.io/badge/Official_Release-v1.0.0-00E676?style=for-the-badge&logo=github&logoColor=black)](https://github.com/morningstarwebd/morningtv/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows_10_|_11-00B0FF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/morningstarwebd/morningtv/releases/latest)
[![Engine](https://img.shields.io/badge/Streaming_Engine-Rust_+_Tokio-FF6D00?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Framework](https://img.shields.io/badge/GUI_Framework-Tauri_v2-7C4DFF?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![License](https://img.shields.io/badge/License-MIT-FFD600?style=for-the-badge&logoColor=black)](LICENSE)

<br/>

MorningTV is a dedicated desktop application engineered from the ground up for butter smooth, zero-blackout live television on Windows. Built with an in-process Rust Tokio Axum streaming proxy, YouTube-style dynamic adaptive buffering, predictive RAM pre-warming, and a cloud-native stream auditor that purges dead feeds every 12 hours.

<br/>

[📥 Download Windows Setup (Offline Embedded)](https://github.com/morningstarwebd/morningtv/releases/latest) • [📋 One-Click Copy Playlists](#-one-click-copy-playlists) • [🔬 Deep Architecture](#-deep-architectural-analysis) • [⌨️ Keyboard Controls](#-keyboard-shortcuts)

</div>

<br/>

---

## 📋 One-Click Copy Playlists

Every link below is hosted directly on GitHub Enterprise CDN. Hover over any code box below and click the **Copy** button on the top right to paste directly into MorningTV, VLC Media Player, Kodi, TiviMate, or any IPTV app.

### 🌐 1. Master Index (All Verified Channels)
Complete collection of news, movies, sports, entertainment, and regional streams:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u
```

### 📰 2. News & World Information
Live 24/7 global coverage, international headlines, business, and weather:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_news.m3u
```

### 🎬 3. Movies & Entertainment
Full HD movies, drama series, classic cinema, and lifestyle television:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_entertainment.m3u
```

### ⚽ 4. Sports & Live Events
Motorsports, live stadium broadcasts, combat sports, and tournament feeds:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_sports.m3u
```

### 👶 5. Kids & Animation
Safe, family-friendly cartoons, educational broadcasts, and animated features:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_kids.m3u
```

### 🇮🇳 6. India & Regional Broadcasters
Hindi, Bengali, and regional South Asian public broadcasts:
```text
https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_india.m3u
```

<br/>

---

## 💎 Key Capabilities at a Glance

```
╔═══════════════════════════════════════════════════════════════════════════════════════════╗
║                                   MORNINGTV CAPABILITIES                                  ║
╠═══════════════════════════════════════════════════════════════════════════════════════════╣
║  [1] 100% Offline Embedded Installer  │ Setup runs with zero internet requirement         ║
║  [2] In-Process Rust Axum Proxy       │ Bypasses CORS & rewrites stream headers in RAM    ║
║  [3] Dynamic Adaptive Buffering       │ Up to 30s forward buffer cushion for zero stutters║
║  [4] Predictive RAM Pre-Warming       │ Sub-50ms instant channel zapping                  ║
║  [5] Zero-Blackout Visual Continuity  │ Frosted ambient aura eliminates blank transitions ║
║  [6] Stream Sentinel 3.0 Cloud Engine │ Byte-level MPEG-TS sync validation every 12 hours ║
║  [7] Process Tree Cleanup Hooks       │ Taskkill /F /T eliminates Windows file-lock errors║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝
```

<br/>

---

## 🔬 Deep Architectural Analysis

### 1. The Core Engineering Challenge of Live TV on Desktop
Standard web applications and Electron wrappers suffer from three fatal flaws when playing live HLS streams on Windows:
1. **CORS Restrictions:** Upstream television CDNs frequently reject browser requests that originate from desktop web views without origin clearance.
2. **Missing Header Spoofing:** Many legal Free-To-Air streams require specific `User-Agent` and `Referer` headers matching native set-top boxes, which web browsers cannot inject due to browser sandbox security policies.
3. **Buffer Starvation:** Standard video players maintain a rigid 3-5 second buffer. Any minor packet drop or ISP route switch results in immediate video freeze.

MorningTV completely eliminates these limitations through a layered native Rust engine:

```
                            ┌────────────────────────────────────────┐
                            │       MorningTV Windows Frontend       │
                            │   React 19 + TypeScript + Tailwind v4  │
                            └───────────────────┬────────────────────┘
                                                │
                                 HLS Media Flow │ IPC State Sync
                                                ▼
                            ┌────────────────────────────────────────┐
                            │      Tauri v2 Native Rust Backend      │
                            │   Channel DB (SQLite) + App Config     │
                            └───────────────────┬────────────────────┘
                                                │
                                  Loopback HTTP │ 127.0.0.1:RandomPort
                                                ▼
                            ┌────────────────────────────────────────┐
                            │      In-Process Axum Stream Proxy      │
                            │  Chunk Ring-Buffer • Dynamic Headers   │
                            └───────────────────┬────────────────────┘
                                                │
                                 High-Speed TLS │ Streaming Chunks
                                                ▼
                            ┌────────────────────────────────────────┐
                            │      Remote CDN & Upstream Feeds       │
                            │   Akamai • Cloudflare • Fastly Feeds   │
                            └────────────────────────────────────────┘
```

<br/>

### 2. In-Process Tokio Axum Stream Proxy
MorningTV embeds an asynchronous Axum HTTP service directly within the compiled desktop executable:
* **Ephemeral Port Binding:** On application launch, the proxy binds to an available random loopback port on `127.0.0.1`.
* **Header Manipulation Engine:** When the frontend requests a stream via `http://127.0.0.1:{port}/proxy?url={encoded_stream}`, the proxy intercepts the request. It dynamically injects legitimate broadcast headers (such as `User-Agent: Mozilla/5.0` and authentic `Referer` values) before sending the request out to upstream CDNs.
* **CORS Elimination:** The proxy answers the frontend with `Access-Control-Allow-Origin: *`, allowing the presentation layer to render streams with zero security exceptions.
* **In-Memory Ring Buffer:** Video transport segments (`.ts` and `.aac` chunks) are held in a circular RAM cache, providing zero-latency replay and instantaneous scrubbing.

<br/>

### 3. YouTube-Style Dynamic Adaptive Buffering
Standard video players lock themselves to a small, static cache window. MorningTV implements an intelligent dynamic buffering algorithm that mimics YouTube:
* **Initial Burst Phase:** On channel tuning, the buffer target is set to 5 seconds. This guarantees that video and audio start rendering within a fraction of a second.
* **Expansion Phase:** Once continuous playback is established and the network condition is verified, the buffer cushion automatically expands up to 30 seconds into the future.
* **Jitter Absorption Curve:** Temporary Wi-Fi packet drops, cellular fluctuations, or ISP routing latency spikes are absorbed by the 30-second buffer pool. The viewer experiences completely uninterrupted playback with zero spinning wheels.
* **Live Edge Management:** The player monitors the live stream edge. If latency drifts beyond the safe threshold, the playback rate subtly adjusts to realign without noticeable pitch distortion.

<br/>

### 4. Predictive RAM Pre-Warming
When a user watches television, they typically browse sequentially through channels (Channel Up or Channel Down).
* **Background Worker Thread:** While channel $N$ is playing, MorningTV's background Tokio thread quietly connects to channel $N-1$ and channel $N+1$.
* **Manifest & Initial Keyframe Cache:** The master `.m3u8` playlist and the first video segment are pre-fetched and held in RAM.
* **Instantaneous Zapping:** When the user presses the arrow key to switch channels, the player does not need to perform DNS resolution, TLS handshakes, or manifest downloads. The video starts playing instantly from local memory in under 50 milliseconds.

<br/>

### 5. Zero-Blackout Visual Continuity
Switching channels on typical IPTV software leaves the viewer staring at a cold, dead black screen for several seconds. MorningTV solves this with visual continuity:
* **Ambient Frosted Aura:** During channel switching, the previous frame softly dissolves into an ambient frosted glass aura rendered in the channel's dominant color palette.
* **Identity Overlay:** The channel logo, program title, and broadcast metadata appear immediately with smooth micro-animations.
* **Seamless Crossfade:** The moment the new stream's first frame is decoded in RAM, it smoothly crossfades into full view. The transition feels seamless, modern, and cinematic.

<br/>

### 6. Automated Cloud Stream Sentinel 3.0
Stream rot is the single biggest problem with online IPTV. Feeds change domains, CDNs expire tokens, and servers shut down. MorningTV maintains verified playlists via an automated cloud pipeline:

```
[Upstream Public Feeds] (Free-TV, Curated IPTV-Org, FAST Networks)
           │
           ▼
[GitHub Actions Cloud Runner] (Runs every 12 Hours)
           │
           ▼
[Deep Stream Sentinel 3.0 Engine (Rust Tokio)]
   ├── Tests Range: bytes=0-1024
   ├── Inspects MPEG-TS 0x47 Sync Byte & #EXTM3U Headers
   ├── Purges 404/Cloudflare/HTML Fake Error Pages
   └── Follows & Saves 301/302 Permanent Redirects
           │
           ▼
[Output Clean Master Playlists]
   └── Auto-Committed & Pushed to GitHub
           │
           ▼
[Instant Verified Playback on MorningTV / VLC]
```

* **Deep Byte Inspection:** Sentinel sends `Range: bytes=0-1024` requests to inspect the raw stream header. A stream is only marked alive if it returns valid `#EXTM3U` content or true MPEG-TS sync bytes (`0x47`). Fake `200 OK` HTML error pages (such as Cloudflare challenge screens) are detected and purged.
* **Parallel Tokio Pipeline:** The auditor scans thousands of streams concurrently in 30 to 45 seconds using native Rust asynchronous worker pools.
* **Self-Healing Redirection:** When streams migrate to new CDNs (301 or 302 redirects), Sentinel automatically records the destination endpoint, saving the working stream to the master repository.

<br/>

### 7. Process Tree Terminator & Offline Embedded Packaging
* **100% Offline WebView2 Runtime:** The setup executable (`MorningTV_1.0.0_x64-setup.exe`, ~209 MB) embeds the entire Microsoft Edge WebView2 runtime installer inside the NSIS archive. Machines without an active internet connection can install and run MorningTV out of the box with zero additional downloads.
* **Process Tree Terminator Hooks:** Windows software often encounters "Error opening file for writing" during upgrades because background processes hold file locks. MorningTV's installer executes a specialized kernel command (`taskkill /F /T`) that terminates the main executable, WebView2 renderer processes, GPU helpers, and local proxy threads cleanly before copying new files.

<br/>

---

## ⌨️ Keyboard Shortcuts

MorningTV is fully controllable with a keyboard or home theater remote:

| Control Key | Function |
| :---: | :--- |
| <kbd> SPACE </kbd> / <kbd> K </kbd> | Play or pause live stream |
| <kbd> M </kbd> | Toggle audio mute |
| <kbd> F </kbd> / <kbd> F11 </kbd> | Toggle full screen playback |
| <kbd> ↑ </kbd> / <kbd> ↓ </kbd> | Increase or decrease audio volume |
| <kbd> → </kbd> / <kbd> ← </kbd> | Next channel or previous channel |
| <kbd> S </kbd> | Open quick channel search bar |
| <kbd> ESC </kbd> | Exit full screen, close popups, or cancel search |

<br/>

---

## 🚀 Installation & Setup

### Standard Installation
1. Go to the [Official GitHub Releases Page](https://github.com/morningstarwebd/morningtv/releases/latest).
2. Download `MorningTV_1.0.0_x64-setup.exe`.
3. Launch the setup file. The installer completes in seconds without needing an internet connection.

### Silent / Automated Enterprise Deployment
To install MorningTV silently without interactive wizard prompts:
```powershell
.\MorningTV_1.0.0_x64-setup.exe /S
```

<br/>

---

## 🛠️ Building from Source

### Prerequisites
* Windows 10 or 11 (64-bit)
* Node.js 20 or higher
* Rust 1.77.2 or higher
* Visual Studio Build Tools with C++ desktop development workload

### Step by Step Build Process

```powershell
# 1. Clone the repository
git clone https://github.com/morningstarwebd/morningtv.git
cd morningtv

# 2. Install frontend dependencies
npm install

# 3. Launch live development desktop environment
npm run tauri:dev

# 4. Compile optimized release bundle with embedded WebView2
npm run release
```

<br/>

---

## 🤝 Contributing

Contributions to MorningTV are warmly welcomed by the open-source community:

1. Fork the repository on GitHub.
2. Create a clean feature branch: `git checkout -b feature/stream-enhancement`.
3. Verify that all code quality gates pass: `npm run lint` and `npm run cargo:check`.
4. Commit your changes: `git commit -m "Enhance stream proxy buffer allocation"`.
5. Push to your fork: `git push origin feature/stream-enhancement`.
6. Open a Pull Request on GitHub.

<br/>

---

## 📜 Legal & Compliance

MorningTV is an open-source media player and public indexer. The software does not host, store, or transmit any video, audio, or media content. All playlists index publicly available Free-To-Air (FTA) and authorized legal FAST broadcasts.

For questions, inquiries, or copyright notices, please review [DISCLAIMER.md](DISCLAIMER.md).

<br/>

---

<div align="center">

**MorningTV** is crafted with dedication for high-performance open-source streaming.

[![Star on GitHub](https://img.shields.io/github/stars/morningstarwebd/morningtv?style=social)](https://github.com/morningstarwebd/morningtv)

</div>
