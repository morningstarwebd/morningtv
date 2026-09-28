# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-28

### Added
- **Native Windows Live TV Player**: High-performance IPTV desktop player built with Tauri v2, Rust, and React 19.
- **Apple TV & Google TV UX**: Sleek glassmorphic channel shelf, ambient backdrop lighting, and category filtering.
- **Embedded Local Proxy**: Built-in Axum & Tokio asynchronous streaming proxy with dynamic port binding (18181-18185+).
- **In-Memory RAM Segment Caching**: Ultra-low latency channel switching with LRU caching for video segments and M3U8 playlists.
- **Predictive Pre-Warming**: Background pre-fetching of adjacent channel video segments for instant playback transitions.
- **Security & Anti-SSRF Protection**:
  - Ephemeral session auth token validation on every proxy request.
  - DNS-rebinding and loopback address defense blocking internal IP access.
  - Hard 10MB response buffer limit with automatic fallback to zero-copy streaming.
  - Concurrency limiting to prevent resource exhaustion attacks.
- **Health Check & Diagnostics Endpoint**: Built-in `GET /health` API exposing uptime, active requests, cache metrics, and error rates.
- **Self-Healing Sentinel Engine**: High-concurrency Tokio stream verification bot with automatic playlist synchronization and dead-stream healing.
- **Official YouTube & JioHotstar Webviews**: Integrated native child windows with unified top navigation strip and keyboard return shortcuts.
- **Offline SQLite Cache**: Persistent channel indexing with atomic transaction updates and 6-hour validity caching.
- **Audio Booster & Dynamic Range Compressor**: Web Audio API volume boosting up to 300% with broadcast-grade audio normalization.
