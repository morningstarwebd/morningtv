// src/hooks/useStallWatchdog.ts
// Production-grade resilient stall detection and smart tiered adaptation engine

import type Hls from "hls.js";
import type React from "react";
import { useEffect, useRef } from "react";
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
					// Channel just tuned, waiting for first video frame to render
					// ==============================================================
					if (currentTime === 0) {
						if (ticks === 3) {
							// Gentle startLoad after 3s initial handshake
							hls?.startLoad();
						} else if (ticks === 6) {
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
								log.warn(
									"Initial playback failed to start after 6s - switching to next mirror",
								);
								stallTicksRef.current = 0;
								tryNextFallback();
								return;
							}
						} else if (ticks >= 9) {
							// For single-URL channels with no mirrors: trigger clean reconnect loop
							log.warn(
								"Initial playback unrecoverable on single-source channel - triggering reconnect",
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

					// Level 1: Gentle In-Place Buffer Recovery (4 seconds)
					if (ticks === 4) {
						log.info(
							"Playback stall detected (4s) - triggering gentle startLoad()",
						);
						hls?.startLoad();
						setIsBuffering(true);
						incrementStallCount();
						setStreamHealthStatus("stalled");
						return;
					}

					// Level 2 & 3: Smart Progressive Quality Step-Down & 3G Adaptation (7 seconds)
					if (ticks === 7) {
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
								// Reset stallTicks back to 4 to give 3 full seconds for this lower level to recover
								stallTicksRef.current = 4;
								return;
							}

							// Already at lowest quality rank (currentRank <= 0): engage 3G Data Saver
							if (!hasActivated3GRef.current && !is3GDataSaver) {
								set3GDataSaver?.(true);
								hasActivated3GRef.current = true;
								hls.currentLevel = sortedLevels[0].idx;
								if (hls.config) {
									hls.config.maxBufferLength = 12;
									hls.config.maxMaxBufferLength = 24;
									hls.config.liveSyncDurationCount = 5;
								}
								showToast?.(
									"Activating 3G Data Saver for constrained network...",
									false,
								);
								hls.startLoad();
								stallTicksRef.current = 4;
								return;
							}
						}

						// Single-quality channel (levels.length <= 1):
						// Cannot step down quality. If backup mirrors exist, switch immediately to next mirror!
						if (!hasMultipleQualities && hasFallbackMirrors) {
							log.warn(
								"Single-quality stream stalled after buffer reload - switching to next mirror",
							);
							stallTicksRef.current = 0;
							tryNextFallback();
							return;
						}

						// Single-quality and Single-URL: try another buffer refresh
						hls?.startLoad();
						return;
					}

					// Level 4: Terminal Fallback or Reconnect Loop (>= 11 seconds)
					// Exhausted: gentle reload -> step down quality -> lowest level -> 3G mode,
					// and video is still stalled!
					if (ticks >= 11) {
						if (hasFallbackMirrors) {
							log.warn(
								"Playback unrecoverable after exhaustive quality & 3G degradation - cycling to next mirror",
							);
						} else {
							log.warn(
								"Playback unrecoverable on single-source channel - entering reconnect backoff loop",
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
	]);
}
