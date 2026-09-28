// src/hooks/useStreamTelemetry.ts
// Calculates real-time video playback telemetry (buffer, FPS, dropped frames, live latency)

import type Hls from "hls.js";
import type React from "react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

export interface StreamTelemetryOptions {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	hlsRef: React.RefObject<Hls | null>;
	setBufferSecs: (secs: number) => void;
	setTelemetryStats: (
		stats: Parameters<
			ReturnType<typeof useAppStore.getState>["setTelemetryStats"]
		>[0],
	) => void;
}

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

			// 1. Buffer seconds
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

			const roundedBuffer = Math.round(bufferSecs * 10) / 10;
			useAppStore.getState().setBufferSecs(roundedBuffer);

			// Buffer Starvation Guard: If buffer dips under 2.0s, tighten buffer window
			if (bufferSecs > 0 && bufferSecs < 2.0 && hlsRef.current) {
				if (hlsRef.current.config.maxBufferLength > 8) {
					hlsRef.current.config.maxBufferLength = 8;
				}
			}

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
		}, 1000);

		return () => clearInterval(timer);
	}, [videoRef, hlsRef]);
}
