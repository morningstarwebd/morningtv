import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function useBackgroundRefresh() {
	const loadChannels = useAppStore((s) => s.loadChannels);

	useEffect(() => {
		// Update check function
		const checkAndRefresh = async () => {
			try {
				const hasUpdate = await invoke<boolean>("check_playlist_update");

				if (hasUpdate) {
					// Background refresh without interrupting playback
					await invoke("background_refresh_playlist");
				}
			} catch (e) {
				// Silent fail: app continues playing if network is unreachable
				console.warn("Background refresh failed:", e);
			}
		};

		// Initial check if cached data is stale
		checkAndRefresh();

		// Check every 6 hours
		const interval = setInterval(checkAndRefresh, SIX_HOURS);

		// Listen to Rust playlist_updated event
		const unlistenPromise = listen("playlist_updated", () => {
			// SQLite updated: reload UI state
			loadChannels();
		});

		return () => {
			clearInterval(interval);
			unlistenPromise.then((fn) => fn());
		};
	}, [loadChannels]);
}
