// src/hooks/useStallWatchdog.ts
// Production-grade resilient stall detection and smart tiered adaptation engine

import type Hls from "hls.js";
import type React from "react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";
import type { StreamHealthStatus } from "../types";
import { createLogger } from "../utils/logger";

const log = createLogger("StallWatchdog");

export interface StallWatchdogOptions {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	hlsRef: React.RefObject<Hls | null>;
	isPlaying: boolean;
	bufferSecs: number;
	allUrls?: string[];
	currentUrl?: string;
	showToast?: (message: string, isError: boolean) => void;
	is3GDataSaver?: boolean;
	set3GDataSaver?: (enabled: boolean) => void;
	selectedQualityLevel?: number;
	setSelectedQualityLevel?: (level: number) => void;
	setIsBuffering: (buffering: boolean) => void;
	incrementStallCount: () => void;
	setStreamHealthStatus: (status: StreamHealthStatus) => void;
	tryNextFallback: () => void;
	resetFailover?: () => void;
}

export function useStallWatchdog(options: StallWatchdogOptions): void {
	const {
		videoRef,
		hlsRef,
		isPlaying,
		bufferSecs,
		allUrls = [],
		currentUrl = "",
		showToast,
		is3GDataSaver = false,
		set3GDataSaver,
		setSelectedQualityLevel,
		setIsBuffering,
		incrementStallCount,
		setStreamHealthStatus,
		tryNextFallback,
		resetFailover,
	} = options;

	const lastTimeRef = useRef<number>(0);
	const stallTicksRef = useRef<number>(0);
	const healthyTicksRef = useRef<number>(0);
	const hasSteppedDownQualityRef = useRef<boolean>(false);
	const hasActivated3GRef = useRef<boolean>(false);

	// Reset tiered adaptation state whenever current stream URL changes
	useEffect(() => {
		stallTicksRef.current = 0;
		healthyTicksRef.current = 0;
		lastTimeRef.current = 0;
		hasSteppedDownQualityRef.current = false;
		hasActivated3GRef.current = false;
	}, [currentUrl]);

	useEffect(() => {
		const interval = setInterval(() => {
			const video = videoRef.current;
			if (!video) return;

			const currentTime = video.currentTime;
			if (isPlaying && !video.paused && !video.ended) {
				if (currentTime === lastTimeRef.current) {
					stallTicksRef.current += 1;
					const ticks = stallTicksRef.current;
					const hls = hlsRef.current;
					const levels = hls?.levels || [];
					const hasMultipleQualities = levels.length > 1;
					const hasFallbackMirrors = allUrls.length > 1;

					// ==============================================================
					// SCENARIO 1: INITIAL PLAYBACK STALL (currentTime === 0)
					// Channel just tuned, waiting for initial handshake & buffer fill
					// ==============================================================
					if (currentTime === 0) {
						if (ticks === 7) {
							// Gentle startLoad after 7s initial handshake
							hls?.startLoad();
						} else if (ticks === 15) {
							if (hasMultipleQualities && !hasActivated3GRef.current) {
								// Initial constrained network: attempt tuning at lowest available resolution
								const sortedLevels = levels
									.map((lvl, idx) => ({
										idx,
										bitrate: lvl.bitrate || 0,
										height: lvl.height || 0,
										label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
									}))
									.sort(
										(a, b) => (a.bitrate || a.height) - (b.bitrate || b.height),
									);

								const lowest = sortedLevels[0];
								if (hls) {
									hls.currentLevel = lowest.idx;
								}
								setSelectedQualityLevel?.(lowest.idx);
								set3GDataSaver?.(true);
								hasActivated3GRef.current = true;
								showToast?.(
									`Constrained network: Tuning at lightweight quality (${lowest.label})...`,
									false,
								);
								hls?.startLoad();
								return;
							}

							// If already tried lowest quality or stream is single-quality:
							if (hasFallbackMirrors) {
								log.info(
									"Still loading initial segments (15s), refreshing buffer loader...",
								);
								hls?.startLoad();
							}
						} else if (ticks === 24) {
							if (hasFallbackMirrors) {
								log.warn(
									"Initial playback failed to start after 24s - switching to next mirror",
								);
								stallTicksRef.current = 0;
								tryNextFallback();
								return;
							}
						} else if (ticks >= 32) {
							// For single-URL channels with no mirrors: trigger clean reconnect loop after 32s
							log.warn(
								"Initial playback unrecoverable on single-source channel (32s) - triggering reconnect",
							);
							stallTicksRef.current = 0;
							tryNextFallback();
							return;
						}
						return;
					}

					// ==============================================================
					// SCENARIO 2: ACTIVE PLAYBACK STALL (currentTime > 0)
					// Stream was playing, but stalled due to network or buffer drops
					// ==============================================================

					// Level 1: Gentle In-Place Buffer Recovery (6 seconds grace period)
					if (ticks === 6) {
						log.info(
							"Playback stall detected (6s) - triggering gentle startLoad()",
						);
						hls?.startLoad();
						setIsBuffering(true);
						incrementStallCount();
						setStreamHealthStatus("stalled");
						return;
					}

					// Level 2 & 3: Smart Progressive Quality Step-Down & 3G Adaptation (14 seconds)
					if (ticks === 14) {
						if (hasMultipleQualities && hls && levels.length > 0) {
							// Sort levels ascending by bitrate / resolution
							const sortedLevels = levels
								.map((lvl, idx) => ({
									idx,
									bitrate: lvl.bitrate || 0,
									height: lvl.height || 0,
									label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
								}))
								.sort(
									(a, b) => (a.bitrate || a.height) - (b.bitrate || b.height),
								);

							const currentIdx =
								hls.currentLevel >= 0
									? hls.currentLevel
									: hls.loadLevel >= 0
										? hls.loadLevel
										: sortedLevels[sortedLevels.length - 1].idx;

							const currentRank = sortedLevels.findIndex(
								(item) => item.idx === currentIdx,
							);

							// Step down to next lower quality if available
							if (currentRank > 0) {
								const lower = sortedLevels[currentRank - 1];
								hls.currentLevel = lower.idx;
								setSelectedQualityLevel?.(lower.idx);
								hasSteppedDownQualityRef.current = true;
								showToast?.(
									`Adjusting stream quality for smooth playback (${lower.label})...`,
									false,
								);
								hls.startLoad();
								// Reset stallTicks back to 6 to give full 8 seconds for lower level to buffer
								stallTicksRef.current = 6;
								return;
							}

							// Already at lowest quality rank (currentRank <= 0): engage 3G Data Saver
							if (!hasActivated3GRef.current && !is3GDataSaver) {
								set3GDataSaver?.(true);
								hasActivated3GRef.current = true;
								hls.currentLevel = sortedLevels[0].idx;
								if (hls.config) {
									hls.config.maxBufferLength = 18;
									hls.config.maxMaxBufferLength = 30;
									hls.config.liveSyncDurationCount = 5;
								}
								showToast?.(
									"Activating 3G Data Saver for constrained network...",
									false,
								);
								hls.startLoad();
								stallTicksRef.current = 6;
								return;
							}
						}

						// Single-quality channel: try buffer refresh before failing
						hls?.startLoad();
						return;
					}

					// Level 4: Terminal Fallback or Reconnect Loop (>= 30 seconds)
					// Exhausted all recovery attempts and video is still stalled for 30s!
					if (ticks >= 30) {
						if (hasFallbackMirrors) {
							log.warn(
								"Playback unrecoverable after exhaustive quality & 3G degradation (30s) - cycling to next mirror",
							);
						} else {
							log.warn(
								"Playback unrecoverable on single-source channel (30s) - entering reconnect backoff loop",
							);
						}
						stallTicksRef.current = 0;
						tryNextFallback();
						return;
					}
				} else {
					// Playback is healthy (currentTime advanced)
					stallTicksRef.current = 0;
					healthyTicksRef.current += 1;
					lastTimeRef.current = currentTime;

					// Playback is actively moving forward - cancel any stale reconnect/failover alarms
					resetFailover?.();
					if (useAppStore.getState().toast?.isError) {
						useAppStore.getState().hideToast();
					}

					// If playback has been smooth for 20+ seconds, reset degradation flags for future hiccups
					if (healthyTicksRef.current >= 20) {
						hasSteppedDownQualityRef.current = false;
						hasActivated3GRef.current = false;
					}

					if (bufferSecs >= 10.0) {
						setStreamHealthStatus("good");
					} else if (bufferSecs >= 3.0) {
						setStreamHealthStatus("degraded");
					} else {
						setStreamHealthStatus("critical");
					}
				}
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [
		videoRef,
		hlsRef,
		isPlaying,
		bufferSecs,
		allUrls,
		showToast,
		is3GDataSaver,
		set3GDataSaver,
		setSelectedQualityLevel,
		setIsBuffering,
		incrementStallCount,
		setStreamHealthStatus,
		tryNextFallback,
		resetFailover,
	]);
}
