// src/stores/channelStore.ts
// Channel collection, filtering, category navigation, and favorites state

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { Channel } from "../types";
import { getChannelIdString } from "../types";
import { filterChannelsClient } from "../utils/channelFilter.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("ChannelStore");

export interface ChannelState {
	allChannels: Channel[];
	channels: Channel[];
	totalChannels: number;
	categories: string[];
	activeCategory: string;
	providers: string[];
	activeProvider: string;
	searchQuery: string;
	activeChannel: Channel | null;
	isSyncing: boolean;

	// Actions
	setAllChannels: (channels: Channel[]) => void;
	setActiveChannel: (channel: Channel | null) => void;
	setActiveProvider: (provider: string) => void;
	setCategory: (category: string) => void;
	setSearchQuery: (query: string) => void;
	refreshTotalChannelCount: () => Promise<void>;
	loadChannels: () => Promise<void>;
	forceRefreshChannels: () => Promise<void>;
	selectChannel: (channel: Channel) => Promise<void>;
	selectChannelByIndex: (index: number) => Promise<void>;
	nextChannel: () => Promise<void>;
	prevChannel: () => Promise<void>;
	toggleFavorite: (channelId: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
	allChannels: [],
	channels: [],
	totalChannels: 0,
	categories: ["All", "Favorites"],
	activeCategory: "All",
	providers: ["All"],
	activeProvider: "All",
	searchQuery: "",
	activeChannel: null,
	isSyncing: false,

	setAllChannels: (channels) => set({ allChannels: channels, channels }),
	setActiveChannel: (channel) => set({ activeChannel: channel }),

	setActiveProvider: (provider: string) => {
		set({ activeProvider: provider });
	},

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

	loadChannels: async () => {
		try {
			const [fetchedChannels, fetchedCategories, totalCount] =
				await Promise.all([
					invoke<Channel[]>("get_channels"),
					invoke<string[]>("get_categories"),
					invoke<number>("get_total_channel_count").catch(() => 0),
				]);

			const provSet = new Set<string>(["All"]);
			for (const ch of fetchedChannels) {
				if (ch.provider) provSet.add(ch.provider);
			}

			const defaultCategory = "All";
			const filtered = filterChannelsClient(
				fetchedChannels,
				defaultCategory,
				"",
			);

			set({
				allChannels: fetchedChannels,
				channels: filtered,
				totalChannels: totalCount > 0 ? totalCount : fetchedChannels.length,
				categories:
					fetchedCategories.length > 0
						? fetchedCategories
						: ["All", "Favorites"],
				providers: Array.from(provSet),
				activeCategory: defaultCategory,
				activeProvider: "All",
				searchQuery: "",
			});
		} catch (err) {
			log.error("Failed to load channels", { error: err });
		}
	},

	forceRefreshChannels: async () => {
		set({ isSyncing: true });
		try {
			const channels = await invoke<Channel[]>("force_refresh_channels");
			const categories = await invoke<string[]>("get_categories");
			const totalCount = await invoke<number>("get_total_channel_count").catch(
				() => 0,
			);

			set({
				allChannels: channels,
				channels: filterChannelsClient(
					channels,
					get().activeCategory,
					get().searchQuery,
				),
				totalChannels: totalCount > 0 ? totalCount : channels.length,
				categories,
				isSyncing: false,
			});
		} catch (err) {
			log.error("Failed to force refresh channels", { error: err });
			set({ isSyncing: false });
		}
	},

	setCategory: (category: string) => {
		const { allChannels, searchQuery } = get();
		const filtered = filterChannelsClient(allChannels, category, searchQuery);
		set({ activeCategory: category, channels: filtered });
	},

	setSearchQuery: (query: string) => {
		const { allChannels, activeCategory } = get();
		const filtered = filterChannelsClient(allChannels, activeCategory, query);
		set({ searchQuery: query, channels: filtered });
	},

	selectChannel: async (channel: Channel) => {
		set({ activeChannel: channel });
		try {
			await invoke("select_channel", { id: getChannelIdString(channel.id) });
		} catch (err) {
			log.warn("select_channel IPC error", { error: err });
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
		if (!activeChannel || channels.length === 0) return;
		const curId = getChannelIdString(activeChannel.id);
		const idx = channels.findIndex((c) => getChannelIdString(c.id) === curId);
		const nextIdx = idx === -1 ? 0 : (idx + 1) % channels.length;
		await selectChannel(channels[nextIdx]);
	},

	prevChannel: async () => {
		const { channels, activeChannel, selectChannel } = get();
		if (!activeChannel || channels.length === 0) return;
		const curId = getChannelIdString(activeChannel.id);
		const idx = channels.findIndex((c) => getChannelIdString(c.id) === curId);
		const prevIdx =
			idx === -1 ? 0 : (idx - 1 + channels.length) % channels.length;
		await selectChannel(channels[prevIdx]);
	},

	toggleFavorite: async (channelId: string) => {
		try {
			const isFav = await invoke<boolean>("toggle_favorite", { id: channelId });
			const updateFav = (list: Channel[]) =>
				list.map((c) =>
					getChannelIdString(c.id) === channelId
						? { ...c, is_favorite: isFav }
						: c,
				);

			const { allChannels, activeCategory, searchQuery, activeChannel } = get();
			const nextAll = updateFav(allChannels);
			const nextFiltered = filterChannelsClient(
				nextAll,
				activeCategory,
				searchQuery,
			);
			const nextActive =
				activeChannel && getChannelIdString(activeChannel.id) === channelId
					? { ...activeChannel, is_favorite: isFav }
					: activeChannel;

			set({
				allChannels: nextAll,
				channels: nextFiltered,
				activeChannel: nextActive,
			});
		} catch (err) {
			log.error("Failed to toggle favorite", { error: err });
		}
	},
}));
