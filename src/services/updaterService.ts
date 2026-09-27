import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
	version: string;
	body?: string;
	date?: string;
	isVirtual?: boolean;
}

export type UpdateStatus =
	| "idle"
	| "checking"
	| "available"
	| "upToDate"
	| "downloading"
	| "ready"
	| "error";

class UpdaterService {
	private pendingUpdate: Update | null = null;
	private isVirtualPending = false;

	/**
	 * Checks GitHub Releases for a signed MorningTV update
	 */
	async checkForUpdate(): Promise<{ hasUpdate: boolean; info?: UpdateInfo; error?: string }> {
		try {
			this.isVirtualPending = false;
			const update = await check();
			if (update?.available) {
				this.pendingUpdate = update;
				return {
					hasUpdate: true,
					info: {
						version: update.version,
						body: update.body || "Performance improvements and bug fixes.",
						date: update.date,
						isVirtual: false,
					},
				};
			}
			this.pendingUpdate = null;
			return { hasUpdate: false };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn("[Updater] Update check failed:", message);
			return { hasUpdate: false, error: message };
		}
	}

	/**
	 * Returns a realistic simulated update info for local testing
	 */
	getVirtualUpdate(): UpdateInfo {
		this.isVirtualPending = true;
		this.pendingUpdate = null;
		return {
			version: "1.1.0",
			date: "Latest Release",
			body: `• Ultra-Fast 4K HLS Engine: Sub-second channel switching & zero-stall buffer
• Enhanced Cinema Ambilight: 60fps dynamic ambient aura reacting to video frames
• Smart Volume Leveling: Hardware dynamic limiter prevents sudden audio blasts
• 200+ Verified Channels: Fresh community-verified live news, sports & music streams
• Zero-Freeze Auto-Failover: Instant automated switch to backup mirrors`,
			isVirtual: true,
		};
	}

	/**
	 * Clears any pending update state
	 */
	clearPendingUpdate(): void {
		this.pendingUpdate = null;
		this.isVirtualPending = false;
	}

	/**
	 * Downloads and installs the pending update with real-time progress
	 */
	async downloadAndInstall(onProgress?: (percent: number) => void): Promise<void> {
		if (this.isVirtualPending) {
			// Simulate smooth realistic download for testing
			for (let pct = 0; pct <= 100; pct += 5) {
				await new Promise((r) => setTimeout(r, 100));
				onProgress?.(pct);
			}
			return;
		}

		if (!this.pendingUpdate) {
			throw new Error("No update ready to download.");
		}

		let downloaded = 0;
		let total = 0;

		await this.pendingUpdate.downloadAndInstall((event) => {
			switch (event.event) {
				case "Started":
					total = event.data.contentLength || 0;
					onProgress?.(0);
					break;
				case "Progress":
					downloaded += event.data.chunkLength;
					if (total > 0) {
						const pct = Math.min(100, Math.round((downloaded / total) * 100));
						onProgress?.(pct);
					}
					break;
				case "Finished":
					onProgress?.(100);
					break;
			}
		});
	}

	/**
	 * Relaunches application to apply installed update
	 */
	async relaunchApp(): Promise<void> {
		try {
			await relaunch();
		} catch (err) {
			console.warn("[Updater] Relaunch failed, reloading window:", err);
			window.location.reload();
		}
	}
}

export const updaterService = new UpdaterService();
