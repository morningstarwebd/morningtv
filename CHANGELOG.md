# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-29

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
- **Offline SQLite Cache**: Persistent channel indexing with atomic transaction updates, WAL mode (`journal_mode=WAL`), and 6-hour validity caching.
- **Audio Booster & Dynamic Range Compressor**: Web Audio API volume boosting up to 300% with broadcast-grade audio normalization.
- **Ultra-Lightweight High-Speed Installer**: Streamlined ~5.1 MB setup installer with automatic Windows WebView2 runtime bootstrap.

### Fixed & Hardened (Production Readiness 1.0.0)
- **Process Tree & Lifecycle Hardening**: Guaranteed clean process exit upon closing the main window, cleanly shutting down local Axum proxies, secondary webviews (YouTube/Hotstar), and background threads with zero zombie process leaks.
- **Streaming Proxy Token Preservation**: Seamlessly preserves CDN authentication query tokens when resolving relative HLS playlist segments, preventing mid-stream playback dropouts.
- **Proxy Error Pass-Through & Cache Protection**: Upstream 4xx/5xx responses are passed through immediately without false HTTP 200 rewriting, preventing corrupt manifests from polluting RAM cache.
- **Content Security Policy (CSP) Frame Support**: Enhanced CSP frame-src policy enables seamless in-app YouTube Modal playback.
- **Deep Stream Sentinel 3.0**: Upgraded multi-threaded prober with 188-byte MPEG-TS packet synchronization checks (`0x47` sync byte) and strict HLS tag validation, completely eliminating false positives from HTML challenge pages or dead streams.
- **Structured Observability**: Asynchronous daily rolling file appender via `tracing-appender` to `%APPDATA%/MorningTV/logs/`.
- **Fault-Tolerant Concurrency**: Eliminated 100% of `.lock().unwrap()` mutex poisoning hazards across SQLite storage, history, and channel cache.
- **Proxy Concurrency & Quota Hardening**: Added per-origin concurrency throttling (12 requests/origin) via `DashMap`, along with strict 10MB manifest and 60MB segment payload guards.
- **Frontend Architecture Decomposition**: Refactored monolithic player into 6 specialized React hooks and 5 decoupled Zustand domain stores.
- **Comprehensive Test Suite**: Expanded to 81 automated tests across frontend, backend integration, and sentinel engine with 100% pass rate.
