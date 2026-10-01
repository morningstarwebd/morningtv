// src/stores/appStore.ts
// Central Zustand state store with Next-Level Studio & Cinema UI, 3G Data Saver, and Audio Booster

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import {
	type UpdateInfo,
	type UpdateStatus,
	updaterService,
} from "../services/updaterService";
import type {
	AppSettings,
	AspectRatio,
	Channel,
	QualityLevel,
	QualityTier,
	StreamHealthStatus,
} from "../types";
import { APP_VERSION, formatIpcError, getChannelIdString } from "../types";
import { audioBooster } from "../utils/audioBooster";
import { filterChannelsClient } from "../utils/channelFilter";
import { createLogger } from "../utils/logger";

const log = createLogger("AppStore");

interface AppState {
	// Channel & Playlist State
	allChannels: Channel[];
	channels: Channel[];
	totalChannels: number;
	categories: string[];
	activeCategory: string;
	providers: string[];
	activeProvider: string;
	searchQuery: string;
	refreshTotalChannelCount: () => Promise<void>;
	activeChannel: Channel | null;
	setActiveProvider: (provider: string) => void;

	// Playback & Stream State
	isPlaying: boolean;
	volume: number;
	soundBoost: number; // 100 to 300%
	isMuted: boolean;
	bufferSecs: number;
	networkSpeed: string;
	nominalBitrate: string;
	downloadBandwidth: string;
	downloadSpeedFormatted: string; // e.g. "2.84 MB/s" (divided by 8, mobile style)
	downloadSpeedMbps: string; // e.g. "22.7 Mbps"
	streamBitrateFormatted: string; // e.g. "317.4 KB/s"
	streamBitrateMbps: string; // e.g. "2.6 Mbps"
	bandwidthCapacityFormatted: string; // e.g. "4.25 MB/s"
	bandwidthCapacityMbps: string; // e.g. "34.0 Mbps"
	currentFps: number;
	droppedFrames: number;
	totalFrames: number;
	liveLatency: number;
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
	isLaunchAtStartup: boolean;
	toast: { message: string; isError: boolean } | null;

	// Actions
	init: () => Promise<void>;
	fetchStartupStatus: () => Promise<void>;
	toggleStartupStatus: (enabled: boolean) => Promise<void>;
	openGitHubRepo: () => Promise<void>;
	selectChannel: (channel: Channel) => Promise<void>;
	selectChannelByIndex: (index: number) => Promise<void>;
	nextChannel: () => Promise<void>;
	prevChannel: () => Promise<void>;
	toggleFavorite: (channelId: string) => Promise<void>;
	setCategory: (category: string) => void;
	setSearchQuery: (query: string) => void;
	togglePlayPause: () => void;
	stopPlayback: () => void;
	setVolume: (volume: number) => void;
	setSoundBoost: (boost: number) => void;
	toggleMute: () => void;
	cycleQuality: () => Promise<void>;
	toggle3GDataSaver: () => void;
	set3GDataSaver: (enabled: boolean) => void;
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
	setTelemetryStats: (
		stats: Partial<{
			networkSpeed: string;
			nominalBitrate: string;
			downloadBandwidth: string;
			downloadSpeedFormatted: string;
			downloadSpeedMbps: string;
			streamBitrateFormatted: string;
			streamBitrateMbps: string;
			bandwidthCapacityFormatted: string;
			bandwidthCapacityMbps: string;
			currentFps: number;
			droppedFrames: number;
			totalFrames: number;
			liveLatency: number;
		}>,
	) => void;
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
	loadChannels: () => Promise<void>;
	forceRefreshChannels: () => Promise<void>;

	// App Updater State
	updateInfo: UpdateInfo | null;
	updateStatus: UpdateStatus;
	updateProgress: number;
	isUpdateModalOpen: boolean;
	isCheckingUpdate: boolean;
	setUpdateModalOpen: (open: boolean) => void;
	checkForUpdates: (manual?: boolean) => Promise<void>;
	startDownloadUpdate: () => Promise<void>;
	dismissUpdate: () => void;
	relaunchApp: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
	allChannels: [],
	channels: [],
	totalChannels: 0,
	categories: ["All", "Favorites"],
	activeCategory: "All",
	providers: ["All"],
	activeProvider: "All",
	searchQuery: "",
	activeChannel: null,

	refreshTotalChannelCount: async () => {
		try {
			const count = await invoke<number>("get_total_channel_count");
			if (count > 0) {
				set({ totalChannels: count });
			}
		} catch (err) {
			log.warn("Failed to get total channel count", { error: err });
		}
	},

	setActiveProvider: (provider: string) => {
		set({ activeProvider: provider });
	},

	isPlaying: false,
	volume: 85,
	soundBoost: 100,
	isMuted: false,
	bufferSecs: 0,
	networkSpeed: "0 KB/s",
	nominalBitrate: "--",
	downloadBandwidth: "--",
	downloadSpeedFormatted: "0 KB/s",
	downloadSpeedMbps: "0 Mbps",
	streamBitrateFormatted: "0 KB/s",
	streamBitrateMbps: "0 Mbps",
	bandwidthCapacityFormatted: "--",
	bandwidthCapacityMbps: "--",
	currentFps: 0,
	droppedFrames: 0,
	totalFrames: 0,
	liveLatency: 0,
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
	isLaunchAtStartup: false,
	toast: null,
	isSyncing: false,
	updateInfo: null,
	updateStatus: "idle",
	updateProgress: 0,
	isUpdateModalOpen: false,
	isCheckingUpdate: false,
	setUpdateModalOpen: (open: boolean) => set({ isUpdateModalOpen: open }),

	checkForUpdates: async (manual = false) => {
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
						get().showToast(`Update check failed: ${res.error}`, true);
					} else {
						get().showToast(
							`✅ MorningTV is completely up to date! (v${APP_VERSION})`,
						);
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
				const msg = formatIpcError(e);
				get().showToast(`Update check failed: ${msg}`, true);
			}
			setTimeout(() => {
				if (get().updateStatus === "error") {
					set({ updateStatus: "idle" });
				}
			}, 4000);
		}
	},

	startDownloadUpdate: async () => {
		const { updateInfo } = get();
		if (!updateInfo) return;
		set({ updateStatus: "downloading", updateProgress: 0 });
		try {
			await updaterService.downloadAndInstall((pct) => {
				set({ updateProgress: pct });
			});
			set({ updateStatus: "ready", updateProgress: 100 });
			get().showToast("🎉 Update downloaded! Restart to apply changes.", false);
		} catch (err: unknown) {
			const msg = formatIpcError(err);
			set({ updateStatus: "error" });
			get().showToast(`Update download failed: ${msg}`, true);
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
			log.error("Failed to relaunch", { error: err });
			window.location.reload();
		}
	},

	init: async () => {
		try {
			const [channels, categories, settings, totalCount, startupStatus] =
				await Promise.all([
					invoke<Channel[]>("get_channels"),
					invoke<string[]>("get_categories"),
					invoke<AppSettings>("get_settings"),
					invoke<number>("get_total_channel_count").catch(() => 0),
					invoke<boolean>("get_startup_status").catch(() => false),
				]);

			const provSet = new Set<string>();
			channels.forEach((c) => {
				if (c.provider) provSet.add(c.provider);
			});
			const providers = ["All", ...Array.from(provSet)];

			set({
				allChannels: channels,
				channels,
				totalChannels: totalCount > 0 ? totalCount : channels.length,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				providers: providers.length > 1 ? providers : ["All"],
				settings,
				isLaunchAtStartup: startupStatus ?? false,
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
			log.error("Failed to init app state", { error: err });
		}
	},

	fetchStartupStatus: async () => {
		try {
			const status = await invoke<boolean>("get_startup_status");
			set({ isLaunchAtStartup: status });
		} catch (err) {
			log.warn("Failed to fetch startup status", { error: err });
		}
	},

	toggleStartupStatus: async (enabled: boolean) => {
		try {
			const res = await invoke<boolean>("set_startup_status", { enabled });
			set({ isLaunchAtStartup: res });
			get().showToast(
				res
					? "🚀 MorningTV will start automatically with Windows"
					: "MorningTV Windows autostart disabled",
				false,
			);
		} catch (err: unknown) {
			const msg = formatIpcError(err);
			get().showToast(`Failed to update startup setting: ${msg}`, true);
		}
	},

	openGitHubRepo: async () => {
		try {
			await invoke("open_github_url");
		} catch {
			window.open("https://github.com/morningstarwebd/morningtv", "_blank");
		}
	},

	selectChannel: async (channel: Channel) => {
		const channelId = getChannelIdString(channel.id);
		// Immediately set activeChannel and isChannelLoading: true for instant UI feedback
		set({
			activeChannel: channel,
			isPlaying: true,
			isChannelLoading: true,
			bufferSecs: 0,
			networkSpeed: "0 KB/s",
			nominalBitrate: "--",
			downloadBandwidth: "--",
			downloadSpeedFormatted: "0 KB/s",
			downloadSpeedMbps: "0 Mbps",
			streamBitrateFormatted: "0 KB/s",
			streamBitrateMbps: "0 Mbps",
			bandwidthCapacityFormatted: "--",
			bandwidthCapacityMbps: "--",
			currentFps: 0,
			droppedFrames: 0,
			totalFrames: 0,
			liveLatency: 0,
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
			log.error("Failed to select channel", { error: err });
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
			set((state) => {
				const updatedAll = state.allChannels.map((ch) =>
					getChannelIdString(ch.id) === channelId
						? { ...ch, is_favorite: isFav }
						: ch,
				);
				const updatedFiltered = filterChannelsClient(
					updatedAll,
					state.activeCategory,
					state.searchQuery,
				);
				return {
					allChannels: updatedAll,
					channels: updatedFiltered,
				};
			});
		} catch (err) {
			log.error("Failed to toggle favorite", { error: err });
		}
	},

	setCategory: (category: string) => {
		set((state) => {
			const filtered = filterChannelsClient(
				state.allChannels,
				category,
				state.searchQuery,
			);
			return { activeCategory: category, channels: filtered };
		});
	},

	setSearchQuery: (query: string) => {
		set((state) => {
			const filtered = filterChannelsClient(
				state.allChannels,
				state.activeCategory,
				query,
			);
			return { searchQuery: query, channels: filtered };
		});
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
			networkSpeed: "0 KB/s",
			nominalBitrate: "--",
			downloadBandwidth: "--",
			downloadSpeedFormatted: "0 KB/s",
			downloadSpeedMbps: "0 Mbps",
			streamBitrateFormatted: "0 KB/s",
			streamBitrateMbps: "0 Mbps",
			bandwidthCapacityFormatted: "--",
			bandwidthCapacityMbps: "--",
			currentFps: 0,
			droppedFrames: 0,
			totalFrames: 0,
			liveLatency: 0,
		});
	},

	setVolume: (volume: number) => {
		const clamped = Math.max(0, Math.min(100, volume));
		set({ volume: clamped, isMuted: clamped === 0 });
		const { settings } = get();
		if (settings) {
			invoke("save_settings", {
				settings: { ...settings, volume: clamped, is_muted: clamped === 0 },
			}).catch((err) =>
				log.error("Failed to save volume settings", { error: err }),
			);
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
				}).catch((err) =>
					log.error("Failed to save mute settings", { error: err }),
				);
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
			log.error("Failed to cycle quality", { error: err });
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

	set3GDataSaver: (enabled: boolean) => {
		set((state) => {
			if (state.is3GDataSaver === enabled) return {};
			get().showToast(
				enabled
					? "🚀 Auto 3G Mode Active: Network throttled (~360p/480p Saver)"
					: "⚡ Normal Network Restored: Auto HD Active",
				false,
			);
			return {
				is3GDataSaver: enabled,
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
				allChannels: channels,
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
				allChannels: channels,
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
			const [channels, categories, settings, totalCount] = await Promise.all([
				invoke<Channel[]>("reset_playlist"),
				invoke<string[]>("get_categories"),
				invoke<AppSettings>("get_settings"),
				invoke<number>("get_total_channel_count").catch(() => 0),
			]);
			const realCount = totalCount > 0 ? totalCount : channels.length;
			set({
				allChannels: channels,
				channels,
				totalChannels: realCount,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				activeCategory: "All",
				settings,
				isSyncing: false,
			});
			get().showToast(
				`✅ Synced ${realCount.toLocaleString()} channels from GitHub!`,
				false,
			);
		} catch (err) {
			set({ isSyncing: false });
			get().showToast(`Failed to sync from GitHub: ${err}`, true);
		}
	},

	loadChannels: async () => {
		try {
			const [channels, categories, totalCount] = await Promise.all([
				invoke<Channel[]>("get_channels"),
				invoke<string[]>("get_categories"),
				invoke<number>("get_total_channel_count").catch(() => 0),
			]);

			const provSet = new Set<string>();
			channels.forEach((c) => {
				if (c.provider) provSet.add(c.provider);
			});
			const providers = ["All", ...Array.from(provSet)];

			set((state) => ({
				allChannels: channels,
				channels: filterChannelsClient(
					channels,
					state.activeCategory,
					state.searchQuery,
				),
				totalChannels: totalCount > 0 ? totalCount : channels.length,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				providers: providers.length > 1 ? providers : ["All"],
			}));
		} catch (err) {
			log.error("Failed to reload channels", { error: err });
		}
	},

	forceRefreshChannels: async () => {
		try {
			get().showToast("🔄 Refreshing channels cache...", false);
			const channels = await invoke<Channel[]>("force_refresh_channels");
			const categories = await invoke<string[]>("get_categories");
			const totalCount = await invoke<number>("get_total_channel_count").catch(
				() => channels.length,
			);

			const provSet = new Set<string>();
			channels.forEach((c) => {
				if (c.provider) provSet.add(c.provider);
			});
			const providers = ["All", ...Array.from(provSet)];

			set((state) => ({
				allChannels: channels,
				channels: filterChannelsClient(
					channels,
					state.activeCategory,
					state.searchQuery,
				),
				totalChannels: totalCount > 0 ? totalCount : channels.length,
				categories: categories.length > 0 ? categories : ["All", "Favorites"],
				providers: providers.length > 1 ? providers : ["All"],
			}));
			get().showToast(
				`✅ Loaded ${channels.length.toLocaleString()} fresh channels!`,
				false,
			);
		} catch (err) {
			get().showToast(`Failed to refresh channels: ${err}`, true);
		}
	},

	setBufferSecs: (secs: number) => set({ bufferSecs: secs }),
	setNetworkSpeed: (speed: string) => set({ networkSpeed: speed }),
	setTelemetryStats: (stats) => set((state) => ({ ...state, ...stats })),

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
			log.error("Failed to open YouTube", { error: err });
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
			log.error("Failed to open Hotstar", { error: err });
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
				: [...state.deadChannelIds, channelId].slice(-100),
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
