// src/stores/appStore.ts
// Central Zustand state store with Next-Level Studio & Cinema UI, 3G Data Saver, and Audio Booster

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import {
	type UpdateInfo,
	type UpdateStatus,
	updaterService,
} from "../services/updaterService";

import type {
	AiModelItem,
	AppSettings,
	AspectRatio,
	Channel,
	ProviderDetectionResult,
	QualityLevel,
	QualityTier,
	StreamHealthStatus,
	SyncProgressPayload,
} from "../types";

import { APP_VERSION, formatIpcError, getChannelIdString } from "../types";
import { audioBooster } from "../utils/audioBooster";
import {
	filterChannelsClient,
	isGeoRestrictedStream,
	isGeoRestrictedUrl,
} from "../utils/channelFilter";
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
	isAiAssistantOpen: boolean;
	aiAvatarPreset: "nova" | "jarvis" | "astra" | "retro" | "custom";
	aiCustomAvatarUrl: string;
	ambientGlow: boolean;
	settings: AppSettings | null;
	hideRegionBlocked: boolean;
	showOnlyVerified: boolean;
	isLaunchAtStartup: boolean;
	toast: { message: string; isError: boolean } | null;

	// Actions
	openAiAssistant: () => void;
	closeAiAssistant: () => void;
	toggleAiAssistant: () => void;
	setAiAvatarPreset: (
		preset: "nova" | "jarvis" | "astra" | "retro" | "custom",
	) => void;
	setAiCustomAvatarUrl: (url: string) => void;
	executeAiAction: (
		action: string,
		param?: string,
	) => Promise<string | undefined>;
	init: () => Promise<void>;
	fetchStartupStatus: () => Promise<void>;
	toggleStartupStatus: (enabled: boolean) => Promise<void>;
	toggleHideRegionBlocked: () => void;
	toggleShowOnlyVerified: () => void;
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
	increaseVolume: () => void;
	decreaseVolume: () => void;
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
	syncProgress: SyncProgressPayload | null;
	setSyncProgress: (progress: SyncProgressPayload | null) => void;
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

	// AI Brain & Custom Sources
	updateGroqApiKey: (key: string | null) => Promise<void>;
	toggleAiBrain: () => Promise<void>;
	addCustomSource: (url: string) => Promise<void>;
	removeCustomSource: (url: string) => Promise<void>;
	testGroqKey: (key: string) => Promise<{ success: boolean; message: string }>;
	verifyAiKey: (
		key: string,
		endpoint?: string | null,
		provider?: string | null,
		model?: string | null,
	) => Promise<ProviderDetectionResult>;
	fetchProviderModels: (
		provider: string,
		apiKey?: string | null,
		endpoint?: string | null,
	) => Promise<AiModelItem[]>;
	setActiveAiModel: (model: string) => Promise<void>;
	saveAiConfiguration: (config: {
		apiKey: string | null;
		provider?: string | null;
		model?: string | null;
		endpoint?: string | null;
	}) => Promise<void>;
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
	isAiAssistantOpen: false,
	aiAvatarPreset:
		(typeof localStorage !== "undefined" &&
			(localStorage.getItem("morningtv_ai_avatar") as
				| "nova"
				| "jarvis"
				| "astra"
				| "retro"
				| "custom")) ||
		"nova",
	aiCustomAvatarUrl:
		(typeof localStorage !== "undefined" &&
			localStorage.getItem("morningtv_ai_custom_avatar")) ||
		"",
	ambientGlow: true,
	settings: null,
	hideRegionBlocked: false,
	showOnlyVerified: false,
	isLaunchAtStartup: false,
	toast: null,
	isSyncing: false,
	syncProgress: null,
	setSyncProgress: (progress: SyncProgressPayload | null) =>
		set({ syncProgress: progress }),
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

			const hideRegion = settings.hide_region_blocked ?? false;
			const showVerified = settings.show_only_verified ?? false;
			const initialFiltered = filterChannelsClient(
				channels,
				"All",
				"",
				hideRegion,
				showVerified,
			);
			const rawTotal = totalCount > 0 ? totalCount : channels.length;

			const baseCats =
				categories.length > 0 ? categories : ["All", "Favorites"];
			const enrichedCats = baseCats.includes("India")
				? baseCats
				: [
						"All",
						"Favorites",
						"India",
						...baseCats.filter((c) => c !== "All" && c !== "Favorites"),
					];

			set({
				allChannels: channels,
				channels: initialFiltered,
				totalChannels: rawTotal,
				categories: enrichedCats,
				providers: providers.length > 1 ? providers : ["All"],
				settings,
				hideRegionBlocked: hideRegion,
				showOnlyVerified: showVerified,
				isLaunchAtStartup: startupStatus ?? false,
				volume: settings.volume ?? 85,
				isMuted: settings.is_muted ?? false,
				currentQuality: settings.preferred_quality ?? "Auto",
			});

			// Real-time synchronization progress from background Rust sentinel
			listen<SyncProgressPayload>("sync_progress", (event) => {
				set({
					syncProgress: event.payload,
					isSyncing: !event.payload.is_complete,
				});
			}).catch((err) =>
				log.warn("Failed to listen for sync_progress", { error: err }),
			);

			if (initialFiltered.length > 0) {
				let defaultChannel = initialFiltered[0];
				if (settings.last_played_channel_id) {
					const match = initialFiltered.find(
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

	toggleHideRegionBlocked: () => {
		const next = !get().hideRegionBlocked;
		const { allChannels, activeCategory, searchQuery, settings } = get();
		const nextFiltered = filterChannelsClient(
			allChannels,
			activeCategory,
			searchQuery,
			next,
		);
		const effectiveTotal = next
			? allChannels.filter((c) => !isGeoRestrictedStream(c)).length
			: allChannels.length;

		set({
			hideRegionBlocked: next,
			channels: nextFiltered,
			totalChannels: allChannels.length,
		});

		if (settings) {
			invoke("save_settings", {
				settings: { ...settings, hide_region_blocked: next },
			}).catch((err) =>
				log.error("Failed to save region blocked settings", { error: err }),
			);
		}

		get().showToast(
			next
				? `🛡️ Direct Playback Active (${effectiveTotal.toLocaleString()} channels available)`
				: `🌐 Global Channels Active (${effectiveTotal.toLocaleString()} channels available)`,
			false,
		);
	},

	toggleShowOnlyVerified: () => {
		const next = !get().showOnlyVerified;
		const {
			allChannels,
			activeCategory,
			searchQuery,
			hideRegionBlocked,
			settings,
		} = get();
		const nextFiltered = filterChannelsClient(
			allChannels,
			activeCategory,
			searchQuery,
			hideRegionBlocked,
			next,
		);
		set({
			showOnlyVerified: next,
			channels: nextFiltered,
		});
		if (settings) {
			invoke("save_settings", {
				settings: { ...settings, show_only_verified: next },
			}).catch((err) =>
				log.error("Failed to save verified setting", { error: err }),
			);
		}
		get().showToast(
			next
				? `⚡ Showing only verified streams for your network (${nextFiltered.length.toLocaleString()} available)`
				: `🌐 Showing all cloud channels (${allChannels.length.toLocaleString()} available)`,
			false,
		);
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

	updateGroqApiKey: async (key: string | null) => {
		const { settings } = get();
		if (!settings) return;
		const next = { ...settings, groq_api_key: key };
		set({ settings: next });
		try {
			await invoke("save_settings", { settings: next });
			get().showToast(
				key ? "✅ Groq API key saved" : "Groq API key removed",
				false,
			);
		} catch (err) {
			get().showToast(`Failed to save Groq key: ${err}`, true);
		}
	},

	toggleAiBrain: async () => {
		const { settings } = get();
		if (!settings) return;
		const nextState = !settings.ai_brain_enabled;
		const next = { ...settings, ai_brain_enabled: nextState };
		set({ settings: next });
		try {
			await invoke("save_settings", { settings: next });
			get().showToast(
				nextState
					? "🧠 AI Brain enabled for smart stream healing"
					: "AI Brain disabled",
				false,
			);
		} catch (err) {
			get().showToast(`Failed to update AI Brain setting: ${err}`, true);
		}
	},

	addCustomSource: async (url: string) => {
		try {
			const updated = await invoke<AppSettings>("add_custom_upstream_source", {
				sourceUrl: url,
			});
			set({ settings: updated });
			get().showToast("✅ Custom upstream source added", false);
		} catch (err) {
			get().showToast(`Failed to add source: ${err}`, true);
		}
	},

	removeCustomSource: async (url: string) => {
		try {
			const updated = await invoke<AppSettings>(
				"remove_custom_upstream_source",
				{
					sourceUrl: url,
				},
			);
			set({ settings: updated });
			get().showToast("Custom source removed", false);
		} catch (err) {
			get().showToast(`Failed to remove source: ${err}`, true);
		}
	},

	testGroqKey: async (key: string) => {
		try {
			const message = await invoke<string>("test_groq_api_key", {
				apiKey: key,
			});
			return { success: true, message };
		} catch (err) {
			return { success: false, message: String(err) };
		}
	},

	verifyAiKey: async (
		key: string,
		endpoint?: string | null,
		provider?: string | null,
		model?: string | null,
	) => {
		return await invoke<ProviderDetectionResult>("verify_ai_provider_key", {
			apiKey: key,
			endpoint: endpoint || null,
			provider: provider || null,
			model: model || null,
		});
	},

	fetchProviderModels: async (
		provider: string,
		apiKey?: string | null,
		endpoint?: string | null,
	) => {
		try {
			return await invoke<AiModelItem[]>("fetch_ai_provider_models", {
				provider,
				apiKey: apiKey || null,
				endpoint: endpoint || null,
			});
		} catch (err) {
			log.error("Failed to fetch provider models", { error: err });
			return [];
		}
	},

	setActiveAiModel: async (model: string) => {
		const { settings } = get();
		if (!settings) return;
		const next: AppSettings = {
			...settings,
			ai_model: model,
		};
		set({ settings: next });
		try {
			await invoke("set_active_ai_model", { model });
			get().showToast(`🤖 AI Model changed to ${model}`, false);
		} catch (err) {
			log.error("Failed to set active AI model", { error: err });
		}
	},

	saveAiConfiguration: async (config: {
		apiKey: string | null;
		provider?: string | null;
		model?: string | null;
		endpoint?: string | null;
	}) => {
		const { settings } = get();
		if (!settings) return;
		const next: AppSettings = {
			...settings,
			ai_api_key: config.apiKey,
			groq_api_key: config.apiKey,
			ai_provider: config.provider || null,
			ai_model: config.model || null,
			ai_endpoint: config.endpoint || null,
			ai_brain_enabled: Boolean(config.apiKey),
		};
		set({ settings: next });
		try {
			await invoke("save_settings", { settings: next });
			get().showToast(
				config.apiKey
					? `✅ AI Engine connected (${config.provider || "Active"})`
					: "AI API key removed",
				false,
			);
		} catch (err) {
			get().showToast(`Failed to save AI configuration: ${err}`, true);
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
					state.hideRegionBlocked,
					state.showOnlyVerified,
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
				state.hideRegionBlocked,
				state.showOnlyVerified,
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
				state.hideRegionBlocked,
				state.showOnlyVerified,
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
		audioBooster.setVolume(clamped);
		audioBooster.setMuted(clamped === 0);
		const { settings } = get();
		if (settings) {
			invoke("save_settings", {
				settings: { ...settings, volume: clamped, is_muted: clamped === 0 },
			}).catch((err) =>
				log.error("Failed to save volume settings", { error: err }),
			);
		}
	},

	increaseVolume: () => {
		const current = get().volume;
		const next = Math.min(100, current + 5);
		get().setVolume(next);
		get().showToast(`🔊 Volume: ${next}%`, false);
	},

	decreaseVolume: () => {
		const current = get().volume;
		const next = Math.max(0, current - 5);
		get().setVolume(next);
		get().showToast(next === 0 ? "🔇 Muted" : `🔉 Volume: ${next}%`, false);
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
			audioBooster.setMuted(isMuted);
			const { settings } = state;
			if (settings) {
				invoke("save_settings", {
					settings: { ...settings, is_muted: isMuted },
				}).catch((err) =>
					log.error("Failed to save mute settings", { error: err }),
				);
			}
			get().showToast(
				isMuted ? "🔇 Muted" : `🔊 Unmuted (${state.volume}%)`,
				false,
			);
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

	openAiAssistant: () => set({ isAiAssistantOpen: true }),
	closeAiAssistant: () => set({ isAiAssistantOpen: false }),
	toggleAiAssistant: () =>
		set((state) => ({ isAiAssistantOpen: !state.isAiAssistantOpen })),

	setAiAvatarPreset: (preset) => {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem("morningtv_ai_avatar", preset);
		}
		set({ aiAvatarPreset: preset });
	},

	setAiCustomAvatarUrl: (url) => {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem("morningtv_ai_custom_avatar", url);
		}
		set({ aiCustomAvatarUrl: url });
	},

	executeAiAction: async (action: string, param?: string) => {
		const store = get();
		if (action === "play_channel" && param) {
			const target = param.toLowerCase().trim();
			const found = store.allChannels.find((c) => {
				const n = c.name.toLowerCase();
				return n.includes(target) || target.includes(n);
			});
			if (found) {
				await store.selectChannel(found);
				return `Now playing "${found.name}"`;
			}
			try {
				const healed = await invoke<Channel | null>("ai_hunt_and_heal", {
					channelName: param,
				});
				if (healed) {
					const existingIndex = store.allChannels.findIndex(
						(c) => getChannelIdString(c.id) === getChannelIdString(healed.id),
					);
					if (existingIndex === -1) {
						set((state) => ({
							allChannels: [healed, ...state.allChannels],
							channels: [healed, ...state.channels],
							totalChannels: state.totalChannels + 1,
						}));
					}
					await store.selectChannel(healed);
					return `⚡ Stream recovered: "${healed.name}" fetched from internet and added to library!`;
				}
			} catch {}
			return `Channel "${param}" not found`;
		}

		if (action === "set_volume" && param) {
			const vol = Number.parseInt(param, 10);
			if (!Number.isNaN(vol)) {
				store.setVolume(Math.max(0, Math.min(100, vol)));
				return `Volume set to ${vol}%`;
			}
		}

		if (action === "toggle_mute") {
			store.toggleMute();
			return "Mute toggled";
		}

		if (action === "hunt_stream" && param) {
			store.showToast(`🔍 Searching upstream & internet sources for "${param}"...`, false);
			try {
				const healed = await invoke<Channel | null>("ai_hunt_and_heal", {
					channelName: param,
				});
				if (healed) {
					const existingIndex = store.allChannels.findIndex(
						(c) => getChannelIdString(c.id) === getChannelIdString(healed.id),
					);
					if (existingIndex === -1) {
						set((state) => ({
							allChannels: [healed, ...state.allChannels],
							channels: [healed, ...state.channels],
							totalChannels: state.totalChannels + 1,
						}));
					} else {
						set((state) => ({
							allChannels: state.allChannels.map((c, i) =>
								i === existingIndex ? healed : c,
							),
							channels: state.channels.map((c) =>
								getChannelIdString(c.id) === getChannelIdString(healed.id)
									? healed
									: c,
							),
						}));
					}
					await store.selectChannel(healed);
					return `⚡ AI Recovery Successful! "${healed.name}" stream saved to database and playing now.`;
				}
				return `No active stream found for "${param}" across upstream sources.`;
			} catch (e) {
				return `Stream recovery error: ${e}`;
			}
		}

		if (action === "set_category" && param) {
			store.setCategory(param);
			return `Filtered category to "${param}"`;
		}

		if (action === "toggle_fullscreen") {
			if (!document.fullscreenElement) {
				document.documentElement.requestFullscreen().catch(() => {});
				return "Fullscreen enabled";
			}
			document.exitFullscreen().catch(() => {});
			return "Fullscreen exited";
		}

		return undefined;
	},

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
			set({
				isSyncing: true,
				syncProgress: {
					phase: "Connecting to GitHub Sentinel release...",
					percent: 10,
					updated_count: 0,
					total_count: 0,
					is_complete: false,
				},
			});
			const result = await invoke<SyncProgressPayload>(
				"background_refresh_playlist",
			);
			const [channels, categories, settings, totalCount] = await Promise.all([
				invoke<Channel[]>("get_channels"),
				invoke<string[]>("get_categories"),
				invoke<AppSettings>("get_settings"),
				invoke<number>("get_total_channel_count").catch(() => 0),
			]);
			const realCount = totalCount > 0 ? totalCount : channels.length;
			const provSet = new Set<string>();
			channels.forEach((c) => {
				if (c.provider) provSet.add(c.provider);
			});
			const providers = ["All", ...Array.from(provSet)];

			const baseCats =
				categories.length > 0 ? categories : ["All", "Favorites"];
			const enrichedCats = baseCats.includes("India")
				? baseCats
				: [
						"All",
						"Favorites",
						"India",
						...baseCats.filter((c) => c !== "All" && c !== "Favorites"),
					];

			set((state) => ({
				allChannels: channels,
				channels: filterChannelsClient(
					channels,
					state.activeCategory,
					state.searchQuery,
					state.hideRegionBlocked,
					state.showOnlyVerified,
				),
				totalChannels: realCount,
				categories: enrichedCats,
				providers: providers.length > 1 ? providers : ["All"],
				settings,
				isSyncing: false,
				syncProgress: result,
			}));
			get().showToast(
				`✅ Verified ${realCount.toLocaleString()} channels on your network (${result.updated_count} mirrors optimized)!`,
				false,
			);
		} catch (err) {
			set({ isSyncing: false, syncProgress: null });
			get().showToast(`Failed to sync channels: ${formatIpcError(err)}`, true);
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
					state.hideRegionBlocked,
					state.showOnlyVerified,
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
					state.hideRegionBlocked,
					state.showOnlyVerified,
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
		const { activeChannel, mirrorIndex, hideRegionBlocked, showToast } = get();
		if (!activeChannel) return;
		const raw = [activeChannel.url, ...(activeChannel.fallback_urls || [])];
		const allUrls = hideRegionBlocked
			? raw.filter((u) => !isGeoRestrictedUrl(u, activeChannel.provider))
			: raw;
		if (allUrls.length <= 1) {
			showToast("Single stream source available for this channel", false);
			return;
		}
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
