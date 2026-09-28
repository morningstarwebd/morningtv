// src/stores/updateStore.ts
// Tauri updater lifecycle, progress tracking, and app relaunch

import { create } from "zustand";
import {
	type UpdateInfo,
	type UpdateStatus,
	updaterService,
} from "../services/updaterService.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("UpdateStore");

export interface UpdateState {
	updateInfo: UpdateInfo | null;
	updateStatus: UpdateStatus;
	updateProgress: number;
	isUpdateModalOpen: boolean;
	isCheckingUpdate: boolean;

	// Actions
	setUpdateModalOpen: (open: boolean) => void;
	checkForUpdates: (
		manual?: boolean,
		onToast?: (msg: string, isError?: boolean) => void,
	) => Promise<void>;
	startDownloadUpdate: (
		onToast?: (msg: string, isError?: boolean) => void,
	) => Promise<void>;
	dismissUpdate: () => void;
	relaunchApp: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
	updateInfo: null,
	updateStatus: "idle",
	updateProgress: 0,
	isUpdateModalOpen: false,
	isCheckingUpdate: false,

	setUpdateModalOpen: (open: boolean) => set({ isUpdateModalOpen: open }),

	checkForUpdates: async (manual = false, onToast) => {
		set({ isCheckingUpdate: true, updateStatus: "checking" });
		try {
			const res = await updaterService.checkForUpdate();
			set({ isCheckingUpdate: false });
			if (res.hasUpdate && res.info) {
				set({ updateInfo: res.info, updateStatus: "available" });
			} else {
				set({ updateStatus: "upToDate" });
				if (manual) {
					if (res.error) {
						onToast?.(`Update check failed: ${res.error}`, true);
					} else {
						onToast?.("✅ MorningTV is completely up to date! (v1.0.0)");
					}
				}
				setTimeout(() => {
					if (get().updateStatus === "upToDate") {
						set({ updateStatus: "idle" });
					}
				}, 4000);
			}
		} catch (e: unknown) {
			set({ isCheckingUpdate: false, updateStatus: "error" });
			if (manual) {
				const msg = e instanceof Error ? e.message : String(e);
				onToast?.(`Update check failed: ${msg}`, true);
			}
			setTimeout(() => {
				if (get().updateStatus === "error") {
					set({ updateStatus: "idle" });
				}
			}, 4000);
		}
	},

	startDownloadUpdate: async (onToast) => {
		const { updateInfo } = get();
		if (!updateInfo) return;
		set({ updateStatus: "downloading", updateProgress: 0 });
		try {
			await updaterService.downloadAndInstall((pct) => {
				set({ updateProgress: pct });
			});
			set({ updateStatus: "ready", updateProgress: 100 });
			onToast?.("🎉 Update downloaded! Restart to apply changes.", false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			set({ updateStatus: "error" });
			onToast?.(`Update download failed: ${msg}`, true);
		}
	},

	dismissUpdate: () => {
		updaterService.clearPendingUpdate();
		set({ updateInfo: null, updateStatus: "idle", updateProgress: 0 });
	},

	relaunchApp: async () => {
		try {
			await updaterService.relaunchApp();
		} catch (err) {
			log.error("Failed to relaunch application", { error: err });
			window.location.reload();
		}
	},
}));
