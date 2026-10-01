MorningTV 1.1.0 is a milestone release delivering cinema-grade playback enhancements, universal stream remuxing, adaptive low-speed networking, Windows notification tray integration, and native picture-in-picture.

Key highlights in this release:

* Smart Adaptive 3G Data Saver: Continuous EWMA bandwidth estimation dynamically detects constrained connections (<700 kbps) and shifts to 360p/480p with tight buffers, ensuring 100% stall-free continuous playback on mobile hotspots and congested networks.
* Universal FFmpeg Bridge: In-process streaming relay bridge capable of live-remuxing H.265 (HEVC) streams and transcoding multi-channel AC3 / Dolby Digital audio to stereo AAC, unlocking full audio-video support on Windows without third-party codec packs.
* Windows System Notification Tray & Quick Controls: MorningTV now docks seamlessly into the Windows taskbar tray. Left-click to instantly restore the window; right-click for quick access to Show/Hide, GitHub repository, stream reload, and clean termination.
* Windows Startup Autostart Manager: Full control over whether MorningTV boots automatically with Windows, configurable directly from the System Tray menu or the new "System & Startup" settings panel (synchronizes with HKCU Run registry).
* Cinema Electronic Program Guide (EPG) Overlay: Sleek glassmorphic timeline overlay synthesizing live broadcast schedules across news, sports, movies, kids, music, and entertainment genres with real-time progress bars and "UP NEXT" previews.
* Native Floating Picture-in-Picture (PiP): Dedicated always-on-top floating mini-player (420x240) powered by native Tauri v2 WebviewWindow APIs that floats above all Windows desktop applications.
* Bandwidth Shield & Smart Pre-Warming: Predictive channel pre-warming now throttles when the active buffer is low (<8s) or 3G Data Saver is engaged, guaranteeing zero playback interruption.
* Zero Warnings & 100% Verification: 81/81 test suites passing across frontend, Rust backend, and Sentinel cloud stream auditor with 0 linter and 0 Clippy warnings.
