MorningTV 1.1.2 is a major stability, visual refinement, and security hardening release for Windows 10 & 11.

Key highlights in this release:

* Production Security & Context Menu Lockdown: Complete hardening of production releases. In production installer builds, right-click context menus and browser DevTools shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+R, F5) are strictly disabled to provide an authentic native desktop app experience, while remaining fully accessible during development mode (`tauri dev`).
* Standardized 760px × 520px Studio Window Geometry: Both the Settings Window and Stream Diagnostics / Speed Meter have been unified to identical spacious proportions (760px width × 520px height), centered dead in the middle of any display.
* Zero-Wobble Tab Navigation: Fixed sidebar layout width (240px) with permanent button bounding borders, eliminating tab shaking, layout jitter, and content cropping when switching between Live Stream Speed, Playlists, Sound, and Settings.
* Accurate Regional Indian Playback Telemetry: Resolved category filtering telemetry where Indian Mode previously displayed global playlist numbers. Now displays accurate verified Indian channel statistics (828 verified regional channels).
* Stabilized Video Playback FPS Diagnostics: Eliminated erratic FPS fluctuations between 30 and 60 using temporal EMA damping and native video element playback state detection, providing rock-solid frame rate telemetry.
* Defunct Streaming Mirror Purge: Purged stale, unresponsive external mirror servers from playlist configurations, preventing stalled retries and improving failover recovery speed.
* Dynamic Unified Versioning: Synchronized versioning across all Rust backend modules, Tauri configuration, UI headers, and updater manifests to v1.1.2.
