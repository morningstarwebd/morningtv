# YouTube-Style Dynamic Adaptive Streaming & Zero-Blackout Guidelines

## 1. Dynamic Adaptive Buffer Engine (YouTube Pattern)
- **Lean Startup Window:** Initialize HLS players with a minimal buffer (`maxBufferLength: 8`, `liveSyncDurationCount: 2`) to prioritize fast first-frame rendering (< 500ms).
- **Throughput-Driven Buffer Scaling:**
  - **High Bandwidth (> 1.5 MB/s / 12 Mbps):** Expand `maxBufferLength` to 30s and `maxBufferSize` to 120MB to buffer 8-12 upcoming segments ahead, making playback 100% immune to Wi-Fi drops and ISP packet jitter.
  - **Stable Bandwidth (400 KB/s - 1.5 MB/s):** Maintain a balanced 16s forward cushion.
  - **Constrained Bandwidth (< 400 KB/s):** Tighten `maxBufferLength` to 6s to avoid stalling the network pipeline.
- **Buffer Starvation Guard:** When buffered time dips below 2.0 seconds, dynamically constrain the buffer target to 8s to force the player engine to prioritize downloading the immediate upcoming chunk over deep backlog queues.

## 2. In-Memory RAM Segment Caching & Predictive Pre-Warming
- Live streaming proxies (such as Axum loopback at `127.0.0.1:18181`) should cache live manifests (TTL 4s) and video segments (TTL 30s) in an in-memory thread-safe LRU structure (`Arc<RwLock<HashMap<String, CachedItem>>>`).
- Neighboring channels (Next / Prev) should be predictively pre-warmed into RAM after the user settles on a channel for > 1 second, eliminating DNS, TLS, and segment download round-trips when switching.

## 3. Zero-Blackout Visual Continuity
- Never drop the `<video>` element to a black void during channel tuning.
- Display a frosted-glass ambient backdrop featuring the active channel's logo and tuning state, smoothly cross-fading into the hardware-decoded stream on `onPlaying` or `canplay`.
