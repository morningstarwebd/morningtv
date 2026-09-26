// src/stores/appStore.ts
// Central Zustand state store with Next-Level Studio & Cinema UI, 3G Data Saver, and Audio Booster

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type {
	AppSettings,
	AspectRatio,
	Channel,
	QualityLevel,
	QualityTier,
	StreamHealthStatus,
} from "../types";
import { getChannelIdString } from "../types";
import { audioBooster } from "../utils/audioBooster";

interface AppState {
	// Channel & Playlist State
	channels: Channel[];
	categories: string[];
	activeCategory: string;
	providers: string[];
	activeProvider: string;
	searchQuery: string;
	activeChannel: Channel | null;
	setActiveProvider: (provider: string) => void;

	// Playback & Stream State
	isPlaying: boolean;
	volume: number;
	soundBoost: number; // 100 to 300%
	isMuted: boolean;
	bufferSecs: number;
	networkSpeed: string;
	currentQuality: QualityTier;
	is3GDataSaver: boolean;
	mirrorIndex: number;
	currentResolution: string;
	availableQualityLevels: QualityLevel[];
	selectedQualityLevel: number; // -1 for Auto, or level index
	streamHealthStatus: StreamHealthStatus;
	stallCount: number;
	abrTier: QualityTier;
	isChannelLoading: boolean;
	reconnectCountdown: number | null;
	deadChannelIds: string[];
	normalizeAudio: boolean;

	// UI Modes & Modals
	aspectRatio: AspectRatio;
	isChannelDrawerOpen: boolean;
	isQualityPopoverOpen: boolean;
	isYouTubeModalOpen: boolean;
	activeYouTubeVideoId: string | null;
	isSettingsOpen: boolean;
	isShortcutsOpen: boolean;
	ambientGlow: boolean;
	settings: AppSettings | null;
	toast: { message: string; isError: boolean } | null;
	isVerifyingStreams: boolean;

	// Actions
	init: () => Promise<void>;
	verifyAndCleanChannels: () => Promise<void>;
	selectChannel: (channel: Channel) => Promise<void>;
	selectChannelByIndex: (index: number) => Promise<void>;
	nextChannel: () => Promise<void>;
	prevChannel: () => Promise<void>;
	toggleFavorite: (channelId: string) => Promise<void>;
	setCategory: (category: string) => Promise<void>;
	setSearchQuery: (query: string) => Promise<void>;
	togglePlayPause: () => void;
	stopPlayback: () => void;
	setVolume: (volume: number) => void;
	setSoundBoost: (boost: number) => void;
	toggleMute: () => void;
	cycleQuality: () => Promise<void>;
	toggle3GDataSaver: () => void;
	toggleAmbientGlow: () => void;
	cycleAspectRatio: () => void;
	setAspectRatio: (ratio: AspectRatio) => void;
	toggleChannelDrawer: () => void;
	openChannelDrawer: () => void;
	closeChannelDrawer: () => void;
	openSettings: () => void;
	closeSettings: () => void;
	openShortcuts: () => void;
	closeShortcuts: () => void;
	updatePlaylist: (url: string) => Promise<void>;
	resetPlaylist: () => Promise<void>;
	setBufferSecs: (secs: number) => void;
	setNetworkSpeed: (speed: string) => void;
	showToast: (message: string, isError?: boolean) => void;
	hideToast: () => void;
	setMirrorIndex: (index: number) => void;
	cycleMirror: () => void;
	toggleQualityPopover: () => void;
	closeQualityPopover: () => void;
	setAvailableQualityLevels: (levels: QualityLevel[]) => void;
	setSelectedQualityLevel: (level: number) => void;
	setCurrentResolution: (res: string) => void;
	toggleYouTubeModal: () => void;
	openYouTubeModal: (videoId?: string) => void;
	closeYouTubeModal: () => void;
	setYouTubeVideoId: (id: string | null) => void;
	openNativeYouTube: () => Promise<void>;
	openNativeHotstar: () => Promise<void>;
	setStreamHealthStatus: (status: StreamHealthStatus) => void;
	incrementStallCount: () => void;
	resetStallCount: () => void;
	setAbrTier: (tier: QualityTier) => void;
	setIsChannelLoading: (loading: boolean) => void;
	setReconnectCountdown: (countdown: number | null) => void;
	markChannelDead: (channelId: string) => void;
	toggleNormalizeAudio: () => void;
	isSyncing: boolean;
	syncCloudStreams: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
	channels: [],
	categories: ["All", "Favorites"],
	activeCategory: "All",
	providers: ["All"],
	activeProvider: "All",
	searchQuery: "",
	activeChannel: null,

	setActiveProvider: (provider: string) => {
		set({ activeProvider: provider });
	},

	isPlaying: false,
	volume: 85,
	soundBoost: 100,
	isMuted: false,
	bufferSecs: 0,
	networkSpeed: "0 kbps",
	currentQuality: "Auto",
	is3GDataSaver: false, // Default to highest quality adaptive playback
	mirrorIndex: 0,
	currentResolution: "Auto (1080p)",
	availableQualityLevels: [],
	selectedQualityLevel: -1, // -1 means Auto (Adaptive Bitrate)
	streamHealthStatus: "good",
	stallCount: 0,
	abrTier: "Auto",
	isChannelLoading: false,
	reconnectCountdown: null,
	deadChannelIds: [],
	normalizeAudio: false,

	aspectRatio: "16:9",
	isChannelDrawerOpen: false,
	isQualityPopoverOpen: false,
	isYouTubeModalOpen: false,
	activeYouTubeVideoId: null,
	isSettingsOpen: false,
	isShortcutsOpen: false,
	ambientGlow: true,
	settings: null,
	toast: null,
	isVerifyingStreams: false,
	isSyncing: false,

	init: async () => {
		try {
			const [channels, categories, settings] = await Promise.all([
				invoke<Channel[]>("get_channels"),
				invoke<string[]>("get_categories"),
				invoke<AppSettings>("get_settings"),
			]);

			const provSet = new Set<string>();
			channels.forEach((c) => {
				if (c.provider) provSet.add(c.provider);
			});
			const providers = ["All", ...Array.from(provSet)];

			set({
				channels,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				providers: providers.length > 1 ? providers : ["All"],
				settings,
				volume: settings.volume ?? 85,
				isMuted: settings.is_muted ?? false,
				currentQuality: settings.preferred_quality ?? "Auto",
			});

			if (channels.length > 0) {
				let defaultChannel = channels[0];
				if (settings.last_played_channel_id) {
					const match = channels.find(
						(c) => getChannelIdString(c.id) === settings.last_played_channel_id,
					);
					if (match) defaultChannel = match;
				}
				set({
					activeChannel: defaultChannel,
					isPlaying: true,
					isChannelLoading: true,
				});
			}
		} catch (err) {
			console.error("Failed to init app state:", err);
		}
	},

	selectChannel: async (channel: Channel) => {
		// If user clicked the YouTube channel, launch the full native YouTube browser
		if (channel.url.includes("youtube.com") || channel.group === "YouTube") {
			get().openNativeYouTube();
			set({ isChannelDrawerOpen: false });
			return;
		}

		const channelId = getChannelIdString(channel.id);
		// Immediately set activeChannel and isChannelLoading: true for instant UI feedback
		set({
			activeChannel: channel,
			isPlaying: true,
			isChannelLoading: true,
			bufferSecs: 0,
			stallCount: 0,
			streamHealthStatus: "good",
			reconnectCountdown: null,
			isChannelDrawerOpen: false,
			mirrorIndex: 0,
		});
		audioBooster.resume();

		try {
			await invoke("select_channel", { id: channelId });
		} catch (err) {
			console.error("Failed to select channel:", err);
		}
	},

	selectChannelByIndex: async (index: number) => {
		const { channels, selectChannel } = get();
		if (index >= 0 && index < channels.length) {
			await selectChannel(channels[index]);
		}
	},

	nextChannel: async () => {
		const { channels, activeChannel, selectChannel } = get();
		if (!channels.length) return;
		const currentIndex = activeChannel
			? channels.findIndex(
					(c) =>
						getChannelIdString(c.id) === getChannelIdString(activeChannel.id),
				)
			: -1;
		const nextIndex = (currentIndex + 1) % channels.length;
		await selectChannel(channels[nextIndex]);
	},

	prevChannel: async () => {
		const { channels, activeChannel, selectChannel } = get();
		if (!channels.length) return;
		const currentIndex = activeChannel
			? channels.findIndex(
					(c) =>
						getChannelIdString(c.id) === getChannelIdString(activeChannel.id),
				)
			: 0;
		const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
		await selectChannel(channels[prevIndex]);
	},

	toggleFavorite: async (channelId: string) => {
		try {
			const isFav = await invoke<boolean>("toggle_favorite", { id: channelId });
			set((state) => ({
				channels: state.channels.map((ch) =>
					getChannelIdString(ch.id) === channelId
						? { ...ch, is_favorite: isFav }
						: ch,
				),
			}));
		} catch (err) {
			console.error("Failed to toggle favorite:", err);
		}
	},

	setCategory: async (category: string) => {
		try {
			set({ activeCategory: category });
			const filtered = await invoke<Channel[]>("set_category", { category });
			set({ channels: filtered });
		} catch (err) {
			console.error("Failed to set category:", err);
		}
	},

	setSearchQuery: async (query: string) => {
		try {
			set({ searchQuery: query });
			const filtered = await invoke<Channel[]>("search_channels", { query });
			set({ channels: filtered });
		} catch (err) {
			console.error("Failed to search channels:", err);
		}
	},

	togglePlayPause: () => {
		set((state) => {
			const nextPlay = !state.isPlaying;
			if (nextPlay) audioBooster.resume();
			return { isPlaying: nextPlay };
		});
	},

	stopPlayback: () => {
		set({
			isPlaying: false,
			activeChannel: null,
			bufferSecs: 0,
			networkSpeed: "0 kbps",
		});
	},

	setVolume: (volume: number) => {
		set({ volume, isMuted: volume === 0 });
		const { settings } = get();
		if (settings) {
			invoke("save_settings", {
				settings: { ...settings, volume, is_muted: volume === 0 },
			}).catch(console.error);
		}
	},

	setSoundBoost: (boost: number) => {
		const clamped = Math.max(100, Math.min(300, boost));
		set({ soundBoost: clamped });
		audioBooster.setBoost(clamped);
		if (clamped > 100) {
			get().showToast(`🔊 Sound Boost: ${clamped}%`, false);
		}
	},

	toggleMute: () => {
		set((state) => {
			const isMuted = !state.isMuted;
			const { settings } = state;
			if (settings) {
				invoke("save_settings", {
					settings: { ...settings, is_muted: isMuted },
				}).catch(console.error);
			}
			return { isMuted };
		});
	},

	cycleQuality: async () => {
		try {
			const nextQuality = await invoke<QualityTier>("cycle_quality");
			set({ currentQuality: nextQuality });
			get().showToast(`Stream quality set to ${nextQuality}`, false);
		} catch (err) {
			console.error("Failed to cycle quality:", err);
		}
	},

	toggle3GDataSaver: () => {
		set((state) => {
			const next = !state.is3GDataSaver;
			get().showToast(
				next
					? "🚀 3G Ultra Low-Bandwidth Mode Active (~360p/480p Saver)"
					: "3G Mode OFF (Auto HD)",
				false,
			);
			return {
				is3GDataSaver: next,
				selectedQualityLevel: -1,
			};
		});
	},

	toggleAmbientGlow: () =>
		set((state) => ({ ambientGlow: !state.ambientGlow })),

	cycleAspectRatio: () => {
		const current = get().aspectRatio;
		const next: AspectRatio =
			current === "16:9"
				? "4:3"
				: current === "4:3"
					? "fill"
					: current === "fill"
						? "21:9"
						: "16:9";
		set({ aspectRatio: next });
		get().showToast(`Aspect Ratio: ${next.toUpperCase()}`, false);
	},

	setAspectRatio: (ratio: AspectRatio) => {
		set({ aspectRatio: ratio });
		get().showToast(`Aspect Ratio: ${ratio.toUpperCase()}`, false);
	},

	toggleChannelDrawer: () =>
		set((state) => ({ isChannelDrawerOpen: !state.isChannelDrawerOpen })),
	openChannelDrawer: () => set({ isChannelDrawerOpen: true }),
	closeChannelDrawer: () => set({ isChannelDrawerOpen: false }),

	openSettings: () => set({ isSettingsOpen: true }),
	closeSettings: () => set({ isSettingsOpen: false }),

	openShortcuts: () => set({ isShortcutsOpen: true }),
	closeShortcuts: () => set({ isShortcutsOpen: false }),

	updatePlaylist: async (url: string) => {
		try {
			const channels = await invoke<Channel[]>("load_playlist", { url });
			const categories = await invoke<string[]>("get_categories");
			set({
				channels,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				activeCategory: "All",
				isSettingsOpen: false,
			});
			get().showToast("Playlist reloaded successfully!", false);
		} catch (err) {
			get().showToast(`Failed to load playlist: ${err}`, true);
		}
	},

	resetPlaylist: async () => {
		try {
			get().showToast("Restoring default channels...", false);
			const channels = await invoke<Channel[]>("reset_playlist");
			const categories = await invoke<string[]>("get_categories");
			const settings = await invoke<AppSettings>("get_settings");
			set({
				channels,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				activeCategory: "All",
				settings,
				activeChannel: channels[0] || null,
				isSettingsOpen: false,
			});
			get().showToast("✅ Restored default starter channels!", false);
		} catch (err) {
			get().showToast(`Failed to reset playlist: ${err}`, true);
		}
	},

	syncCloudStreams: async () => {
		try {
			set({ isSyncing: true });
			get().showToast("☁️ Fetching latest cloud streams from GitHub...", false);
			const channels = await invoke<Channel[]>("reset_playlist");
			const categories = await invoke<string[]>("get_categories");
			const settings = await invoke<AppSettings>("get_settings");
			set({
				channels,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				activeCategory: "All",
				settings,
				isSyncing: false,
			});
			get().showToast(
				`✅ Synced ${channels.length.toLocaleString()} channels from GitHub!`,
				false,
			);
		} catch (err) {
			set({ isSyncing: false });
			get().showToast(`Failed to sync from GitHub: ${err}`, true);
		}
	},

	verifyAndCleanChannels: async () => {
		set({ isVerifyingStreams: true });
		get().showToast("🔍 Running deep actual stream verification...", false);
		try {
			const summary = await invoke<{
				total_scanned: number;
				alive_channels: number;
				dead_channels_removed: number;
				links_auto_updated: number;
			}>("verify_and_clean_channels");

			const [channels, categories] = await Promise.all([
				invoke<Channel[]>("get_channels"),
				invoke<string[]>("get_categories"),
			]);

			set({
				channels,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				isVerifyingStreams: false,
			});

			get().showToast(
				`✅ Verified! ${summary.dead_channels_removed} dead removed, ${summary.links_auto_updated} links updated. ${summary.alive_channels} playable channels ready.`,
				false,
			);
		} catch (err) {
			set({ isVerifyingStreams: false });
			get().showToast(`Verification failed: ${err}`, true);
		}
	},

	setBufferSecs: (secs: number) => set({ bufferSecs: secs }),
	setNetworkSpeed: (speed: string) => set({ networkSpeed: speed }),

	showToast: (message: string, isError = false) => {
		set({ toast: { message, isError } });
		setTimeout(() => {
			set((state) => (state.toast?.message === message ? { toast: null } : {}));
		}, 3500);
	},

	hideToast: () => set({ toast: null }),

	setMirrorIndex: (index: number) => {
		set({ mirrorIndex: index });
	},

	cycleMirror: () => {
		const { activeChannel, mirrorIndex, showToast } = get();
		if (!activeChannel) return;
		const allUrls = [activeChannel.url, ...(activeChannel.fallback_urls || [])];
		if (allUrls.length <= 1) return;
		const nextIndex = (mirrorIndex + 1) % allUrls.length;
		set({ mirrorIndex: nextIndex });
		showToast(
			`Connecting to Server ${nextIndex + 1}/${allUrls.length}...`,
			false,
		);
	},

	toggleQualityPopover: () =>
		set((state) => ({ isQualityPopoverOpen: !state.isQualityPopoverOpen })),

	closeQualityPopover: () => set({ isQualityPopoverOpen: false }),

	setAvailableQualityLevels: (levels: QualityLevel[]) =>
		set({ availableQualityLevels: levels }),

	setSelectedQualityLevel: (level: number) => {
		set({ selectedQualityLevel: level });
		const { availableQualityLevels, showToast } = get();
		if (level === -1) {
			showToast("Quality: Auto (Adaptive ABR)", false);
		} else {
			const match = availableQualityLevels.find((l) => l.index === level);
			showToast(`Quality locked: ${match?.label || `Level ${level}`}`, false);
		}
	},

	setCurrentResolution: (res: string) => set({ currentResolution: res }),

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

	openNativeYouTube: async () => {
		try {
			get().showToast("🌐 Opening official YouTube (youtube.com)...", false);
			const { isPlaying } = get();
			if (isPlaying) {
				set({ isPlaying: false });
			}
			await invoke("open_youtube");
		} catch (err) {
			console.error("Failed to open YouTube:", err);
			get().showToast(`Failed to open YouTube: ${err}`, true);
		}
	},

	openNativeHotstar: async () => {
		try {
			get().showToast("⭐ Opening JioHotstar Live Stream...", false);
			const { isPlaying } = get();
			if (isPlaying) set({ isPlaying: false });
			await invoke("open_hotstar");
		} catch (err) {
			console.error("Failed to open Hotstar:", err);
			get().showToast(`Failed to open Hotstar: ${err}`, true);
		}
	},

	setStreamHealthStatus: (status: StreamHealthStatus) =>
		set({ streamHealthStatus: status }),

	incrementStallCount: () =>
		set((state) => ({ stallCount: state.stallCount + 1 })),

	resetStallCount: () => set({ stallCount: 0 }),

	setAbrTier: (tier: QualityTier) => set({ abrTier: tier }),

	setIsChannelLoading: (loading: boolean) => set({ isChannelLoading: loading }),

	setReconnectCountdown: (countdown: number | null) =>
		set({ reconnectCountdown: countdown }),

	markChannelDead: (channelId: string) =>
		set((state) => ({
			deadChannelIds: state.deadChannelIds.includes(channelId)
				? state.deadChannelIds
				: [...state.deadChannelIds, channelId],
		})),

	toggleNormalizeAudio: () => {
		const next = !get().normalizeAudio;
		set({ normalizeAudio: next });
		audioBooster.setNormalize(next);
		get().showToast(
			next ? "🔊 Channel Audio Normalization ON" : "Audio Normalization OFF",
			false,
		);
	},
}));
