import {
	ArrowDownCircle,
	Check,
	Cloud,
	Globe,
	RefreshCw,
	RotateCcw,
	Save,
	ShieldCheck,
	Sliders,
	Sparkles,
	Tv,
	Volume2,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";

type TabType = "playlist" | "cinema" | "audio" | "cloud" | "updates";

export const SettingsDialog: React.FC = () => {
	const {
		channels,
		totalChannels,
		refreshTotalChannelCount,
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
		updateInfo,
		updateStatus,
		updateProgress,
		triggerVirtualUpdate,
		startDownloadUpdate,
		dismissUpdate,
		relaunchApp,
	} = useAppStore();

	const [activeTab, setActiveTab] = useState<TabType>("playlist");
	const [playlistUrl, setPlaylistUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	useEffect(() => {
		if (settings?.playlist_url) {
			setPlaylistUrl(settings.playlist_url);
		}
	}, [settings?.playlist_url]);

	// Fetch full channel count whenever settings opens
	useEffect(() => {
		if (isSettingsOpen) {
			refreshTotalChannelCount();
		}
	}, [isSettingsOpen, refreshTotalChannelCount]);

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

	const totalChannelsCount = totalChannels > 0 ? totalChannels : channels.length;
	const isUpdateAvailable =
		updateStatus === "available" ||
		updateStatus === "downloading" ||
		updateStatus === "ready";

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

	const tabs = [
		{
			id: "playlist" as TabType,
			label: "Playlist & Channels",
			desc: "Stream link & library",
			icon: Tv,
			badge: totalChannelsCount > 0 ? totalChannelsCount.toLocaleString() : undefined,
			badgeStyle: "bg-white/10 text-cyan-300",
		},
		{
			id: "cinema" as TabType,
			label: "Cinema & Display",
			desc: "Ambient glow & buffer",
			icon: Sparkles,
			badge: ambientGlow ? "ON" : undefined,
			badgeStyle: "bg-cyan-500/20 text-cyan-300",
		},
		{
			id: "audio" as TabType,
			label: "Sound & Acoustics",
			desc: "Smart volume leveling",
			icon: Volume2,
			badge: normalizeAudio ? "ACTIVE" : undefined,
			badgeStyle: "bg-emerald-500/20 text-emerald-300",
		},
		{
			id: "cloud" as TabType,
			label: "Cloud Repository",
			desc: "Verified channel sync",
			icon: Cloud,
			badge: totalChannelsCount > 0 ? `${totalChannelsCount.toLocaleString()}` : undefined,
			badgeStyle: "bg-cyan-500/15 text-cyan-300",
		},
		{
			id: "updates" as TabType,
			label: "Software Update",
			desc: "App version & updates",
			icon: ArrowDownCircle,
			badge: isUpdateAvailable ? `UPDATE` : undefined,
			badgeStyle: "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-black",
		},
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl select-none p-3 sm:p-6 animate-in fade-in duration-200">
			<div
				className="w-full max-w-4xl min-h-[520px] max-h-[90vh] bg-[#090b14]/95 border border-white/10 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col md:flex-row overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Left Sidebar Navigation */}
				<div className="w-full md:w-64 bg-[#05070e]/85 border-b md:border-b-0 md:border-r border-white/5 p-4 sm:p-5 flex flex-col justify-between shrink-0">
					<div>
						{/* App Branding */}
						<div className="flex items-center gap-3 pb-5 mb-4 border-b border-white/5">
							<div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
								<Sliders className="w-4.5 h-4.5" />
							</div>
							<div>
								<h2 className="text-sm font-black text-white tracking-wider uppercase">
									MorningTV
								</h2>
								<p className="text-[11px] text-zinc-400 font-medium">
									Player Preferences
								</p>
							</div>
						</div>

						{/* Nav Pills */}
						<nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
							{tabs.map((tab) => {
								const Icon = tab.icon;
								const isActive = activeTab === tab.id;
								return (
									<button
										key={tab.id}
										type="button"
										onClick={() => setActiveTab(tab.id)}
										className={`group flex items-center justify-between w-full p-2.5 rounded-2xl text-left transition-all cursor-pointer shrink-0 ${
											isActive
												? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
												: "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
										}`}
									>
										<div className="flex items-center gap-2.5 min-w-0">
											<Icon
												className={`w-4 h-4 shrink-0 transition-colors ${
													isActive ? "text-white" : "text-zinc-400 group-hover:text-white"
												}`}
											/>
											<div className="truncate">
												<div className="text-xs font-bold truncate">
													{tab.label}
												</div>
												<div
													className={`text-[10px] hidden md:block truncate ${
														isActive ? "text-blue-100" : "text-zinc-500"
													}`}
												>
													{tab.desc}
												</div>
											</div>
										</div>

										{tab.badge && (
											<span
												className={`ml-2 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
													isActive
														? "bg-white/20 text-white"
														: tab.badgeStyle || "bg-white/10 text-cyan-300"
												}`}
											>
												{tab.badge}
											</span>
										)}
									</button>
								);
							})}
						</nav>
					</div>

					{/* Bottom System Info */}
					<div className="hidden md:flex items-center justify-between pt-4 border-t border-white/5">
						<div className="flex items-center gap-2">
							<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
							<span className="text-[11px] font-medium text-zinc-400">
								MorningTV Desktop
							</span>
						</div>
						<span className="text-[10px] font-mono text-zinc-500 font-bold">
							v1.0.0
						</span>
					</div>
				</div>

				{/* Right Content Area */}
				<div className="flex-1 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto bg-[#0b0e1a]/40">
					{/* Top Header of Active View */}
					<div>
						<div className="flex items-start justify-between pb-4 mb-5 border-b border-white/5">
							<div>
								<h3 className="text-base font-extrabold text-white tracking-wide">
									{activeTab === "playlist" && "Playlist & Channels"}
									{activeTab === "cinema" && "Cinema & Display"}
									{activeTab === "audio" && "Sound & Acoustics"}
									{activeTab === "cloud" && "Cloud Repository"}
									{activeTab === "updates" && "Software Update"}
								</h3>
								<p className="text-xs text-zinc-400 mt-0.5">
									{activeTab === "playlist" &&
										"Manage your streaming links, index channels, and sync cloud lists"}
									{activeTab === "cinema" &&
										"Customize visual ambient lighting and stream buffer stability"}
									{activeTab === "audio" &&
										"Fine-tune channel volume balance and prevent sudden loudness spikes"}
									{activeTab === "cloud" &&
										"Sync verified channels and backup mirrors directly from cloud repository"}
									{activeTab === "updates" &&
										"Check for new releases, install updates, and review changelogs"}
								</p>
							</div>

							<button
								onClick={closeSettings}
								className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10"
								title="Close (Esc)"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* TAB 1: PLAYLIST & CHANNELS */}
						{activeTab === "playlist" && (
							<form onSubmit={handleSave} className="flex flex-col gap-4">
								{/* Dynamic Channel Counter Card */}
								<div className="p-4.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-black/30 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
									<div className="flex items-center gap-3">
										<div className="w-11 h-11 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 flex items-center justify-center shrink-0">
											<Tv className="w-5 h-5" />
										</div>
										<div>
											<div className="flex items-center gap-2">
												<span className="text-2xl font-black text-white tracking-tight">
													{totalChannelsCount > 0
														? totalChannelsCount.toLocaleString()
														: "0"}
												</span>
												<span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-full">
													Verified Channels
												</span>
											</div>
											<p className="text-xs text-zinc-400 mt-0.5">
												Total channels currently loaded in your library
											</p>
										</div>
									</div>

									<button
										type="button"
										onClick={syncCloudStreams}
										disabled={isSyncing}
										className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0 self-end sm:self-auto"
									>
										<RefreshCw
											className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
										/>
										<span>{isSyncing ? "Syncing..." : "Sync Fresh List"}</span>
									</button>
								</div>

								{/* M3U Link Input Card */}
								<div className="rounded-2xl p-4.5 bg-white/[0.03] border border-white/10 flex flex-col gap-3">
									<div className="flex items-center justify-between flex-wrap gap-2">
										<div className="flex items-center gap-2">
											<Globe className="w-4 h-4 text-cyan-400" />
											<span className="text-xs font-bold text-white">
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
												className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1.5 cursor-pointer font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all"
											>
												<RotateCcw
													className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`}
												/>
												<span>Reset to Default</span>
											</button>
										)}
									</div>

									<input
										type="text"
										value={playlistUrl}
										onChange={(e) => setPlaylistUrl(e.target.value)}
										placeholder="https://.../playlist.m3u"
										className="w-full bg-[#05070d] text-xs text-white rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
									/>

									<p className="text-[11px] text-zinc-400">
										Paste any valid M3U or M3U8 link. All channels will be loaded and indexed automatically.
									</p>
								</div>

								{/* Action Buttons */}
								<div className="flex items-center justify-end gap-3 pt-2">
									<button
										type="submit"
										disabled={isSaving || isResetting || !playlistUrl.trim()}
										className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
									>
										{isSaving ? (
											<>
												<RefreshCw className="w-3.5 h-3.5 animate-spin" />
												<span>Indexing Channels...</span>
											</>
										) : (
											<>
												<Save className="w-3.5 h-3.5" />
												<span>Save & Load Playlist</span>
											</>
										)}
									</button>
								</div>
							</form>
						)}

						{/* TAB 2: CINEMA & DISPLAY */}
						{activeTab === "cinema" && (
							<div className="flex flex-col gap-4">
								{/* Ambilight Card */}
								<div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 flex flex-col gap-4">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 flex items-center justify-center shrink-0">
												<Sparkles className="w-5 h-5" />
											</div>
											<div>
												<h4 className="text-sm font-bold text-white">
													Ambilight Ambient Glow
												</h4>
												<p className="text-xs text-zinc-400 mt-0.5">
													Projects dynamic ambient colors on the wall behind the player
												</p>
											</div>
										</div>

										<button
											type="button"
											role="switch"
											aria-checked={ambientGlow}
											onClick={toggleAmbientGlow}
											className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
												ambientGlow ? "bg-cyan-600" : "bg-zinc-800"
											}`}
										>
											<span
												className={`absolute top-1 left-1 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
													ambientGlow ? "translate-x-5.5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>

									{/* Visual Preview Box */}
									<div className="relative h-20 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center bg-black/60">
										{ambientGlow && (
											<div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-cyan-500/30 to-purple-600/30 filter blur-xl animate-pulse" />
										)}
										<div className="relative z-10 flex items-center gap-2 text-xs text-zinc-300 font-medium">
											<div className="w-12 h-7 rounded-md bg-zinc-800 border border-white/20 flex items-center justify-center text-[9px] font-mono text-zinc-400">
												TV
											</div>
											<span>
												{ambientGlow
													? "Cinema aura is active and reacting to video colors"
													: "Ambient glow is currently turned off"}
											</span>
										</div>
									</div>
								</div>

								{/* Anti-Stall Buffer Card */}
								<div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 flex items-start justify-between gap-4">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
											<Zap className="w-5 h-5" />
										</div>
										<div>
											<div className="flex items-center gap-2">
												<h4 className="text-sm font-bold text-white">
													Smooth Stream Protection
												</h4>
												<span className="flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
													<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
													PROTECTED
												</span>
											</div>
											<p className="text-xs text-zinc-400 mt-0.5">
												Deep background buffering and automated failover keep playback smooth without freezing
											</p>
										</div>
									</div>

									<div className="text-emerald-400 text-xs font-bold shrink-0 flex items-center gap-1 pt-1">
										<ShieldCheck className="w-4 h-4" />
										<span>Zero-Freeze</span>
									</div>
								</div>
							</div>
						)}

						{/* TAB 3: AUDIO & ACOUSTICS */}
						{activeTab === "audio" && (
							<div className="flex flex-col gap-4">
								<div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 flex flex-col gap-4">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
												<Volume2 className="w-5 h-5" />
											</div>
											<div>
												<div className="flex items-center gap-2">
													<h4 className="text-sm font-bold text-white">
														Smart Volume Leveler
													</h4>
													{normalizeAudio && (
														<span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
															ACTIVE
														</span>
													)}
												</div>
												<p className="text-xs text-zinc-400 mt-0.5">
													Balances loudness variations between channels so switching never hurts your ears
												</p>
											</div>
										</div>

										<button
											type="button"
											role="switch"
											aria-checked={normalizeAudio}
											onClick={toggleNormalizeAudio}
											className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
												normalizeAudio ? "bg-emerald-600" : "bg-zinc-800"
											}`}
										>
											<span
												className={`absolute top-1 left-1 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
													normalizeAudio ? "translate-x-5.5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>

									{/* Simulated Audio Equalizer Bars */}
									<div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
										<span className="text-xs text-zinc-400">
											Dynamic range limiter & audio spike guard
										</span>
										<div className="flex items-end gap-1 h-5">
											<div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-5 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
										</div>
									</div>
								</div>
							</div>
						)}

						{/* TAB 4: CLOUD REPOSITORY */}
						{activeTab === "cloud" && (
							<div className="flex flex-col gap-4">
								{/* Cloud Repository Card */}
								<div className="rounded-2xl p-5 bg-gradient-to-br from-cyan-950/30 via-blue-950/20 to-black/40 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
											<Cloud className="w-5 h-5" />
										</div>
										<div>
											<h4 className="text-sm font-bold text-white">
												Cloud Repository Sync
											</h4>
											<p className="text-xs text-zinc-400 mt-0.5">
												Refreshes verified live streaming channels from the cloud mirror
											</p>
											<div className="text-[11px] text-cyan-300 font-mono mt-1 font-bold">
												{totalChannelsCount > 0
													? `${totalChannelsCount.toLocaleString()} channels currently verified`
													: "Ready to sync channels"}
											</div>
										</div>
									</div>

									<button
										type="button"
										onClick={syncCloudStreams}
										disabled={isSyncing}
										className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/25 shrink-0 active:scale-95"
									>
										<RefreshCw
											className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
										/>
										<span>{isSyncing ? "Syncing..." : "Sync Channels Now"}</span>
									</button>
								</div>

								{/* Cloud Mirror Health Card */}
								<div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 flex flex-col gap-3">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
											<ShieldCheck className="w-5 h-5" />
										</div>
										<div>
											<h4 className="text-sm font-bold text-white">
												High-Speed Cloud Resilience
											</h4>
											<p className="text-xs text-zinc-400 mt-0.5">
												All channels are verified with automatic fallback mirrors to ensure high availability
											</p>
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
										<div className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
											<span className="text-[10px] uppercase font-bold text-zinc-500">Live Channels</span>
											<span className="text-sm font-black text-cyan-300 font-mono">
												{totalChannelsCount > 0 ? totalChannelsCount.toLocaleString() : "8,300+"}
											</span>
										</div>
										<div className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
											<span className="text-[10px] uppercase font-bold text-zinc-500">Mirror Fallback</span>
											<span className="text-sm font-black text-emerald-400 font-mono">Multi-Server</span>
										</div>
										<div className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
											<span className="text-[10px] uppercase font-bold text-zinc-500">Sync Protocol</span>
											<span className="text-sm font-black text-white font-mono">HTTPS Cloud</span>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* TAB 5: SOFTWARE UPDATE */}
						{activeTab === "updates" && (
							<div className="flex flex-col gap-4">
								{!isUpdateAvailable ? (
									/* Default Clean Update Card */
									<div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 flex flex-col gap-4">
										<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0">
													<Check className="w-5 h-5" />
												</div>
												<div>
													<div className="flex items-center gap-2">
														<h4 className="text-sm font-bold text-white">
															MorningTV Desktop
														</h4>
														<span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold font-mono">
															v1.0.0
														</span>
													</div>
													<p className="text-xs text-zinc-400 mt-0.5">
														{updateStatus === "checking"
															? "Connecting to update server..."
															: updateStatus === "upToDate"
																? "Your desktop player is completely up to date"
																: updateStatus === "error"
																	? "Unable to connect to update server"
																	: "Your desktop player is active and running the latest release"}
													</p>
												</div>
											</div>

											<button
												type="button"
												onClick={() => checkForUpdates(true)}
												disabled={isCheckingUpdate}
												className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-zinc-200 transition-all cursor-pointer disabled:opacity-50 shrink-0"
											>
												<RefreshCw
													className={`w-3.5 h-3.5 ${
														isCheckingUpdate ? "animate-spin text-cyan-400" : ""
													}`}
												/>
												<span>
													{isCheckingUpdate
														? "Checking..."
														: updateStatus === "upToDate"
															? "Up to Date"
															: "Check for Updates"}
												</span>
											</button>
										</div>

										{/* Test Virtual Update Trigger */}
										<div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
											<span className="text-[11px] text-zinc-400">
												Want to preview how the update flow looks?
											</span>
											<button
												type="button"
												onClick={triggerVirtualUpdate}
												className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 font-bold cursor-pointer hover:underline px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 transition-all"
												title="Simulates a new update release so you can test the changelog, download and restart flow"
											>
												<Sparkles className="w-3.5 h-3.5 text-cyan-400" />
												<span>Test Virtual Update Flow (v1.1.0 Preview)</span>
											</button>
										</div>
									</div>
								) : (
									/* Expanded Update Showcase Card (Shows What's New & Download) */
									<div className="rounded-2xl p-5 bg-gradient-to-br from-blue-950/40 via-indigo-950/25 to-black/60 border border-blue-500/30 flex flex-col gap-4 shadow-xl shadow-blue-950/30 animate-in fade-in zoom-in-95 duration-200">
										{/* Update Header */}
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
													<ArrowDownCircle className="w-5 h-5 text-cyan-400 animate-pulse" />
												</div>
												<div>
													<div className="flex items-center gap-2">
														<h4 className="text-sm font-bold text-white">
															MorningTV Feature Update
														</h4>
														<span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold font-mono">
															v{updateInfo?.version || "1.1.0"} Available
														</span>
														{updateInfo?.isVirtual && (
															<span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold font-mono">
																TEST MODE
															</span>
														)}
													</div>
													<p className="text-xs text-zinc-400 mt-0.5">
														A new verified version is ready with performance and channel improvements
													</p>
												</div>
											</div>

											{updateStatus !== "downloading" && (
												<button
													type="button"
													onClick={dismissUpdate}
													className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
													title="Dismiss update view"
												>
													<X className="w-4 h-4" />
												</button>
											)}
										</div>

										{/* What's New Section */}
										<div className="flex flex-col gap-2 p-3.5 rounded-xl bg-black/40 border border-white/5">
											<div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
												<Sparkles className="w-3.5 h-3.5 text-cyan-400" />
												<span>What's New in this release:</span>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300">
												<div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
													<Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
													<div>
														<strong className="text-white font-semibold">Ultra-Fast 4K HLS:</strong>
														<span className="text-zinc-400 text-[11px] block">Sub-second channel switching & zero-stall buffer</span>
													</div>
												</div>
												<div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
													<Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
													<div>
														<strong className="text-white font-semibold">Cinema Ambilight:</strong>
														<span className="text-zinc-400 text-[11px] block">60fps dynamic aura lighting behind video player</span>
													</div>
												</div>
												<div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
													<Volume2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
													<div>
														<strong className="text-white font-semibold">Smart Volume Leveler:</strong>
														<span className="text-zinc-400 text-[11px] block">Automatic limiter prevents sudden loud channel spikes</span>
													</div>
												</div>
												<div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
													<ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
													<div>
														<strong className="text-white font-semibold">Zero-Freeze Stream Guard:</strong>
														<span className="text-zinc-400 text-[11px] block">Automated background failover to backup mirrors</span>
													</div>
												</div>
											</div>
										</div>

										{/* Download / Install Controls */}
										{updateStatus === "available" && (
											<div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-3">
												<span className="text-[11px] text-zinc-400 font-mono">
													Ed25519 Verified Package
												</span>
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={dismissUpdate}
														className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
													>
														Later
													</button>
													<button
														type="button"
														onClick={startDownloadUpdate}
														className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/25 active:scale-95"
													>
														<ArrowDownCircle className="w-3.5 h-3.5" />
														<span>Download & Install Now</span>
													</button>
												</div>
											</div>
										)}

										{/* Downloading Progress Bar */}
										{updateStatus === "downloading" && (
											<div className="flex flex-col gap-2 p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl">
												<div className="flex items-center justify-between text-xs font-bold text-cyan-300">
													<span className="flex items-center gap-2">
														<RefreshCw className="w-3.5 h-3.5 animate-spin" />
														<span>Downloading & verifying package...</span>
													</span>
													<span className="font-mono">{updateProgress}%</span>
												</div>
												<div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
													<div
														className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
														style={{ width: `${updateProgress}%` }}
													/>
												</div>
												<span className="text-[10px] text-zinc-400 font-mono">
													Silent background update in progress
												</span>
											</div>
										)}

										{/* Ready to Restart */}
										{updateStatus === "ready" && (
											<div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
												<div className="flex items-center gap-2.5 text-xs text-emerald-300 font-bold">
													<Check className="w-4 h-4 text-emerald-400 shrink-0" />
													<span>Update downloaded! Restart MorningTV to apply changes.</span>
												</div>
												<div className="flex items-center gap-2 self-end sm:self-auto">
													<button
														type="button"
														onClick={dismissUpdate}
														className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
													>
														Later
													</button>
													<button
														type="button"
														onClick={relaunchApp}
														className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
													>
														Restart Now
													</button>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>

					{/* Modal Footer Controls */}
					<div className="flex items-center justify-end pt-4 mt-6 border-t border-white/5">
						<button
							type="button"
							onClick={closeSettings}
							className="px-5 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 transition-all cursor-pointer active:scale-95"
						>
							Done
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
