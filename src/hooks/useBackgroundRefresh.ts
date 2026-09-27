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
					// Background-এ refresh — user টের পাবে না
					await invoke("background_refresh_playlist");
				}
			} catch (e) {
				// Silent fail — network না থাকলেও app চলবে
				console.warn("Background refresh failed:", e);
			}
		};

		// App start-এ একবার check (যদি 6h+ আগের cache হয়)
		checkAndRefresh();

		// তারপর প্রতি 6 ঘণ্টায়
		const interval = setInterval(checkAndRefresh, SIX_HOURS);

		// Rust-এর "playlist_updated" event listen করো
		const unlistenPromise = listen("playlist_updated", () => {
			// SQLite already updated — শুধু UI reload করো
			loadChannels();
		});

		return () => {
			clearInterval(interval);
			unlistenPromise.then((fn) => fn());
		};
	}, [loadChannels]);
}
