import {
	Cloud,
	Globe,
	RefreshCw,
	RotateCcw,
	Save,
	ShieldCheck,
	Sliders,
	Sparkles,
	Volume2,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";

export const SettingsDialog: React.FC = () => {
	const {
		isSettingsOpen,
		settings,
		ambientGlow,
		normalizeAudio,
		isSyncing,
		closeSettings,
		updatePlaylist,
		resetPlaylist,
		syncCloudStreams,
		toggleAmbientGlow,
		toggleNormalizeAudio,
		isCheckingUpdate,
		checkForUpdates,
	} = useAppStore();

	const [playlistUrl, setPlaylistUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	useEffect(() => {
		if (settings?.playlist_url) {
			setPlaylistUrl(settings.playlist_url);
		}
	}, [settings?.playlist_url]);

	// Escape key to close modal
	useEffect(() => {
		if (!isSettingsOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				closeSettings();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isSettingsOpen, closeSettings]);

	if (!isSettingsOpen) return null;

	const DEFAULT_PLAYLIST_URL =
		"https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u";

	const isCustomPlaylist =
		settings?.playlist_url && settings.playlist_url !== DEFAULT_PLAYLIST_URL;

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!playlistUrl.trim()) return;

		setIsSaving(true);
		await updatePlaylist(playlistUrl.trim());
		setIsSaving(false);
	};

	const handleReset = async () => {
		setIsResetting(true);
		await resetPlaylist();
		setPlaylistUrl(DEFAULT_PLAYLIST_URL);
		setIsResetting(false);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl select-none p-4 md:p-8 animate-in fade-in duration-200">
			<div
				className="w-full max-w-4xl bg-[#0b0e18]/95 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col gap-6 max-h-[92vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Modal Header */}
				<div className="flex items-center justify-between border-b border-white/10 pb-4">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10">
							<Sliders className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
								Player & Engine Settings
								<span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
									PRO
								</span>
							</h2>
							<p className="text-xs text-zinc-400">
								Manage IPTV streaming sources, cinema ambient glow, acoustics, and cloud sync
							</p>
						</div>
					</div>
					<button
						onClick={closeSettings}
						className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10"
						title="Close (Esc)"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Settings Form */}
				<form onSubmit={handleSave} className="flex flex-col gap-5">
					{/* Card 1: Top Hero Full-Width Card (M3U Playlist Source) */}
					<div className="rounded-2xl p-4.5 sm:p-5 bg-white/[0.03] border border-white/10 flex flex-col gap-3 transition-colors hover:border-white/15">
						<div className="flex items-center justify-between flex-wrap gap-2">
							<div className="flex items-center gap-2">
								<Globe className="w-4 h-4 text-cyan-400" />
								<span className="text-xs sm:text-sm font-bold text-white tracking-wide">
									M3U Playlist Source
								</span>
								{isCustomPlaylist ? (
									<span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
										Custom Link
									</span>
								) : (
									<span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
										Default Channels
									</span>
								)}
							</div>

							{isCustomPlaylist && (
								<button
									type="button"
									onClick={handleReset}
									disabled={isResetting || isSaving}
									className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1.5 cursor-pointer font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all"
								>
									<RotateCcw
										className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`}
									/>
									<span>Reset to Default</span>
								</button>
							)}
						</div>

						<div className="relative flex items-center">
							<input
								type="text"
								value={playlistUrl}
								onChange={(e) => setPlaylistUrl(e.target.value)}
								placeholder="https://.../playlist.m3u"
								className="w-full bg-[#05070d] text-xs text-white rounded-xl pl-3.5 pr-24 py-2.5 border border-white/10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
							/>
							<div className="absolute right-2 flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 pointer-events-none">
								<span>M3U8 / M3U</span>
							</div>
						</div>

						<div className="flex items-center justify-between text-[11px] text-zinc-400">
							<span>
								Supports global large-scale playlists (10,000+ channels) with sub-second fast indexing.
							</span>
							<span className="text-zinc-500 font-mono text-[10px] hidden sm:inline">
								UTF-8 / EPG Ready
							</span>
						</div>
					</div>

					{/* 2-Column Balanced Card Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Card 2: Cinema Ambilight Glow */}
						<div className="rounded-2xl p-4.5 bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-3 group">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
										<Sparkles className="w-4.5 h-4.5" />
									</div>
									<div>
										<div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
											<span>Ambilight Ambient Glow</span>
										</div>
										<p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
											Dynamic cinema aura cast behind playback canvas
										</p>
									</div>
								</div>

								<span
									className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
										ambientGlow
											? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
											: "bg-white/5 text-zinc-500 border-white/10"
									}`}
								>
									{ambientGlow ? "ENABLED" : "OFF"}
								</span>
							</div>

							<div className="flex items-center justify-between pt-2 border-t border-white/5">
								<span className="text-[11px] text-zinc-400">
									Aura color smoothly adapts to video content
								</span>
								<button
									type="button"
									role="switch"
									aria-checked={ambientGlow}
									aria-label="Toggle Ambilight Ambient Glow"
									onClick={toggleAmbientGlow}
									className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 shrink-0 ${
										ambientGlow ? "bg-cyan-600" : "bg-zinc-800"
									}`}
								>
									<span
										className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
											ambientGlow ? "translate-x-5" : "translate-x-0"
										}`}
									/>
								</button>
							</div>
						</div>

						{/* Card 3: Audio Normalizer */}
						<div className="rounded-2xl p-4.5 bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-3 group">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
										<Volume2 className="w-4.5 h-4.5" />
									</div>
									<div>
										<div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
											<span>Channel Audio Normalizer</span>
										</div>
										<p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
											Hardware -12 dB dynamic limiter prevents sound spikes
										</p>
									</div>
								</div>

								<span
									className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
										normalizeAudio
											? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
											: "bg-white/5 text-zinc-500 border-white/10"
									}`}
								>
									{normalizeAudio ? "ACTIVE" : "BYPASS"}
								</span>
							</div>

							<div className="flex items-center justify-between pt-2 border-t border-white/5">
								<span className="text-[11px] text-zinc-400">
									Smooths volume variations between live channels
								</span>
								<button
									type="button"
									role="switch"
									aria-checked={normalizeAudio}
									aria-label="Toggle Channel Audio Normalizer"
									onClick={toggleNormalizeAudio}
									className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shrink-0 ${
										normalizeAudio ? "bg-emerald-600" : "bg-zinc-800"
									}`}
								>
									<span
										className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
											normalizeAudio ? "translate-x-5" : "translate-x-0"
										}`}
									/>
								</button>
							</div>
						</div>

						{/* Card 4: Cloud Sentinel Stream Sync */}
						<div className="rounded-2xl p-4.5 bg-gradient-to-br from-cyan-950/30 via-blue-950/20 to-black/40 border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-3 group">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
										<Cloud className="w-4.5 h-4.5" />
									</div>
									<div>
										<div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
											<span>Cloud Sentinel Sync</span>
											<span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
												Instant
											</span>
										</div>
										<p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
											Pull 7,200+ verified channels directly from cloud repository
										</p>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-between pt-2 border-t border-cyan-500/10">
								<span className="text-[10px] text-cyan-300/80 font-mono">
									Community verified links
								</span>
								<button
									type="button"
									onClick={syncCloudStreams}
									disabled={isSyncing}
									className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0 active:scale-95"
								>
									<RefreshCw
										className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
									/>
									<span>{isSyncing ? "Syncing..." : "Sync Cloud"}</span>
								</button>
							</div>
						</div>

						{/* Card 5: Anti-Stall Buffer Guard */}
						<div className="rounded-2xl p-4.5 bg-gradient-to-br from-emerald-950/25 via-[#09161a]/30 to-black/40 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-3 group">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
										<Zap className="w-4.5 h-4.5" />
									</div>
									<div>
										<div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
											<span>Anti-Stall Buffer Guard</span>
										</div>
										<p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
											Deep 60s buffer cushion & 0.2s keyframe nudge
										</p>
									</div>
								</div>

								<span className="flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
									ACTIVE
								</span>
							</div>

							<div className="flex items-center justify-between pt-2 border-t border-emerald-500/10 text-[10px] text-zinc-400 font-mono">
								<span className="flex items-center gap-1">
									<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
									Auto-failover to backup mirrors
								</span>
								<span className="text-emerald-400/90 font-bold">
									Zero-Freeze
								</span>
							</div>
						</div>
					</div>

					{/* Bottom System Bar & Actions */}
					<div className="rounded-2xl p-4 bg-zinc-900/50 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
						{/* App Info & Update Trigger */}
						<div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
							<div className="flex flex-col gap-0.5">
								<div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
									<span>MorningTV Desktop</span>
									<span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold font-mono">
										v1.0.0
									</span>
								</div>
								<div className="text-[10px] text-zinc-400">
									Windows 10 & 11 (64-bit) • Tauri 2.12 & Rust 1.98 Core
								</div>
							</div>

							<button
								type="button"
								onClick={() => checkForUpdates(true)}
								disabled={isCheckingUpdate}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-zinc-200 transition-all cursor-pointer disabled:opacity-50 shrink-0"
							>
								<RefreshCw
									className={`w-3.5 h-3.5 ${
										isCheckingUpdate ? "animate-spin text-cyan-400" : ""
									}`}
								/>
								<span>{isCheckingUpdate ? "Checking..." : "Check Updates"}</span>
							</button>
						</div>

						{/* Action Buttons */}
						<div className="flex items-center justify-end gap-3 w-full sm:w-auto">
							<button
								type="button"
								onClick={closeSettings}
								className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 transition-all cursor-pointer"
							>
								Cancel
							</button>

							<button
								type="submit"
								disabled={isSaving || isResetting || !playlistUrl.trim()}
								className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
							>
								{isSaving ? (
									<>
										<RefreshCw className="w-3.5 h-3.5 animate-spin" />
										<span>Indexing...</span>
									</>
								) : (
									<>
										<Save className="w-3.5 h-3.5" />
										<span>Save & Load</span>
									</>
								)}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
};
