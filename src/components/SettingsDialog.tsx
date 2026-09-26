import {
	Loader2,
	RotateCcw,
	Save,
	ShieldCheck,
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
		isVerifyingStreams,
		closeSettings,
		updatePlaylist,
		resetPlaylist,
		verifyAndCleanChannels,
		toggleAmbientGlow,
		toggleNormalizeAudio,
	} = useAppStore();

	const [playlistUrl, setPlaylistUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	useEffect(() => {
		if (settings?.playlist_url) {
			setPlaylistUrl(settings.playlist_url);
		}
	}, [settings?.playlist_url]);

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

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md select-none p-4 animate-in fade-in duration-150">
			<div
				className="w-full max-w-md bg-[#0b0e18] border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/90 flex flex-col gap-5"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-white/10 pb-3">
					<div>
						<h2 className="text-base font-extrabold text-white tracking-wide">
							Player Settings
						</h2>
						<p className="text-[11px] text-zinc-400">
							Manage IPTV playlist and playback options
						</p>
					</div>
					<button
						onClick={closeSettings}
						className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Settings Form */}
				<form onSubmit={handleSave} className="flex flex-col gap-4">
					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
								<span>M3U Playlist Source</span>
								{isCustomPlaylist ? (
									<span className="px-1.5 py-0.2 rounded-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold">
										Custom Link
									</span>
								) : (
									<span className="px-1.5 py-0.2 rounded-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
										Default Channels
									</span>
								)}
							</label>
							{isCustomPlaylist && (
								<button
									type="button"
									onClick={async () => {
										setIsResetting(true);
										await resetPlaylist();
										setPlaylistUrl("https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u");
										setIsResetting(false);
									}}
									disabled={isResetting || isSaving}
									className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold hover:underline"
								>
									<RotateCcw
										className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`}
									/>
									<span>Reset to Default</span>
								</button>
							)}
						</div>
						<input
							type="text"
							value={playlistUrl}
							onChange={(e) => setPlaylistUrl(e.target.value)}
							placeholder="e.g. https://.../morningtv_all.m3u"
							className="w-full bg-[#05070d] text-xs text-white rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
						/>
						<p className="text-[10px] text-zinc-500 mt-1">
							Supports massive playlists (e.g. iptv-org). Thousands of channels will be indexed smoothly.
						</p>
					</div>

					{/* Smart Stream Verifier & Link Healer */}
					<div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/30 border border-cyan-500/20 flex items-center justify-between gap-3">
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
								<ShieldCheck className="w-4 h-4" />
							</div>
							<div>
								<div className="text-xs font-bold text-white flex items-center gap-1.5">
									<span>Smart Stream Verifier</span>
									<span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
										Actual Probe
									</span>
								</div>
								<p className="text-[10px] text-zinc-400 mt-0.5">
									Deep byte inspection: drops dead streams & heals changed links
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={verifyAndCleanChannels}
							disabled={isVerifyingStreams}
							className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0"
						>
							{isVerifyingStreams ? (
								<>
									<Loader2 className="w-3.5 h-3.5 animate-spin" />
									<span>Verifying...</span>
								</>
							) : (
								<>
									<Sparkles className="w-3.5 h-3.5" />
									<span>Clean & Heal</span>
								</>
							)}
						</button>
					</div>

					{/* Ambilight Toggle */}
					<div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
						<div className="flex items-center gap-2.5">
							<Sparkles className="w-4 h-4 text-cyan-400" />
							<div>
								<div className="text-xs font-bold text-white">
									Ambilight Ambient Glow
								</div>
								<div className="text-[10px] text-zinc-400">
									Cinema aura effect behind video
								</div>
							</div>
						</div>
						<button
							type="button"
							onClick={toggleAmbientGlow}
							className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
								ambientGlow ? "bg-blue-600" : "bg-zinc-800"
							}`}
						>
							<span
								className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
									ambientGlow ? "translate-x-5" : "translate-x-0"
								}`}
							/>
						</button>
					</div>

					{/* Audio Normalization Toggle */}
					<div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
						<div className="flex items-center gap-2.5">
							<Volume2 className="w-4 h-4 text-emerald-400" />
							<div>
								<div className="text-xs font-bold text-white flex items-center gap-1.5">
									<span>Normalize Channel Audio</span>
									{normalizeAudio && (
										<span className="px-1.5 py-0.2 rounded-xs bg-emerald-500/30 text-emerald-300 text-[9px] font-bold">
											ACTIVE
										</span>
									)}
								</div>
								<div className="text-[10px] text-zinc-400">
									Smooth out loudness differences between channels (-12 dB limiter)
								</div>
							</div>
						</div>
						<button
							type="button"
							onClick={toggleNormalizeAudio}
							className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
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

					{/* Low Bandwidth Feature Callout */}
					<div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5">
						<Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
						<div className="text-[11px] text-zinc-300 leading-relaxed">
							<strong className="text-emerald-400 font-bold">
								Anti-Stall Active:
							</strong>{" "}
							Deep 60s buffer cushion, 0.2s keyframe nudge, and auto-failover to
							backup mirrors are enabled.
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center justify-between pt-3 border-t border-white/10">
						<div>
							{isCustomPlaylist && (
								<button
									type="button"
									onClick={async () => {
										setIsResetting(true);
										await resetPlaylist();
										setPlaylistUrl(DEFAULT_PLAYLIST_URL);
										setIsResetting(false);
									}}
									disabled={isResetting || isSaving}
									className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 border border-amber-500/30 rounded-xl transition-all cursor-pointer disabled:opacity-40"
									title="Clear custom URL and reload default starter channels"
								>
									<RotateCcw
										className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`}
									/>
									<span>{isResetting ? "Resetting..." : "Reset Default"}</span>
								</button>
							)}
						</div>
						<div className="flex items-center gap-2.5">
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
								className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
							>
								{isSaving ? (
									<>Indexing...</>
								) : (
									<>
										<Save className="w-3.5 h-3.5" />
										Save & Load
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
