// src/hooks/useStreamFailover.ts
// Manages mirror switching, failed stream blacklisting, and exponential backoff reconnection

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";
import type { Channel, StreamHealthStatus } from "../types";
import { createLogger } from "../utils/logger";

const log = createLogger("StreamFailover");

export interface StreamFailoverOptions {
	activeChannelId?: string;
	allUrls: string[];
	currentUrl: string;
	mirrorIndex: number;
	setMirrorIndex: (index: number) => void;
	cycleMirror: () => void;
	showToast: (message: string, isError: boolean) => void;
	setStreamHealthStatus: (status: StreamHealthStatus) => void;
	setReconnectCountdown: (countdown: number | null) => void;
	videoRef?: React.RefObject<HTMLVideoElement | null>;
}

const INITIAL_BACKOFF_DELAY_SECS = 10;

export function useStreamFailover(options: StreamFailoverOptions): {
	tryNextFallback: () => void;
	resetFailover: () => void;
	clearReconnectTimers: () => void;
} {
	const {
		activeChannelId,
		allUrls,
		currentUrl,
		mirrorIndex,
		setMirrorIndex,
		cycleMirror,
		showToast,
		setStreamHealthStatus,
		setReconnectCountdown,
		videoRef,
	} = options;

	const failedUrlsRef = useRef<Set<string>>(new Set());
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const backoffDelayRef = useRef<number>(INITIAL_BACKOFF_DELAY_SECS);

	const clearReconnectTimers = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		if (reconnectIntervalRef.current) {
			clearInterval(reconnectIntervalRef.current);
			reconnectIntervalRef.current = null;
		}
		setReconnectCountdown(null);
	}, [setReconnectCountdown]);

	const resetFailover = useCallback(() => {
		failedUrlsRef.current.clear();
		backoffDelayRef.current = INITIAL_BACKOFF_DELAY_SECS;
		clearReconnectTimers();
	}, [clearReconnectTimers]);

	// Clear timers and reset failed set on active channel change
	useEffect(() => {
		resetFailover();
	}, [activeChannelId, resetFailover]);

	const tryNextFallback = useCallback(() => {
		if (allUrls.length === 0) return;

		// Mark current URL as failed in blacklist
		if (currentUrl) {
			failedUrlsRef.current.add(currentUrl);
			log.warn("Current stream URL failed, adding to blacklist", {
				currentUrl,
			});
		}

		// Find next URL in mirror list that has not failed
		const nextAvailableIndex = allUrls.findIndex(
			(url, idx) => idx !== mirrorIndex && !failedUrlsRef.current.has(url),
		);

		if (allUrls.length > 1 && nextAvailableIndex !== -1) {
			showToast(
				`Switching to backup mirror (${nextAvailableIndex + 1}/${allUrls.length})...`,
				false,
			);
			setStreamHealthStatus("degraded");
			// Reset manual quality lock so the new mirror initializes cleanly in Auto ABR mode
			useAppStore.getState().setSelectedQualityLevel(-1);
			setMirrorIndex(nextAvailableIndex);
		} else {
			// Trigger JIT Self-Healing from GitHub / Backup mirrors
			if (activeChannelId) {
				invoke<Channel | null>("heal_channel", { channelId: activeChannelId })
					.then((healed) => {
						if (healed?.url && healed.url !== currentUrl) {
							log.info("Stream automatically healed via JIT Sentinel", {
								healedUrl: healed.url,
							});
							showToast(
								"Stream signal automatically healed! Resuming...",
								false,
							);
							clearReconnectTimers();
							failedUrlsRef.current.clear();
							useAppStore.getState().selectChannel(healed);
						}
					})
					.catch(() => {});
			}

			// All URLs in the pool failed (or channel has only 1 URL): enter reconnect backoff loop
			const delay = backoffDelayRef.current;
			setStreamHealthStatus("reconnecting");
			const message =
				allUrls.length > 1
					? `All ${allUrls.length} stream mirrors unavailable. Reconnecting in ${delay}s...`
					: `Stream signal interrupted. Reconnecting in ${delay}s...`;
			showToast(message, true);
			setReconnectCountdown(delay);

			clearReconnectTimers();

			let remaining = delay;
			reconnectIntervalRef.current = setInterval(() => {
				const video = videoRef?.current;
				if (video && !video.paused && video.currentTime > 0) {
					// Playback recovered while in countdown! Cancel failover immediately!
					log.info(
						"Playback recovered during reconnect countdown - cancelling reconnect",
					);
					clearReconnectTimers();
					failedUrlsRef.current.clear();
					setStreamHealthStatus("good");
					if (useAppStore.getState().toast?.isError) {
						useAppStore.getState().hideToast();
					}
					return;
				}

				remaining -= 1;
				if (remaining > 0) {
					setReconnectCountdown(remaining);
				} else {
					clearReconnectTimers();
				}
			}, 1000);

			reconnectTimerRef.current = setTimeout(() => {
				const video = videoRef?.current;
				if (video && !video.paused && video.currentTime > 0) {
					log.info("Stream already playing - skipping reconnect timer trigger");
					clearReconnectTimers();
					setStreamHealthStatus("good");
					return;
				}

				failedUrlsRef.current.clear();
				// Exponential backoff: 10s -> 20s -> 40s (capped at 60s)
				backoffDelayRef.current = Math.min(60, delay * 2);
				showToast(
					allUrls.length > 1
						? "Retrying stream mirrors..."
						: "Reconnecting to stream...",
					false,
				);
				setStreamHealthStatus("degraded");
				cycleMirror();
			}, delay * 1000);
		}
	}, [
		activeChannelId,
		allUrls,
		currentUrl,
		mirrorIndex,
		setMirrorIndex,
		cycleMirror,
		showToast,
		setStreamHealthStatus,
		setReconnectCountdown,
		clearReconnectTimers,
		videoRef,
	]);

	return { tryNextFallback, resetFailover, clearReconnectTimers };
}
