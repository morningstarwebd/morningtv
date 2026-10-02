MorningTV 1.1.3 is an intelligent playback resilience and streaming optimization release for Windows 10 & 11.

Key highlights in this release:

* Smart Tiered Adaptation Engine: Introduced an intelligent multi-tier degradation hierarchy for congested networks. Rather than abruptly abandoning the current stream, MorningTV progressively steps down quality (e.g. 1080p -> 720p -> 480p) on the active link and activates 3G Data Saver before ever cycling to external backup mirrors.
* Intelligent Multi-Bitrate vs Single-Quality Detection: Streams are dynamically analyzed upon manifest load. Channels with multiple variants experience graceful quality step-downs, while single-bitrate channels bypass useless quality attempts and immediately perform buffer recoveries or failover.
* Single-URL vs Multi-Mirror Awareness: Channels with only a single upstream URL no longer display confusing "switching mirror" messages. Instead, they clearly report "Stream signal interrupted" and enter a clean countdown reconnect loop.
* Anti-Bottleneck Forward Buffer Cushions: Increased HLS forward buffer targets to 45s (75s max) and extended starvation delay to 6s, eliminating the aggressive 3-second fragment abortion bottleneck and ensuring smooth playback on mobile hotspots and fluctuating connections.
* Seamless Mirror Quality Reset: Switching to a backup mirror now automatically resets quality state to Auto ABR (-1), allowing the new streaming server to calibrate its native resolution variants cleanly.
