import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Hls from "hls.js";
import { ChevronRight, Loader2, RefreshCw, Tv } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { QualityTier } from "../types";
import { audioBooster } from "../utils/audioBooster";

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
				liveMaxLatencyDurationCount: 8,
				fragLoadingTimeOut: 10000,
				fragLoadingMaxRetry: 4,
				fragLoadingRetryDelay: 1000,
				manifestLoadingTimeOut: 8000,
				manifestLoadingMaxRetry: 3,
				levelLoadingTimeOut: 8000,
				levelLoadingMaxRetry: 3,
				nudgeOffset: 0.2,
				nudgeMaxRetry: 15,
				maxStarvationDelay: 2,
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
			hls.on(Hls.Events.FRAG_LOADED, () => {
				setIsBuffering(false);
				setIsChannelLoading(false);
				setStreamHealthStatus("good");
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
							if (retryCountRef.current <= 2) {
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

	// Listen to Tauri quality tier recommendations
	useEffect(() => {
		let unlistenFn: (() => void) | null = null;
		listen<QualityTier>("quality_tier_changed", (event) => {
			const tier = event.payload;
			setAbrTier(tier);
			if (
				selectedQualityLevel === -1 &&
				hlsRef.current?.levels &&
				hlsRef.current.levels.length > 0
			) {
				const tierToLevel: Record<QualityTier, number> = {
					UltraLow: 0,
					Low: Math.min(1, hlsRef.current.levels.length - 1),
					Medium: -1,
					High: -1,
					Auto: -1,
				};
				const target = tierToLevel[tier] ?? -1;
				if (hlsRef.current.currentLevel !== target) {
					hlsRef.current.currentLevel = target;
				}
			}
		}).then((fn) => {
			unlistenFn = fn;
		});

		return () => {
			if (unlistenFn) unlistenFn();
		};
	}, [selectedQualityLevel, setAbrTier]);

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

			let bitrateBps = 0;
			if (hlsRef.current?.levels && hlsRef.current.currentLevel >= 0) {
				const level = hlsRef.current.levels[hlsRef.current.currentLevel];
				if (level?.bitrate) {
					bitrateBps = level.bitrate;
					const kbps = Math.round(bitrateBps / 1000);
					setNetworkSpeed(
						kbps > 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`,
					);
				}
			}

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

			try {
				const recommendation = await invoke<QualityTier | null>(
					"record_metrics",
					{
						bufferSecs,
						bitrateBps,
					},
				);

				if (recommendation) {
					setAbrTier(recommendation);
					if (
						selectedQualityLevel === -1 &&
						hlsRef.current?.levels &&
						hlsRef.current.levels.length > 0
					) {
						const tierToLevel: Record<QualityTier, number> = {
							UltraLow: 0,
							Low: Math.min(1, hlsRef.current.levels.length - 1),
							Medium: -1,
							High: -1,
							Auto: -1,
						};
						const targetLevel = tierToLevel[recommendation] ?? -1;
						if (hlsRef.current.currentLevel !== targetLevel) {
							hlsRef.current.currentLevel = targetLevel;
						}
					}
				}
			} catch {
				// Ignored
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

					{/* Reconnecting Backoff Overlay */}
					{reconnectCountdown !== null && (
						<div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity duration-200">
							<div className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-black/85 border border-rose-500/30 shadow-2xl shadow-rose-950/40 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
								<div className="flex items-center gap-2 text-rose-400">
									<RefreshCw className="w-5 h-5 animate-spin" />
									<span className="text-sm font-black tracking-wide">
										Reconnecting in {reconnectCountdown}s...
									</span>
								</div>
								<p className="text-[11px] text-zinc-400 text-center max-w-xs">
									All stream mirrors are temporarily unreachable. Retrying with exponential backoff.
								</p>
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
									className="px-4 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition-all cursor-pointer hover:scale-105 active:scale-95"
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
