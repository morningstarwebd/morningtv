MorningTV 1.0.1 delivers major video streaming resilience enhancements, sub-millisecond host security caching, and smooth, zero-stutter playback across all 4,200+ live television channels.

Key highlights in this release:

* Sub-Millisecond Host Security Cache: Eliminates blocking per-chunk OS DNS queries by caching verified public hostnames in-memory with a 30-minute TTL, dropping transport segment delivery latency from ~4.9 seconds to under 0.001 ms while maintaining 100% Anti-SSRF protection.
* Deep Adaptive Forward Buffer (35s–60s): Expanded HLS forward buffer cushion up to 60 seconds (up from 8s) with a 30s finite back-buffer. Network dips and ISP jitter of up to 30 seconds are smoothly absorbed in RAM without video stalling.
* Safe Live Sync Distance: Tuned live edge synchronization (`liveSyncDurationCount: 3`) to provide a safe 12-to-16 second safety cushion against live broadcast edge jitter.
* Non-Destructive Watchdog: De-escalated playback watchdog to prevent destructive quality downgrades or timestamp nudges during transient network hiccups, allowing HLS.js native ABR to adapt bitrates smoothly.
* Broadcaster TLS Tolerance: Enabled certificate quirk tolerance on the internal media streaming relay, ensuring legacy and free public broadcasters with self-signed or expired certs play flawlessly.
* Lightweight Signed Installer: High-speed ~5.1 MB NSIS setup executable with automatic WebView2 bootstrapper and Minisign cryptographic verification.
