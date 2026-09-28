// src/stores/streamStore.ts
// Stream health, bandwidth telemetry, buffer metrics, mirrors, and failover state

import { create } from "zustand";
import type { QualityTier, StreamHealthStatus } from "../types";

export interface StreamState {
	bufferSecs: number;
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
	mirrorIndex: number;
	streamHealthStatus: StreamHealthStatus;
	stallCount: number;
	abrTier: QualityTier;
	isChannelLoading: boolean;
	reconnectCountdown: number | null;
	deadChannelIds: string[];

	// Actions
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
	setMirrorIndex: (index: number) => void;
	cycleMirror: () => void;
	setStreamHealthStatus: (status: StreamHealthStatus) => void;
	incrementStallCount: () => void;
	resetStallCount: () => void;
	setAbrTier: (tier: QualityTier) => void;
	setIsChannelLoading: (loading: boolean) => void;
	setReconnectCountdown: (countdown: number | null) => void;
	markChannelDead: (channelId: string) => void;
}

export const useStreamStore = create<StreamState>((set) => ({
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
	mirrorIndex: 0,
	streamHealthStatus: "good",
	stallCount: 0,
	abrTier: "Auto",
	isChannelLoading: false,
	reconnectCountdown: null,
	deadChannelIds: [],

	setBufferSecs: (secs: number) => set({ bufferSecs: secs }),
	setNetworkSpeed: (speed: string) => set({ networkSpeed: speed }),

	setTelemetryStats: (stats) => {
		set((s) => ({ ...s, ...stats }));
	},

	setMirrorIndex: (index: number) => set({ mirrorIndex: index }),
	cycleMirror: () => set((s) => ({ mirrorIndex: s.mirrorIndex + 1 })),

	setStreamHealthStatus: (status: StreamHealthStatus) =>
		set({ streamHealthStatus: status }),

	incrementStallCount: () => set((s) => ({ stallCount: s.stallCount + 1 })),
	resetStallCount: () => set({ stallCount: 0 }),

	setAbrTier: (tier: QualityTier) => set({ abrTier: tier }),
	setIsChannelLoading: (loading: boolean) => set({ isChannelLoading: loading }),
	setReconnectCountdown: (countdown: number | null) =>
		set({ reconnectCountdown: countdown }),

	markChannelDead: (channelId: string) =>
		set((s) => ({
			deadChannelIds: s.deadChannelIds.includes(channelId)
				? s.deadChannelIds
				: [...s.deadChannelIds, channelId],
		})),
}));
