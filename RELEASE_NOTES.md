MorningTV 1.0.0 is the official initial release of our high performance native Windows live TV player.

Key highlights in this release:

* Complete 100% Offline Embedded Installer: Packages the full Microsoft Edge WebView2 runtime inside the setup executable. Installs and runs smoothly on fresh Windows installations with zero internet requirement.
* Native Tokio Axum Streaming Proxy: In-process Rust engine buffers video chunks directly in memory, bypassing CORS restrictions and delivering rock-solid HLS playback.
* YouTube Style Dynamic Adaptive Buffering: Intelligently expands forward buffer cushion from 5 seconds up to 30 seconds on broadband connections to absorb packet jitter.
* Predictive RAM Pre-Warming: Pre-fetches adjacent channel manifests in background memory for instant channel zapping.
* Zero-Blackout Visual Continuity: Keeps the interface engaging with an ambient frosted channel identity aura while new streams initialize.
* Stream Sentinel 3.0: Multi-threaded Rust auditor validating live streams with deep packet inspection and MPEG-TS sync checks to maintain clean master playlists.
* Process Tree Cleanup Hooks: Custom NSIS installer hooks cleanly close background instances before updates, preventing Windows file lock dialogs.
