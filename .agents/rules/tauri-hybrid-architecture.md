# Tauri Hybrid Architecture & Performance Guidelines

## Core Principles

### 1. Clear Division of Responsibility
- **Rust Core:**
  - OS-level APIs (Network Interface Cards telemetry, process management, file system).
  - Background HTTP services & streaming proxies (CORS bypass, header spoofing, manifest rewriting).
  - Persistent relational caching (SQLite with WAL mode and PRAGMA tuning).
  - High-performance parsing of massive raw datasets (>2MB manifests).
- **Frontend (React / TypeScript):**
  - Instant UI rendering, debounced inputs, reactive UI state.
  - In-memory search & category filtering for datasets that fit comfortably in browser memory (<50,000 items / <10MB).
  - Video playback orchestration and adaptive bitrate (Hls.js internal ABR).

### 2. Zero IPC Churn Rule
- **Never** send high-frequency user actions (every keystroke in search inputs, rapid category tab switches) across the Tauri IPC bridge if the full dataset is already available in frontend memory.
- Load the master dataset once at startup into memory/Zustand store from SQLite, and perform synchronous, zero-latency filtering in JavaScript.
- Reserve Tauri IPC `invoke` calls for:
  - Initial database loading / refreshing.
  - User mutations that require disk persistence (toggle favorite, save settings).
  - Background polling or periodic telemetry ticks.

### 3. Binary & Dependency Hygiene
- **Never** keep dead third-party DLLs or binaries in the project repository (e.g., legacy MPV or ffmpeg binaries) if the player architecture has switched to Webview/HLS.
- Regularly audit `Cargo.toml` and remove unused crates to keep compile times fast and release binaries slim.
- Clean out orphaned error types and unreferenced command handlers.
