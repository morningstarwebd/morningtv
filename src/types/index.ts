// src/types/index.ts
// TypeScript interfaces mirroring Rust domain entities and UI state

export const APP_VERSION = "1.1.3";

export interface ChannelId {
	0: string;
}

export interface Channel {
	id: ChannelId | string;
	name: string;
	logo: string | null;
	group: string;
	url: string;
	fallback_urls?: string[];
	http_user_agent?: string | null;
	http_referrer?: string | null;
	is_favorite: boolean;
	provider?: string | null;
	is_verified?: boolean;
}

export function getChannelIdString(id: ChannelId | string): string {
	if (typeof id === "string") return id;
	if (id && typeof id === "object" && "0" in id) return id[0];
	return String(id);
}

export type QualityTier = "Auto" | "UltraLow" | "Low" | "Medium" | "High";
export type AspectRatio = "16:9" | "4:3" | "fill" | "21:9";
export type StreamHealthStatus =
	| "good"
	| "degraded"
	| "critical"
	| "stalled"
	| "reconnecting";

export interface QualityLevel {
	index: number;
	label: string;
	height: number;
	bitrate: number;
}

export interface AppSettings {
	playlist_url: string;
	volume: number;
	is_muted: boolean;
	preferred_quality: QualityTier;
	auto_adaptive_bitrate: boolean;
	cache_duration_secs: number;
	last_played_channel_id: string | null;
	normalize_audio?: boolean;
	hide_region_blocked?: boolean;
	show_only_verified?: boolean;
}

export interface EpgProgram {
	title: string;
	description?: string;
	startTime: string;
	endTime: string;
	progress: number;
}

export interface ChannelEpg {
	current: EpgProgram | null;
	next: EpgProgram | null;
}

export interface SyncProgressPayload {
	phase: string;
	percent: number;
	updated_count: number;
	total_count: number;
	is_complete: boolean;
}

interface IpcError {
	code: string;
	message: string;
	retryable: boolean;
}

export function formatIpcError(err: unknown): string {
	if (!err) return "Unknown error occurred";
	if (typeof err === "string") return err;
	if (typeof err === "object" && err !== null) {
		const e = err as Partial<IpcError>;
		if (e.message) {
			return e.code ? `[${e.code}] ${e.message}` : e.message;
		}
	}
	return String(err);
}
