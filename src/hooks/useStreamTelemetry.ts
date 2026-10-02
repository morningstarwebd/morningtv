// src/hooks/useStreamTelemetry.ts
// Calculates real-time video playback telemetry (buffer, FPS, dropped frames, live latency)

import type Hls from "hls.js";
import type React from "react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

export function useStreamTelemetry(
	videoRef: React.RefObject<HTMLVideoElement | null>,
	hlsRef: React.RefObject<Hls | null>,
): void {
	const lastQualityRef = useRef<{ totalFrames: number; time: number } | null>(
		null,
	);

	useEffect(() => {
		const timer = setInterval(() => {
			const video = videoRef.current;
			if (!video) return;

			// 1. Resilient buffer calculation (HLS.js forward buffer + HTML5 MediaSource TimeRanges)
			let bufferSecs = 0;
			const hls = hlsRef.current as any;
			if (
				hls?.mainForwardBufferInfo &&
				typeof hls.mainForwardBufferInfo.len === "number"
			) {
				bufferSecs = Math.max(0, hls.mainForwardBufferInfo.len);
			}

			if (bufferSecs <= 0.1 && video.buffered && video.buffered.length > 0) {
				const cur = video.currentTime;
				const maxHole = 0.8;

				for (let i = 0; i < video.buffered.length; i++) {
					const start = video.buffered.start(i);
					const end = video.buffered.end(i);
					if (cur >= start - maxHole && cur <= end + 0.1) {
						bufferSecs = Math.max(0, end - Math.max(cur, start));
						let currentEnd = end;
						for (let j = i + 1; j < video.buffered.length; j++) {
							const nextStart = video.buffered.start(j);
							const nextEnd = video.buffered.end(j);
							if (nextStart - currentEnd <= maxHole) {
								bufferSecs += nextEnd - nextStart;
								currentEnd = nextEnd;
							} else {
								break;
							}
						}
						break;
					}
				}

				if (bufferSecs <= 0.1) {
					for (let i = 0; i < video.buffered.length; i++) {
						const start = video.buffered.start(i);
						const end = video.buffered.end(i);
						if (end > cur) {
							bufferSecs = Math.max(bufferSecs, end - Math.max(cur, start));
						}
					}
					if (bufferSecs <= 0.1 && video.buffered.length > 0) {
						const lastIdx = video.buffered.length - 1;
						bufferSecs = Math.max(
							0,
							video.buffered.end(lastIdx) - video.buffered.start(0),
						);
					}
				}
			}

			const roundedBuffer = Math.round(bufferSecs * 10) / 10;
			useAppStore.getState().setBufferSecs(roundedBuffer);

			// 2. Hardware decoded resolution detection
			if (video.videoWidth > 0 && video.videoHeight > 0) {
				const detectedRes = `${video.videoHeight}p (${video.videoWidth}×${video.videoHeight})`;
				if (useAppStore.getState().currentResolution !== detectedRes) {
					useAppStore.getState().setCurrentResolution(detectedRes);
				}
			}

			// 3. Decoded FPS & dropped frames from hardware media decoder
			let currentFps = 0;
			let droppedFrames = 0;
			let totalFrames = 0;
			const videoAny = video as HTMLVideoElement & {
				getVideoPlaybackQuality?: () => {
					droppedVideoFrames?: number;
					totalVideoFrames?: number;
				};
			};

			if (typeof videoAny.getVideoPlaybackQuality === "function") {
				const q = videoAny.getVideoPlaybackQuality();
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

			// 4. Live Edge Latency (in seconds)
			let liveLatency = 0;
			if (hlsRef.current?.liveSyncPosition && video.currentTime > 0) {
				liveLatency = Math.max(
					0,
					Math.round(
						(hlsRef.current.liveSyncPosition - video.currentTime) * 10,
					) / 10,
				);
			} else if (
				video.duration &&
				Number.isFinite(video.duration) &&
				video.currentTime > 0
			) {
				liveLatency = Math.max(
					0,
					Math.round((video.duration - video.currentTime) * 10) / 10,
				);
			}

			useAppStore.getState().setTelemetryStats({
				currentFps,
				droppedFrames,
				totalFrames,
				liveLatency,
			});
		}, 500);

		return () => clearInterval(timer);
	}, [videoRef, hlsRef]);
}
