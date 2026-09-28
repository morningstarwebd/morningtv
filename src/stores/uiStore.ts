// src/stores/uiStore.ts
// Modals, drawers, shortcuts, toast notifications, ambient glow, and native webview popouts

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { AppSettings } from "../types";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("UiStore");

export interface UiState {
	isChannelDrawerOpen: boolean;
	isQualityPopoverOpen: boolean;
	isYouTubeModalOpen: boolean;
	activeYouTubeVideoId: string | null;
	isSettingsOpen: boolean;
	isShortcutsOpen: boolean;
	ambientGlow: boolean;
	settings: AppSettings | null;
	toast: { message: string; isError: boolean } | null;

	// Actions
	toggleChannelDrawer: () => void;
	openChannelDrawer: () => void;
	closeChannelDrawer: () => void;
	toggleQualityPopover: () => void;
	closeQualityPopover: () => void;
	toggleYouTubeModal: () => void;
	openYouTubeModal: (videoId?: string) => void;
	closeYouTubeModal: () => void;
	setYouTubeVideoId: (id: string | null) => void;
	openSettings: () => void;
	closeSettings: () => void;
	openShortcuts: () => void;
	closeShortcuts: () => void;
	toggleAmbientGlow: () => void;
	setSettings: (settings: AppSettings | null) => void;
	showToast: (message: string, isError?: boolean) => void;
	hideToast: () => void;
	openNativeYouTube: () => Promise<void>;
	openNativeHotstar: () => Promise<void>;
}

export const useUiStore = create<UiState>((set, get) => ({
	isChannelDrawerOpen: false,
	isQualityPopoverOpen: false,
	isYouTubeModalOpen: false,
	activeYouTubeVideoId: null,
	isSettingsOpen: false,
	isShortcutsOpen: false,
	ambientGlow: true,
	settings: null,
	toast: null,

	toggleChannelDrawer: () =>
		set((state) => ({ isChannelDrawerOpen: !state.isChannelDrawerOpen })),
	openChannelDrawer: () => set({ isChannelDrawerOpen: true }),
	closeChannelDrawer: () => set({ isChannelDrawerOpen: false }),

	toggleQualityPopover: () =>
		set((state) => ({ isQualityPopoverOpen: !state.isQualityPopoverOpen })),
	closeQualityPopover: () => set({ isQualityPopoverOpen: false }),

	toggleYouTubeModal: () =>
		set((state) => ({ isYouTubeModalOpen: !state.isYouTubeModalOpen })),
	openYouTubeModal: (videoId?: string) =>
		set({
			isYouTubeModalOpen: true,
			activeYouTubeVideoId: videoId || null,
			isChannelDrawerOpen: false,
		}),
	closeYouTubeModal: () =>
		set({ isYouTubeModalOpen: false, activeYouTubeVideoId: null }),
	setYouTubeVideoId: (id: string | null) => set({ activeYouTubeVideoId: id }),

	openSettings: () => set({ isSettingsOpen: true }),
	closeSettings: () => set({ isSettingsOpen: false }),

	openShortcuts: () => set({ isShortcutsOpen: true }),
	closeShortcuts: () => set({ isShortcutsOpen: false }),

	toggleAmbientGlow: () =>
		set((state) => ({ ambientGlow: !state.ambientGlow })),

	setSettings: (settings: AppSettings | null) => set({ settings }),

	showToast: (message: string, isError = false) => {
		set({ toast: { message, isError } });
		setTimeout(() => {
			set((state) => (state.toast?.message === message ? { toast: null } : {}));
		}, 3500);
	},

	hideToast: () => set({ toast: null }),

	openNativeYouTube: async () => {
		try {
			get().showToast("🌐 Opening official YouTube (youtube.com)...", false);
			await invoke("open_youtube");
		} catch (err) {
			log.error("Failed to open YouTube", { error: err });
			get().showToast(`Failed to open YouTube: ${err}`, true);
		}
	},

	openNativeHotstar: async () => {
		try {
			get().showToast("⭐ Opening JioHotstar Live Stream...", false);
			await invoke("open_hotstar");
		} catch (err) {
			log.error("Failed to open Hotstar", { error: err });
			get().showToast(`Failed to open Hotstar: ${err}`, true);
		}
	},
}));
