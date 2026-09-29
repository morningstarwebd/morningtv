# IPTV Resilient Streaming & Production Engineering Guidelines

## 1. High-Stability Buffer Cushion (KISS Principle)
- **Deep Forward Buffer Cushion:** Always configure HLS.js with deep buffer capacity (`maxBufferLength: 35-45`, `maxMaxBufferLength: 60`). Never artificially restrict buffer to < 20s for live IPTV streams.
- **Live Sync Safety Distance:** Set `liveSyncDurationCount: 3` (or minimum 3). Never set to < 3, as live edge jitter will immediately starve the playback head.
- **Finite Back-Buffer:** Always set `backBufferLength: 30` to prevent unbounded memory growth while preserving instant short rewinds.
- **Realistic Timeouts:** Use `fragLoadingTimeOut: 12000` (12s) and `manifestLoadingTimeOut: 10000` (10s) with modest retry counts (4-5 retries) to recover swiftly from dropped network packets.

## 2. In-Memory Security & DNS Caching (Zero-Overhead Anti-SSRF)
- Desktop streaming proxies running on loopback (`127.0.0.1`) MUST NOT execute blocking OS DNS queries (`lookup_host`) on individual video segment chunks (.ts).
- Host security validation (SSRF/DNS rebinding defense) MUST be cached in-memory with a 30-minute TTL. Subsequent segment chunk requests must pass host validation in < 0.001 ms via memory lookup.
- Media relay clients must tolerate broadcaster SSL/TLS quirks (`danger_accept_invalid_certs: true`) to avoid 502 Bad Gateway errors on legacy broadcaster feeds.

## 3. Passive Watchdog & Non-Destructive Recovery
- NEVER forcibly downgrade quality tiers (`currentLevel = 0`), tighten buffer parameters, or nudge `currentTime` when buffer dips. HLS.js internal ABR handles downshifts smoothly without clearing MSE buffers.
- Watchdogs must only intervene when a genuine freeze persists for > 5 seconds, triggering gentle `startLoad()` reloads before attempting mirror failovers after > 15 seconds.
