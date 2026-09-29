// src/hooks/useStallWatchdog.ts
// Production-grade resilient stall detection and non-destructive recovery

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
				if (currentTime === lastTimeRef.current && currentTime > 0) {
					stallTicksRef.current += 1;
					const ticks = stallTicksRef.current;

					// 5s stall: gentle buffer load reload without clearing MSE or forcing quality changes
					if (ticks === 5) {
						log.info(
							"Playback stall detected (5s) - triggering gentle startLoad()",
						);
						hlsRef.current?.startLoad();
						setIsBuffering(true);
						incrementStallCount();
						setStreamHealthStatus("stalled");
					}

					// 16s persistent stall: genuine stream outage, cycle to fallback mirror
					if (ticks >= 16) {
						log.warn(
							"Playback unrecoverable after 16s - cycling to next mirror",
						);
						stallTicksRef.current = 0;
						tryNextFallback();
					}
				} else {
					stallTicksRef.current = 0;
					lastTimeRef.current = currentTime;
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
		setIsBuffering,
		incrementStallCount,
		setStreamHealthStatus,
		tryNextFallback,
	]);
}
