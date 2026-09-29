MorningTV 1.0.0 is the official production release, delivering a high-performance, lightweight native Windows IPTV player with advanced streaming proxy resilience, strict stream inspection, and modern UI.

Key highlights in this release:

* Lightweight High-Speed Installer: Streamlined ~5.1 MB setup installer with automatic Windows WebView2 runtime bootstrap.
* Process Tree & Lifecycle Hardening: Guaranteed clean process exit upon closing the main window, cleanly shutting down local Axum proxies, secondary webviews (YouTube/Hotstar), and background threads with zero zombie process leaks.
* Streaming Proxy Token Preservation: Seamlessly preserves CDN authentication query tokens when resolving relative HLS playlist segments, preventing mid-stream playback dropouts.
* Proxy Error Pass-Through & Cache Protection: Upstream 4xx/5xx responses are passed through immediately without false HTTP 200 rewriting, preventing corrupt manifests from polluting RAM cache.
* Content Security Policy (CSP) Frame Support: Enhanced CSP frame-src policy enables seamless in-app YouTube Modal playback.
* Deep Stream Sentinel 3.0: Multi-threaded prober with 188-byte MPEG-TS packet synchronization checks and strict HLS tag validation, completely eliminating false positives from HTML challenge pages or dead streams.
* Zero Dead Code & Modular State: Fully audited and streamlined frontend state architecture passing 81 automated tests with 100% test coverage across core streaming components.
