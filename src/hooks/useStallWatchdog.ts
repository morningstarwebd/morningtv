// src/hooks/useStallWatchdog.ts
// Intelligent multi-tier stall detection, micro-nudge recovery, and fallback cascade

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
		setIsBuffering,
		incrementStallCount,
		setStreamHealthStatus,
		tryNextFallback,
	} = options;

	const lastTimeRef = useRef<number>(0);
	const stallTicksRef = useRef<number>(0);

	useEffect(() => {
		const interval = setInterval(() => {
			const video = videoRef.current;
			if (!video) return;

			const currentTime = video.currentTime;
			if (isPlaying && !video.paused && !video.ended) {
				// Buffer starvation guard: auto-cap to lowest level if under 2.5s
				if (bufferSecs > 0 && bufferSecs < 2.5 && hlsRef.current) {
					if (hlsRef.current.currentLevel > 0) {
						hlsRef.current.autoLevelCapping = 0;
						hlsRef.current.currentLevel = 0;
						setStreamHealthStatus("degraded");
					}
				}

				if (currentTime === lastTimeRef.current && currentTime > 0) {
					stallTicksRef.current += 1;
					const ticks = stallTicksRef.current;

					// 3s stall: downshift to lowest bitrate level
					if (ticks === 3) {
						log.warn(
							"Playback stall detected (3s) - forcing lowest quality tier",
						);
						if (hlsRef.current && hlsRef.current.currentLevel > 0) {
							hlsRef.current.currentLevel = 0;
						}
						hlsRef.current?.startLoad();
						setIsBuffering(true);
						incrementStallCount();
						setStreamHealthStatus("stalled");
					}

					// 6s stall: nudge video element forward (+0.15s) to bypass corrupt timestamp
					if (ticks === 6) {
						log.warn(
							"Playback stall persists (6s) - nudging video timestamp forward",
						);
						try {
							video.currentTime += 0.15;
							hlsRef.current?.startLoad();
						} catch {
							// Ignored
						}
					}

					// 9s stall: trigger internal HLS media error recovery
					if (ticks === 9) {
						log.warn(
							"Playback stall critical (9s) - triggering media error recovery",
						);
						hlsRef.current?.recoverMediaError();
						hlsRef.current?.startLoad();
					}

					// 14s stall: persistent freeze, cycle to next mirror
					if (ticks >= 14) {
						log.error(
							"Playback freeze unrecoverable (14s) - failing over to backup mirror",
						);
						stallTicksRef.current = 0;
						tryNextFallback();
					}
				} else {
					stallTicksRef.current = 0;
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

		return () => clearInterval(interval);
	}, [
		videoRef,
		hlsRef,
		isPlaying,
		bufferSecs,
		setIsBuffering,
		incrementStallCount,
		setStreamHealthStatus,
		tryNextFallback,
	]);
}
