import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

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

	/**
	 * Checks GitHub Releases for a signed MorningTV update
	 */
	async checkForUpdate(): Promise<{
		hasUpdate: boolean;
		info?: UpdateInfo;
		error?: string;
	}> {
		try {
			const update = await check();
			if (update?.available) {
				this.pendingUpdate = update;
				return {
					hasUpdate: true,
					info: {
						version: update.version,
						body: update.body || "Performance improvements and bug fixes.",
						date: update.date,
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
	 * Clears any pending update state
	 */
	clearPendingUpdate(): void {
		this.pendingUpdate = null;
	}

	/**
	 * Downloads and installs the pending update with real-time progress
	 */
	async downloadAndInstall(
		onProgress?: (percent: number) => void,
	): Promise<void> {
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
