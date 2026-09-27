import Hls from "hls.js";
import { ChevronRight, Loader2, RefreshCw, Tv } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { audioBooster } from "../utils/audioBooster";
import { formatBytesPerSec } from "../utils/speedFormatter";

export const VideoPlayer: React.FC = () => {
	const {
		activeChannel,
		channels,
		isPlaying,
		volume,
		soundBoost,
		isMuted,
		ambientGlow,
		is3GDataSaver,
		selectedQualityLevel,
		aspectRatio,
		mirrorIndex,
		isChannelLoading,
		reconnectCountdown,
		cycleMirror,
		setMirrorIndex,
		setBufferSecs,
		setNetworkSpeed,
		setTelemetryStats,
		setStreamHealthStatus,
		incrementStallCount,
		setAbrTier,
		setIsChannelLoading,
		setReconnectCountdown,
		showToast,
		togglePlayPause,
		toggleMute,
		setSoundBoost,
		openChannelDrawer,
		openShortcuts,
		selectChannelByIndex,
		nextChannel,
		prevChannel,
		cycleAspectRatio,
	} = useAppStore();

	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const retryCountRef = useRef<number>(0);
	const lastTimeRef = useRef<number>(0);
	const stallTicksRef = useRef<number>(0);
	const stallRecoveryAttemptRef = useRef<number>(0);
	const failedUrlsRef = useRef<Set<string>>(new Set());
	const lastQualityRef = useRef<{ totalFrames: number; time: number } | null>(null);
	const lastFragStatsRef = useRef<{
		lastDownloadSpeed: number;
		lastStreamBitrate: number;
		lastDownloadTime: number;
	} | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const backoffDelayRef = useRef<number>(10);

	const [isBuffering, setIsBuffering] = useState(false);
	const [channelTuneBanner, setChannelTuneBanner] = useState<string | null>(
		null,
	);

	// Full mirror URL list
	const allUrls = useMemo(() => {
		if (!activeChannel) return [];
		return [activeChannel.url, ...(activeChannel.fallback_urls || [])];
	}, [activeChannel]);

	const currentUrl = allUrls[mirrorIndex] || allUrls[0] || "";

	// Sync volume, mute & Web Audio API sound booster
	useEffect(() => {
		if (videoRef.current) {
			videoRef.current.volume = isMuted ? 0 : volume / 100;
			videoRef.current.muted = isMuted;
			audioBooster.attach(videoRef.current, isMuted ? 0 : soundBoost);
		}
	}, [volume, soundBoost, isMuted]);

	// Sync play / pause
	useEffect(() => {
		if (videoRef.current) {
			if (isPlaying) {
				audioBooster.resume();
				hlsRef.current?.startLoad();
				videoRef.current.play().catch(() => {});
			} else {
				videoRef.current.pause();
				hlsRef.current?.stopLoad();
			}
		}
	}, [isPlaying]);

	// Keep screen awake while playing (prevents Windows sleep / screen timeout when watching from afar)
	useEffect(() => {
		let sentinel: any = null;

		const requestWakeLock = async () => {
			if ("wakeLock" in navigator && isPlaying) {
				try {
					sentinel = await (navigator as any).wakeLock.request("screen");
				} catch (err) {
					console.warn("Screen Wake Lock error:", err);
				}
			}
		};

		if (isPlaying) {
			requestWakeLock();
		} else if (sentinel) {
			sentinel.release().catch(() => {});
			sentinel = null;
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && isPlaying) {
				requestWakeLock();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			if (sentinel) {
				sentinel.release().catch(() => {});
			}
		};
	}, [isPlaying]);

	// Reset retry counter and watchdog metrics whenever active channel changes
	useEffect(() => {
		retryCountRef.current = 0;
		lastTimeRef.current = 0;
		stallTicksRef.current = 0;
		stallRecoveryAttemptRef.current = 0;
		failedUrlsRef.current.clear();
		backoffDelayRef.current = 10;
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		if (reconnectIntervalRef.current) {
			clearInterval(reconnectIntervalRef.current);
			reconnectIntervalRef.current = null;
		}
		setReconnectCountdown(null);
	}, [activeChannel?.id, setReconnectCountdown]);

	const handlePiPRequest = useCallback(async () => {
		if (videoRef.current && document.pictureInPictureEnabled) {
			try {
				if (document.pictureInPictureElement)
					await document.exitPictureInPicture();
				else await videoRef.current.requestPictureInPicture();
			} catch (err) {
				console.warn("PiP error:", err);
			}
		}
	}, []);

	// Smart failover with failed URL blacklist and exponential backoff reconnect loop
	const tryNextFallback = useCallback(() => {
		if (allUrls.length === 0) return;

		// Mark current URL as failed in blacklist
		if (currentUrl) {
			failedUrlsRef.current.add(currentUrl);
		}

		// Find next URL in mirror list that has not failed
		const nextAvailableIndex = allUrls.findIndex(
			(url, idx) => idx !== mirrorIndex && !failedUrlsRef.current.has(url),
		);

		if (nextAvailableIndex !== -1) {
			showToast("Switching to backup stream...", false);
			setStreamHealthStatus("degraded");
			setMirrorIndex(nextAvailableIndex);
		} else {
			// All URLs in the pool failed — enter reconnect backoff loop
			const delay = backoffDelayRef.current;
			setStreamHealthStatus("reconnecting");
			showToast(
				`All stream sources failed. Reconnecting in ${delay}s...`,
				true,
			);
			setReconnectCountdown(delay);

			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
			if (reconnectIntervalRef.current)
				clearInterval(reconnectIntervalRef.current);

			let remaining = delay;
			reconnectIntervalRef.current = setInterval(() => {
				remaining -= 1;
				if (remaining > 0) {
					setReconnectCountdown(remaining);
				} else {
					if (reconnectIntervalRef.current) {
						clearInterval(reconnectIntervalRef.current);
						reconnectIntervalRef.current = null;
					}
					setReconnectCountdown(null);
				}
			}, 1000);

			reconnectTimerRef.current = setTimeout(() => {
				failedUrlsRef.current.clear();
				// Exponential backoff: 10s -> 20s -> 40s (capped at 60s)
				backoffDelayRef.current = Math.min(60, delay * 2);
				showToast("Retrying stream sources...", false);
				setStreamHealthStatus("degraded");
				cycleMirror();
			}, delay * 1000);
		}
	}, [
		allUrls,
		currentUrl,
		mirrorIndex,
		setMirrorIndex,
		cycleMirror,
		showToast,
		setStreamHealthStatus,
		setReconnectCountdown,
	]);

	// Keyboard navigation & Number Key Channel Tuning
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName))
				return;

			// Number keys 1-9 for instant channel tuning
			if (/^[1-9]$/.test(e.key)) {
				e.preventDefault();
				const chIdx = parseInt(e.key, 10) - 1;
				if (chIdx < channels.length) {
					selectChannelByIndex(chIdx);
					setChannelTuneBanner(
						`CH ${String(chIdx + 1).padStart(2, "0")}: ${channels[chIdx].name}`,
					);
					setTimeout(() => setChannelTuneBanner(null), 2500);
				}
				return;
			}

			switch (e.key.toLowerCase()) {
				case " ":
				case "k":
					e.preventDefault();
					togglePlayPause();
					break;
				case "f":
					e.preventDefault();
					if (!document.fullscreenElement)
						containerRef.current?.requestFullscreen().catch(() => {});
					else document.exitFullscreen().catch(() => {});
					break;
				case "m":
					e.preventDefault();
					toggleMute();
					break;
				case "c":
				case "g":
					e.preventDefault();
					openChannelDrawer();
					break;
				case "b":
					e.preventDefault();
					if (soundBoost < 150) setSoundBoost(150);
					else if (soundBoost < 200) setSoundBoost(200);
					else if (soundBoost < 300) setSoundBoost(300);
					else setSoundBoost(100);
					break;
				case "a":
					e.preventDefault();
					cycleAspectRatio();
					break;
				case "arrowright":
				case "]":
					e.preventDefault();
					nextChannel();
					break;
				case "arrowleft":
				case "[":
					e.preventDefault();
					prevChannel();
					break;
				case "p":
					e.preventDefault();
					handlePiPRequest();
					break;
				case "?":
					e.preventDefault();
					openShortcuts();
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		channels,
		togglePlayPause,
		toggleMute,
		soundBoost,
		setSoundBoost,
		cycleAspectRatio,
		nextChannel,
		prevChannel,
		selectChannelByIndex,
		openChannelDrawer,
		openShortcuts,
		handlePiPRequest,
	]);

	// HLS stream loader with 3G Anti-Fallback & Extreme Buffer Resilience
	useEffect(() => {
		if (!currentUrl || !videoRef.current) {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
			return;
		}

		setIsBuffering(true);
		const video = videoRef.current;
		const proxiedUrl = currentUrl.startsWith("http://127.0.0.1:18181/")
			? currentUrl
			: `http://127.0.0.1:18181/stream?url=${encodeURIComponent(currentUrl)}`;

		if (Hls.isSupported()) {
			if (hlsRef.current) hlsRef.current.destroy();

			// Configure HLS for instant playback and smart network resilience
			const hls = new Hls({
				enableWorker: true,
				lowLatencyMode: false,
				backBufferLength: 30,
				maxBufferLength: is3GDataSaver ? 45 : 30,
				maxMaxBufferLength: is3GDataSaver ? 60 : 60,
				maxBufferSize: 60 * 1000 * 1000,
				liveSyncDurationCount: 3,
				liveMaxLatencyDurationCount: 10,
				fragLoadingTimeOut: 20000,
				fragLoadingMaxRetry: 6,
				fragLoadingRetryDelay: 1000,
				manifestLoadingTimeOut: 15000,
				manifestLoadingMaxRetry: 5,
				levelLoadingTimeOut: 15000,
				levelLoadingMaxRetry: 5,
				nudgeOffset: 0.2,
				nudgeMaxRetry: 20,
				maxStarvationDelay: 5,
				abrEwmaFastLive: 3.0,
				abrEwmaSlowLive: 9.0,
				abrMaxWithRealBitrate: true,
				startLevel: is3GDataSaver ? 0 : -1,
				autoStartLoad: true,
			});

			hlsRef.current = hls;
			hls.loadSource(proxiedUrl);
			hls.attachMedia(video);

			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				retryCountRef.current = 0;
				setIsChannelLoading(false);

				// Parse and register available quality levels in appStore
				if (hls.levels && hls.levels.length > 0) {
					const levels = hls.levels.map((lvl, index) => {
						const height = lvl.height || 0;
						const bitrate = lvl.bitrate || 0;
						let label: string;
						if (height >= 1080) label = "1080p Full HD";
						else if (height >= 720) label = "720p HD";
						else if (height >= 480) label = "480p SD";
						else if (height >= 360) label = "360p (Saver)";
						else if (height > 0) label = `${height}p Low`;
						else label = `Level ${index + 1}`;
						return { index, label, height, bitrate };
					});
					useAppStore.getState().setAvailableQualityLevels(levels);

					const { selectedQualityLevel, is3GDataSaver } =
						useAppStore.getState();
					if (
						selectedQualityLevel >= 0 &&
						selectedQualityLevel < hls.levels.length
					) {
						hls.currentLevel = selectedQualityLevel;
					} else if (is3GDataSaver) {
						// Find a balanced ~360p/480p level, avoiding potato 144p
						const saverLevelIdx = levels.findIndex(
							(l) => l.height >= 360 && l.height <= 480,
						);
						hls.currentLevel = saverLevelIdx !== -1 ? saverLevelIdx : 0;
					} else {
						hls.currentLevel = -1; // Adaptive ABR (will upgrade to 1080p)
					}
				}

				audioBooster.attach(video, isMuted ? 0 : soundBoost);
				if (useAppStore.getState().isPlaying) {
					video.play().catch(() => {});
				}
			});

			hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
				if (hls.levels?.[data.level]) {
					const lvl = hls.levels[data.level];
					const resStr = `${lvl.height}p (${lvl.width}x${lvl.height})`;
					useAppStore.getState().setCurrentResolution(resStr);
				}
			});

			hls.on(Hls.Events.FRAG_BUFFERED, () => {
				setIsBuffering(false);
				setIsChannelLoading(false);
				setStreamHealthStatus("good");
			});
			hls.on(Hls.Events.FRAG_LOADED, (_event, data: any) => {
				setIsBuffering(false);
				setIsChannelLoading(false);
				setStreamHealthStatus("good");

				try {
					const frag = data?.frag;
					if (frag) {
						const payloadBytes = data?.payload?.byteLength || 0;
						const statsBytes = frag.stats?.total || frag.stats?.loaded || 0;
						const totalBytes = payloadBytes > 0 ? payloadBytes : statsBytes;
						const durationSec = frag.duration > 0 ? frag.duration : 2.0;

						const loadStart = frag.stats?.loading?.start || 0;
						const loadEnd = frag.stats?.loading?.end || performance.now();
						const loadDurationSec = Math.max(0.01, (loadEnd - loadStart) / 1000);

						// 1. Actual instantaneous network download speed in Bytes/sec (divided by 8)
						const downloadBytesSec = totalBytes / loadDurationSec;
						const fmtDownload = formatBytesPerSec(downloadBytesSec);

						// 2. Actual video segment bitrate in Bytes/sec (divided by 8)
						const streamBytesSec = totalBytes > 0 ? totalBytes / durationSec : 0;

						// 3. Network bandwidth capacity from Hls bandwidth estimate (bits / 8 = Bytes)
						const bwEstimateBits = hls.bandwidthEstimate || 0;
						const fmtCapacity = formatBytesPerSec(bwEstimateBits / 8);

						// 4. Nominal manifest bitrate (bits / 8 = Bytes)
						let nominalBitrateStr = "";
						if (
							hls.levels &&
							hls.currentLevel >= 0 &&
							hls.levels[hls.currentLevel]?.bitrate
						) {
							const nomBits = hls.levels[hls.currentLevel].bitrate;
							const nomFmt = formatBytesPerSec(nomBits / 8);
							nominalBitrateStr = `${nomFmt.formatted} (${nomFmt.mbps})`;
						}

						const activeStreamBytes =
							streamBytesSec > 0
								? streamBytesSec
								: hls.levels?.[hls.currentLevel]?.bitrate
									? hls.levels[hls.currentLevel].bitrate / 8
									: 0;

						lastFragStatsRef.current = {
							lastDownloadSpeed: downloadBytesSec,
							lastStreamBitrate: activeStreamBytes,
							lastDownloadTime: performance.now(),
						};

						const finalStreamFmt = formatBytesPerSec(activeStreamBytes);

						useAppStore.getState().setTelemetryStats({
							networkSpeed: fmtDownload.formatted,
							downloadSpeedFormatted: fmtDownload.formatted,
							downloadSpeedMbps: fmtDownload.mbps,
							streamBitrateFormatted: finalStreamFmt.formatted,
							streamBitrateMbps: finalStreamFmt.mbps,
							bandwidthCapacityFormatted: fmtCapacity.formatted,
							bandwidthCapacityMbps: fmtCapacity.mbps,
							nominalBitrate: nominalBitrateStr || "--",
						});
					}
				} catch (err) {
					console.warn("FRAG_LOADED telemetry calculation error:", err);
				}
			});
			hls.on(Hls.Events.BUFFER_APPENDING, () => {
				setIsBuffering(false);
				setIsChannelLoading(false);
			});

			// Resilient error handling: retry first instead of prematurely jumping fallbacks
			hls.on(Hls.Events.ERROR, (_event, data) => {
				if (data.fatal) {
					switch (data.type) {
						case Hls.ErrorTypes.NETWORK_ERROR:
							retryCountRef.current += 1;
							if (retryCountRef.current <= 4) {
								hls.startLoad();
							} else {
								retryCountRef.current = 0;
								hls.destroy();
								hlsRef.current = null;
								tryNextFallback();
							}
							break;
						case Hls.ErrorTypes.MEDIA_ERROR:
							hls.recoverMediaError();
							break;
						default:
							retryCountRef.current += 1;
							if (retryCountRef.current <= 2) {
								hls.startLoad();
							} else {
								retryCountRef.current = 0;
								hls.destroy();
								hlsRef.current = null;
								tryNextFallback();
							}
							break;
					}
				}
			});
		} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
			video.src = proxiedUrl;
			video.addEventListener("loadedmetadata", () => {
				setIsBuffering(false);
				audioBooster.attach(video, isMuted ? 0 : soundBoost);
				if (isPlaying) video.play().catch(() => {});
			});
			video.addEventListener("error", () => tryNextFallback());
		}

		return () => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
		};
	}, [currentUrl, tryNextFallback]);

	// Dynamically switch quality when user chooses a level in the Stream Quality HUD
	useEffect(() => {
		if (!hlsRef.current?.levels) return;
		if (
			selectedQualityLevel >= 0 &&
			selectedQualityLevel < hlsRef.current.levels.length
		) {
			hlsRef.current.currentLevel = selectedQualityLevel;
		} else if (is3GDataSaver) {
			const levels = hlsRef.current.levels;
			const saverLevelIdx = levels.findIndex(
				(l) => (l.height || 0) >= 360 && (l.height || 0) <= 480,
			);
			hlsRef.current.currentLevel = saverLevelIdx !== -1 ? saverLevelIdx : 0;
		} else {
			hlsRef.current.currentLevel = -1; // Auto ABR (defaults to 1080p / 720p HD)
		}
	}, [selectedQualityLevel, is3GDataSaver]);


	// Buffer, network telemetry, stall watchdog, and ABR evaluation loop
	useEffect(() => {
		const timer = setInterval(async () => {
			if (!videoRef.current || !activeChannel) return;

			const video = videoRef.current;
			let bufferSecs = 0;

			if (video.buffered.length > 0) {
				for (let i = 0; i < video.buffered.length; i++) {
					if (
						video.currentTime >= video.buffered.start(i) &&
						video.currentTime <= video.buffered.end(i)
					) {
						bufferSecs = video.buffered.end(i) - video.currentTime;
						break;
					}
				}
			}

			setBufferSecs(Math.round(bufferSecs * 10) / 10);

			// 1. Hardware decoded resolution detection from live video element
			if (video.videoWidth > 0 && video.videoHeight > 0) {
				const detectedRes = `${video.videoHeight}p (${video.videoWidth}×${video.videoHeight})`;
				if (useAppStore.getState().currentResolution !== detectedRes) {
					useAppStore.getState().setCurrentResolution(detectedRes);
				}
			}

			// 2. Decoded FPS & dropped frames from hardware media decoder
			let currentFps = 0;
			let droppedFrames = 0;
			let totalFrames = 0;
			if (typeof (video as any).getVideoPlaybackQuality === "function") {
				const q = (video as any).getVideoPlaybackQuality();
				droppedFrames = q.droppedVideoFrames || 0;
				totalFrames = q.totalVideoFrames || 0;
				const now = performance.now();
				if (lastQualityRef.current) {
					const deltaFrames = totalFrames - lastQualityRef.current.totalFrames;
					const deltaTime = (now - lastQualityRef.current.time) / 1000;
					if (deltaTime >= 0.8) {
						currentFps = Math.max(0, Math.round(deltaFrames / deltaTime));
						lastQualityRef.current = { totalFrames, time: now };
					}
				} else {
					lastQualityRef.current = { totalFrames, time: now };
				}
			}

			// 3. Live Edge Latency (in seconds)
			let liveLatency = 0;
			if (hlsRef.current?.liveSyncPosition && video.currentTime > 0) {
				liveLatency = Math.max(
					0,
					Math.round((hlsRef.current.liveSyncPosition - video.currentTime) * 10) / 10,
				);
			} else if (
				video.duration &&
				isFinite(video.duration) &&
				video.currentTime > 0
			) {
				liveLatency = Math.max(
					0,
					Math.round((video.duration - video.currentTime) * 10) / 10,
				);
			}

			// 4. Nominal manifest bitrate if available
			let bitrateBps = 0;
			let nominalBitrateStr = "";
			if (
				hlsRef.current?.levels &&
				hlsRef.current.currentLevel >= 0 &&
				hlsRef.current.levels[hlsRef.current.currentLevel]?.bitrate
			) {
				bitrateBps = hlsRef.current.levels[hlsRef.current.currentLevel].bitrate;
				const nomFmt = formatBytesPerSec(bitrateBps / 8);
				nominalBitrateStr = `${nomFmt.formatted} (${nomFmt.mbps})`;
			}

			// 5. Bandwidth capacity from HLS bandwidthEstimate (divided by 8)
			const bwEstimateBits = hlsRef.current?.bandwidthEstimate || 0;
			const fmtCapacity = formatBytesPerSec(bwEstimateBits / 8);

			// 6. Real-time download speed calculation in between chunks
			let currentDownloadBytesSec = 0;
			if (lastFragStatsRef.current) {
				const elapsed =
					(performance.now() - lastFragStatsRef.current.lastDownloadTime) / 1000;
				if (elapsed < 2.5) {
					currentDownloadBytesSec = lastFragStatsRef.current.lastDownloadSpeed;
				} else if (elapsed < 6.0) {
					currentDownloadBytesSec =
						lastFragStatsRef.current.lastDownloadSpeed * (1 - (elapsed - 2.5) / 5);
				} else {
					currentDownloadBytesSec = 0;
				}
			}
			const fmtCurrentDownload = formatBytesPerSec(currentDownloadBytesSec);

			// 7. Update telemetry state
			const telemetryUpdates: Parameters<typeof setTelemetryStats>[0] = {
				droppedFrames,
				totalFrames,
				liveLatency,
				bandwidthCapacityFormatted: fmtCapacity.formatted,
				bandwidthCapacityMbps: fmtCapacity.mbps,
				downloadBandwidth: fmtCapacity.formatted,
			};
			// Ensure stream bitrate is always active
			let activeStreamBytesSec = 0;
			if (
				lastFragStatsRef.current &&
				lastFragStatsRef.current.lastStreamBitrate > 0
			) {
				activeStreamBytesSec = lastFragStatsRef.current.lastStreamBitrate;
			} else if (bitrateBps > 0) {
				activeStreamBytesSec = bitrateBps / 8;
			}
			if (activeStreamBytesSec > 0) {
				const streamFmt = formatBytesPerSec(activeStreamBytesSec);
				telemetryUpdates.streamBitrateFormatted = streamFmt.formatted;
				telemetryUpdates.streamBitrateMbps = streamFmt.mbps;
			}

			if (nominalBitrateStr) {
				telemetryUpdates.nominalBitrate = nominalBitrateStr;
			}
			if (currentFps > 0) {
				telemetryUpdates.currentFps = currentFps;
			}
			if (currentDownloadBytesSec > 0) {
				telemetryUpdates.networkSpeed = fmtCurrentDownload.formatted;
				telemetryUpdates.downloadSpeedFormatted = fmtCurrentDownload.formatted;
				telemetryUpdates.downloadSpeedMbps = fmtCurrentDownload.mbps;
			}
			setTelemetryStats(telemetryUpdates);

			// Stall Watchdog: Detect silent video freezes without error events
			const currentTime = video.currentTime;
			if (isPlaying && !video.paused && !video.ended) {
				if (currentTime === lastTimeRef.current && currentTime > 0) {
					stallTicksRef.current += 1;

					// After 5s stalled: trigger gentle startLoad() buffer reload
					if (
						stallTicksRef.current === 5 &&
						stallRecoveryAttemptRef.current < 2
					) {
						stallRecoveryAttemptRef.current += 1;
						hlsRef.current?.startLoad();
						setIsBuffering(true);
						incrementStallCount();
						setStreamHealthStatus("stalled");
					}

					// After 10s stalled & recovery failed: switch to next available fallback URL
					if (stallTicksRef.current >= 10) {
						stallTicksRef.current = 0;
						stallRecoveryAttemptRef.current = 0;
						tryNextFallback();
					}
				} else {
					stallTicksRef.current = 0;
					stallRecoveryAttemptRef.current = 0;
					lastTimeRef.current = currentTime;
					if (bufferSecs >= 6.0) {
						setStreamHealthStatus("good");
					} else if (bufferSecs >= 2.5) {
						setStreamHealthStatus("degraded");
					} else {
						setStreamHealthStatus("critical");
					}
				}
			}
		}, 1000);

		return () => clearInterval(timer);
	}, [
		activeChannel,
		isPlaying,
		selectedQualityLevel,
		setBufferSecs,
		setNetworkSpeed,
		setStreamHealthStatus,
		incrementStallCount,
		setAbrTier,
		tryNextFallback,
	]);

	const getAspectRatioClasses = () => {
		switch (aspectRatio) {
			case "4:3":
				return "aspect-[4/3] max-w-full max-h-full object-contain";
			case "fill":
				return "w-full h-full object-cover";
			case "21:9":
				return "aspect-[21/9] max-w-full max-h-full object-contain";
			default:
				return "aspect-[16/9] max-w-full max-h-full object-contain";
		}
	};

	return (
		<div
			ref={containerRef}
			onDoubleClick={() => {
				if (!document.fullscreenElement)
					containerRef.current?.requestFullscreen().catch(() => {});
				else document.exitFullscreen().catch(() => {});
			}}
			className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden select-none"
		>
			{/* On-Screen Channel Tune Number Banner */}
			{channelTuneBanner && (
				<div className="absolute top-16 left-8 z-50 px-5 py-3 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
					<div className="flex items-center gap-2.5">
						<span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
						<span className="text-sm font-mono font-black text-white tracking-wider">
							{channelTuneBanner}
						</span>
					</div>
				</div>
			)}

			{/* Ambilight Ambient Glow Aura */}
			{ambientGlow && activeChannel && (
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 blur-3xl z-0">
					<div className="w-[140%] h-[140%] -left-[20%] -top-[20%] absolute bg-gradient-to-tr from-cyan-900/40 via-indigo-950/60 to-blue-900/40 animate-pulse" />
				</div>
			)}

			{activeChannel ? (
				<div className="w-full h-full relative z-10 flex items-center justify-center">
					<video
						ref={videoRef}
						className={`${getAspectRatioClasses()} transition-all`}
						style={{ imageRendering: "-webkit-optimize-contrast" }}
						playsInline
						onWaiting={() => setIsBuffering(true)}
						onPlaying={() => {
							setIsBuffering(false);
							setIsChannelLoading(false);
							setStreamHealthStatus("good");
							if (!useAppStore.getState().isPlaying) {
								useAppStore.setState({ isPlaying: true });
							}
						}}
						onPlay={() => {
							if (!useAppStore.getState().isPlaying) {
								useAppStore.setState({ isPlaying: true });
							}
						}}
						onPause={() => {
							if (
								videoRef.current?.paused &&
								useAppStore.getState().isPlaying
							) {
								useAppStore.setState({ isPlaying: false });
							}
						}}
						onCanPlay={() => {
							setIsBuffering(false);
							setIsChannelLoading(false);
						}}
						onLoadedData={() => {
							setIsBuffering(false);
							setIsChannelLoading(false);
						}}
					/>

					{/* Reconnecting Backoff Indicator */}
					{reconnectCountdown !== null && (
						<div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-none transition-opacity duration-200">
							<div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-black/90 border border-rose-500/40 shadow-2xl shadow-rose-950/50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-auto">
								<RefreshCw className="w-4 h-4 text-rose-400 animate-spin" />
								<span className="text-xs font-bold text-rose-300">
									Stream reconnecting in {reconnectCountdown}s...
								</span>
								<button
									onClick={() => {
										failedUrlsRef.current.clear();
										if (reconnectTimerRef.current)
											clearTimeout(reconnectTimerRef.current);
										if (reconnectIntervalRef.current)
											clearInterval(reconnectIntervalRef.current);
										setReconnectCountdown(null);
										cycleMirror();
									}}
									className="px-3 py-1 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-500/40 text-[11px] font-bold text-rose-200 transition-all cursor-pointer hover:scale-105 active:scale-95"
								>
									Retry Now
								</button>
							</div>
						</div>
					)}

					{/* Buffering & Channel Loading Overlay */}
					{(isBuffering || isChannelLoading) &&
						reconnectCountdown === null && (
							<div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none transition-opacity duration-200">
								<div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/75 border border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
									<Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
									<span className="text-xs font-semibold text-zinc-200">
										{isChannelLoading
											? "Tuning Channel..."
											: is3GDataSaver
												? "Connecting 3G Stream..."
												: "Connecting Live Stream..."}
									</span>
								</div>
							</div>
						)}
				</div>
			) : (
				/* Clean Welcome Screen */
				<div className="flex flex-col items-center justify-center text-center p-8 max-w-lg select-none relative z-10">
					<div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-600/30 via-blue-600/20 to-indigo-500/30 border border-white/10 flex items-center justify-center mb-6 shadow-2xl shadow-cyan-500/10">
						<Tv className="w-12 h-12 text-cyan-400" />
					</div>
					<h2 className="text-2xl font-black text-white mb-2 tracking-tight">
						MorningTV 4K
					</h2>
					<p className="text-xs text-zinc-400 leading-relaxed mb-6 max-w-sm">
						Simplified, ultra-smooth Apple TV & Google TV live television player
						with 3G shield and 300% Web Audio Booster.
					</p>
					<button
						onClick={openChannelDrawer}
						className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-black shadow-xl shadow-white/15 transition-all cursor-pointer hover:scale-105 active:scale-95"
					>
						<span>Open Channel Guide</span>
						<ChevronRight className="w-4 h-4" />
					</button>
				</div>
			)}
		</div>
	);
};
