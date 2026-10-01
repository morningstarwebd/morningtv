// src/stores/playerStore.ts
// Playback controls, volume, Web Audio booster, aspect ratios, and rendition tiers

import { create } from "zustand";
import type { AspectRatio, QualityLevel, QualityTier } from "../types";
import { audioBooster } from "../utils/audioBooster.ts";

export interface PlayerState {
	isPlaying: boolean;
	volume: number;
	soundBoost: number;
	isMuted: boolean;
	aspectRatio: AspectRatio;
	currentQuality: QualityTier;
	is3GDataSaver: boolean;
	currentResolution: string;
	availableQualityLevels: QualityLevel[];
	selectedQualityLevel: number;
	normalizeAudio: boolean;

	// Actions
	setIsPlaying: (playing: boolean) => void;
	togglePlayPause: () => void;
	stopPlayback: () => void;
	setVolume: (volume: number) => void;
	setSoundBoost: (boost: number) => void;
	toggleMute: () => void;
	cycleAspectRatio: () => void;
	setAspectRatio: (ratio: AspectRatio) => void;
	toggle3GDataSaver: () => void;
	set3GDataSaver: (enabled: boolean) => void;
	setAvailableQualityLevels: (levels: QualityLevel[]) => void;
	setSelectedQualityLevel: (level: number) => void;
	setCurrentResolution: (res: string) => void;
	toggleNormalizeAudio: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	isPlaying: false,
	volume: 85,
	soundBoost: 100,
	isMuted: false,
	aspectRatio: "16:9",
	currentQuality: "Auto",
	is3GDataSaver: false,
	currentResolution: "Auto (1080p)",
	availableQualityLevels: [],
	selectedQualityLevel: -1,
	normalizeAudio: false,

	setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

	togglePlayPause: () => {
		set((s) => ({ isPlaying: !s.isPlaying }));
	},

	stopPlayback: () => {
		set({ isPlaying: false });
	},

	setVolume: (volume: number) => {
		const clamped = Math.max(0, Math.min(100, volume));
		set({ volume: clamped, isMuted: false });
	},

	setSoundBoost: (boost: number) => {
		const clamped = Math.max(100, Math.min(300, boost));
		audioBooster.setBoost(clamped);
		set({ soundBoost: clamped });
	},

	toggleMute: () => {
		const { isMuted, soundBoost } = get();
		const nextMuted = !isMuted;
		audioBooster.setBoost(nextMuted ? 0 : soundBoost);
		set({ isMuted: nextMuted });
	},

	cycleAspectRatio: () => {
		const ratios: AspectRatio[] = ["16:9", "4:3", "fill", "21:9"];
		const nextIdx = (ratios.indexOf(get().aspectRatio) + 1) % ratios.length;
		set({ aspectRatio: ratios[nextIdx] });
	},

	setAspectRatio: (ratio: AspectRatio) => set({ aspectRatio: ratio }),

	toggle3GDataSaver: () => {
		set((s) => ({ is3GDataSaver: !s.is3GDataSaver }));
	},

	set3GDataSaver: (enabled: boolean) => {
		set({ is3GDataSaver: enabled });
	},

	setAvailableQualityLevels: (levels: QualityLevel[]) => {
		set({ availableQualityLevels: levels });
	},

	setSelectedQualityLevel: (level: number) => {
		set({ selectedQualityLevel: level });
	},

	setCurrentResolution: (res: string) => {
		set({ currentResolution: res });
	},

	toggleNormalizeAudio: () => {
		set((s) => ({ normalizeAudio: !s.normalizeAudio }));
	},
}));
