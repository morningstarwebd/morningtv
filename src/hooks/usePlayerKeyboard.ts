// src/hooks/usePlayerKeyboard.ts
// Keyboard shortcuts and number-key channel tuning for VideoPlayer

import type React from "react";
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { Channel } from "../types";

export interface PlayerKeyboardOptions {
	channels: Channel[];
	containerRef: React.RefObject<HTMLDivElement | null>;
	togglePlayPause: () => void;
	toggleMute: () => void;
	soundBoost: number;
	setSoundBoost: (boost: number) => void;
	cycleAspectRatio: () => void;
	nextChannel: () => void;
	prevChannel: () => void;
	selectChannelByIndex: (index: number) => void;
	openChannelDrawer: () => void;
	openShortcuts: () => void;
	handlePiPRequest: () => void;
}

export function usePlayerKeyboard(options: PlayerKeyboardOptions): {
	channelTuneBanner: string | null;
} {
	const [channelTuneBanner, setChannelTuneBanner] = useState<string | null>(
		null,
	);

	const {
		channels,
		containerRef,
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
	} = options;

	useEffect(() => {
		let bannerTimeout: ReturnType<typeof setTimeout> | null = null;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
				return;
			}

			// Number keys 1-9 for instant channel tuning
			if (/^[1-9]$/.test(e.key)) {
				e.preventDefault();
				const chIdx = parseInt(e.key, 10) - 1;
				if (chIdx < channels.length) {
					selectChannelByIndex(chIdx);
					setChannelTuneBanner(
						`CH ${String(chIdx + 1).padStart(2, "0")}: ${channels[chIdx].name}`,
					);
					if (bannerTimeout) clearTimeout(bannerTimeout);
					bannerTimeout = setTimeout(() => setChannelTuneBanner(null), 2500);
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
					if (!document.fullscreenElement) {
						containerRef.current?.requestFullscreen().catch(() => {});
					} else {
						document.exitFullscreen().catch(() => {});
					}
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
				case "arrowup":
					e.preventDefault();
					useAppStore.getState().increaseVolume();
					break;
				case "arrowdown":
					e.preventDefault();
					useAppStore.getState().decreaseVolume();
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
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			if (bannerTimeout) clearTimeout(bannerTimeout);
		};
	}, [
		channels,
		containerRef,
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

	return { channelTuneBanner };
}
