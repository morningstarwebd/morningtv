// src/hooks/useStreamFailover.ts
// Manages mirror switching, failed stream blacklisting, and exponential backoff reconnection

import { useCallback, useEffect, useRef } from "react";
import type { StreamHealthStatus } from "../types";
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
}

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
	} = options;

	const failedUrlsRef = useRef<Set<string>>(new Set());
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const backoffDelayRef = useRef<number>(10);

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
		backoffDelayRef.current = 10;
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

		if (nextAvailableIndex !== -1) {
			showToast("Switching to backup stream...", false);
			setStreamHealthStatus("degraded");
			setMirrorIndex(nextAvailableIndex);
		} else {
			// All URLs in the pool failed: enter reconnect backoff loop
			const delay = backoffDelayRef.current;
			setStreamHealthStatus("reconnecting");
			showToast(
				`All stream sources failed. Reconnecting in ${delay}s...`,
				true,
			);
			setReconnectCountdown(delay);

			clearReconnectTimers();

			let remaining = delay;
			reconnectIntervalRef.current = setInterval(() => {
				remaining -= 1;
				if (remaining > 0) {
					setReconnectCountdown(remaining);
				} else {
					clearReconnectTimers();
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
		clearReconnectTimers,
	]);

	return { tryNextFallback, resetFailover, clearReconnectTimers };
}
