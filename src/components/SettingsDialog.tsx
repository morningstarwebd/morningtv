import {
	ArrowDownCircle,
	Check,
	Cloud,
	Cpu,
	ExternalLink,
	Eye,
	EyeOff,
	Filter,
	Globe,
	Key,
	Monitor,
	Plus,
	Power,
	RefreshCw,
	Search,
	ShieldCheck,
	Sparkles,
	Trash2,
	Tv,
	Volume2,
	Wifi,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { APP_VERSION, type AiModelItem } from "../types";
import { MorningTVLogo } from "./MorningTVLogo";

const AI_PROVIDERS = [
	{
		id: "auto",
		name: "Auto-Detect",
		desc: "Key signature based auto-router",
		badge: "Smart",
		keyHint: "Detects provider automatically from key prefix (gsk_, AIzaSy, sk-...)",
		keyUrl: "",
		guideDesc: "Enter any provider's API key. MorningTV will automatically detect and configure the neural endpoint.",
	},
	{
		id: "groq",
		name: "Groq LPU (Meta Llama)",
		desc: "Llama 3.3 70B & 3.1 8B (Sub-second)",
		badge: "100% Free",
		keyHint: "Free API keys available instantly at console.groq.com",
		keyUrl: "https://console.groq.com/keys",
		guideDesc: "Groq LPUs deliver sub-second inference for Meta Llama 3.3 70B & 3.1 8B on their free tier with zero credit card required.",
	},
	{
		id: "gemini",
		name: "Google Gemini",
		desc: "Gemini 2.0 Flash / 1.5 Flash",
		badge: "Free Tier",
		keyHint: "Free API keys available at aistudio.google.com",
		keyUrl: "https://aistudio.google.com/app/apikey",
		guideDesc: "Google AI Studio provides generous free tier quotas for Gemini 2.0 Flash & Gemini 1.5 Flash.",
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		desc: "Multi-Provider Gateway & :free models",
		badge: "Free & Paid",
		keyHint: "Access free and premium models at openrouter.ai",
		keyUrl: "https://openrouter.ai/keys",
		guideDesc: "Access hundreds of open-source models, including popular free-tier models via OpenRouter.",
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		desc: "DeepSeek V3 & R1 Reasoner",
		badge: "Low Cost",
		keyHint: "Cost-effective reasoning at platform.deepseek.com",
		keyUrl: "https://platform.deepseek.com/api_keys",
		guideDesc: "High-performance coding and reasoning powered by DeepSeek V3 and DeepSeek R1.",
	},
	{
		id: "openai",
		name: "OpenAI",
		desc: "GPT-4o Mini & GPT-4o Omni",
		badge: "Commercial",
		keyHint: "Pay-as-you-go keys at platform.openai.com",
		keyUrl: "https://platform.openai.com/api-keys",
		guideDesc: "Official OpenAI access for state-of-the-art GPT-4o Mini and GPT-4o Omni reasoning.",
	},
	{
		id: "ollama",
		name: "Ollama (Local AI)",
		desc: "Offline models on localhost:11434",
		badge: "100% Free Offline",
		keyHint: "Runs 100% locally on your PC without internet or API key",
		keyUrl: "https://ollama.com",
		guideDesc: "Runs completely offline and private on your local PC. Requires Ollama running on localhost:11434.",
	},
];

type TabType =
	| "playlist"
	| "cinema"
	| "audio"
	| "ai"
	| "cloud"
	| "system"
	| "updates"
	| "about";

export const SettingsDialog: React.FC = () => {
	const {
		channels,
		allChannels,
		totalChannels,
		refreshTotalChannelCount,
		isSettingsOpen,
		showOnlyVerified,
		toggleShowOnlyVerified,
		ambientGlow,
		normalizeAudio,
		is3GDataSaver,
		toggle3GDataSaver,
		isLaunchAtStartup,
		toggleStartupStatus,
		openGitHubRepo,
		isSyncing,
		syncProgress,
		closeSettings,
		syncCloudStreams,
		forceRefreshChannels,
		toggleAmbientGlow,
		toggleNormalizeAudio,
		isCheckingUpdate,
		checkForUpdates,
		updateInfo,
		updateStatus,
		updateProgress,
		startDownloadUpdate,
		dismissUpdate,
		relaunchApp,
		settings,
		toggleAiBrain,
		addCustomSource,
		removeCustomSource,
		verifyAiKey,
		fetchProviderModels,
		setActiveAiModel,
		saveAiConfiguration,
		setAiPermissionLevel,
	} = useAppStore();

	const [activeTab, setActiveTab] = useState<TabType>("playlist");
	const [isFetchingGitHub, setIsFetchingGitHub] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<string>("auto");
	const [selectedModel, setSelectedModel] = useState<string>("");
	const [availableModelsList, setAvailableModelsList] = useState<AiModelItem[]>([]);
	const [isLoadingModels, setIsLoadingModels] = useState(false);
	const [modelSearchQuery, setModelSearchQuery] = useState("");
	const [showFreeOnly, setShowFreeOnly] = useState(false);
	const [aiKeyInput, setAiKeyInput] = useState("");
	const [aiEndpointInput, setAiEndpointInput] = useState("");
	const [showAiKey, setShowAiKey] = useState(false);
	const [showEndpointField, setShowEndpointField] = useState(false);
	const [isVerifyingAi, setIsVerifyingAi] = useState(false);
	const [aiVerifyResult, setAiVerifyResult] = useState<{
		success: boolean;
		provider_name?: string;
		active_model?: string;
		latency_ms?: number;
		message: string;
	} | null>(null);
	const [newSourceInput, setNewSourceInput] = useState("");
	const [isAddingSource, setIsAddingSource] = useState(false);

	const loadModelsForProvider = async (
		prov: string,
		key?: string,
		ep?: string,
	) => {
		setIsLoadingModels(true);
		try {
			const list = await fetchProviderModels(
				prov,
				key !== undefined ? key : aiKeyInput,
				ep !== undefined ? ep : aiEndpointInput,
			);
			setAvailableModelsList(list);
			if (list.length > 0) {
				setSelectedModel((prev) => {
					if (prev && list.some((m) => m.id === prev)) return prev;
					const freeOne = list.find((m) => m.is_free);
					return freeOne ? freeOne.id : list[0].id;
				});
			}
		} finally {
			setIsLoadingModels(false);
		}
	};

	useEffect(() => {
		const key = settings?.ai_api_key || settings?.groq_api_key || "";
		setAiKeyInput(key);
		if (settings?.ai_endpoint) {
			setAiEndpointInput(settings.ai_endpoint);
			setShowEndpointField(true);
		}
		if (settings?.ai_provider) {
			const p = settings.ai_provider.toLowerCase();
			if (p.includes("groq")) setSelectedProvider("groq");
			else if (p.includes("gemini") || p.includes("google")) setSelectedProvider("gemini");
			else if (p.includes("openrouter")) setSelectedProvider("openrouter");
			else if (p.includes("deepseek")) setSelectedProvider("deepseek");
			else if (p.includes("openai")) setSelectedProvider("openai");
			else if (p.includes("ollama") || p.includes("local")) setSelectedProvider("ollama");
			else setSelectedProvider("auto");
		}
		if (settings?.ai_model) {
			setSelectedModel(settings.ai_model);
		}
		if (settings?.ai_provider && key) {
			setAiVerifyResult({
				success: true,
				provider_name: settings.ai_provider,
				active_model: settings.ai_model || undefined,
				message: `Connected: ${settings.ai_provider}${settings.ai_model ? ` (${settings.ai_model})` : ""}`,
			});
		}
		const activeProv = settings?.ai_provider || "auto";
		loadModelsForProvider(activeProv, key, settings?.ai_endpoint || undefined);
	}, [
		settings?.ai_api_key,
		settings?.groq_api_key,
		settings?.ai_endpoint,
		settings?.ai_provider,
		settings?.ai_model,
	]);

	const handleFetchGitHub = async () => {
		setIsFetchingGitHub(true);
		try {
			await forceRefreshChannels();
			await refreshTotalChannelCount();
		} finally {
			setIsFetchingGitHub(false);
		}
	};

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

	const totalChannelsCount =
		totalChannels > 0 ? totalChannels : allChannels.length || 10528;
	const isUpdateAvailable =
		updateStatus === "available" ||
		updateStatus === "downloading" ||
		updateStatus === "ready";

	const verifiedChannelsCount = (
		allChannels.length > 0 ? allChannels : channels
	).filter((c) => Boolean(c.is_verified)).length;

	const tabs = [
		{
			id: "playlist" as TabType,
			label: "Playlist & Channels",
			desc: "Stream link & library",
			icon: Tv,
			badge:
				totalChannelsCount > 0
					? totalChannelsCount.toLocaleString()
					: undefined,
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
			id: "ai" as TabType,
			label: "AI Neural Engine",
			desc: "Universal Copilot & Sources",
			icon: Cpu,
			badge:
				settings?.ai_provider ||
				(settings?.ai_api_key || settings?.groq_api_key ? "ACTIVE" : undefined),
			badgeStyle: "bg-purple-500/20 text-purple-300 font-semibold",
		},
		{
			id: "cloud" as TabType,
			label: "Cloud Repository",
			desc: "Verified channel sync",
			icon: Cloud,
			badge:
				totalChannelsCount > 0
					? `${totalChannelsCount.toLocaleString()}`
					: undefined,
			badgeStyle: "bg-cyan-500/15 text-cyan-300",
		},
		{
			id: "system" as TabType,
			label: "System & Startup",
			desc: "Autostart & Tray Controls",
			icon: Monitor,
			badge: isLaunchAtStartup ? "AUTO-ON" : undefined,
			badgeStyle: "bg-emerald-500/20 text-emerald-300 font-bold",
		},
		{
			id: "updates" as TabType,
			label: "Software Update",
			desc: "App version & updates",
			icon: ArrowDownCircle,
			badge: isUpdateAvailable ? `UPDATE` : undefined,
			badgeStyle:
				"bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-black",
		},
		{
			id: "about" as TabType,
			label: "Legal & About",
			desc: "Compliance & attribution",
			icon: ShieldCheck,
		},
	];

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm select-none p-3 sm:p-6 animate-in fade-in duration-200"
			onClick={closeSettings}
		>
			<div
				className="w-[780px] max-w-[95vw] h-[550px] max-h-[92vh] bg-[#060814]/85 border border-white/15 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-row overflow-hidden relative backdrop-blur-2xl ring-1 ring-white/10"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Left Sidebar Navigation (Locked to exactly 240px - Zero Jitter/Shake) */}
				<div className="w-[240px] min-w-[240px] max-w-[240px] h-full bg-black/40 border-r border-white/10 p-3 sm:p-3.5 flex flex-col shrink-0 backdrop-blur-xl select-none">
					{/* App Branding (shrink-0) */}
					<div className="flex items-center gap-2.5 pb-3 mb-2 border-b border-white/10 shrink-0">
						<MorningTVLogo className="w-7 h-7" glow={true} />
						<div>
							<h2 className="text-xs font-black text-white tracking-wider uppercase">
								MorningTV
							</h2>
							<p className="text-[10px] text-zinc-300 font-medium">
								Player Preferences
							</p>
						</div>
					</div>

					{/* Nav Pills (Scrollable inside, firmly contained within modal bounds) */}
					<nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-1 pr-0.5">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							const isActive = activeTab === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => setActiveTab(tab.id)}
									className={`group flex items-center justify-between w-full p-2.5 rounded-xl text-left border cursor-pointer shrink-0 transition-colors duration-150 ${
										isActive
											? "bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white shadow-md shadow-cyan-600/30 border-cyan-400/40"
											: "border-transparent text-zinc-300 hover:text-white hover:bg-white/[0.08]"
									}`}
								>
									<div className="flex items-center gap-2 min-w-0">
										<Icon
											className={`w-3.5 h-3.5 shrink-0 transition-colors ${
												isActive
													? "text-white"
													: "text-zinc-400 group-hover:text-white"
											}`}
										/>
										<div className="truncate">
											<div className="text-xs font-bold truncate">
												{tab.label}
											</div>
											<div
												className={`text-[9px] block truncate ${
													isActive ? "text-cyan-100" : "text-zinc-400"
												}`}
											>
												{tab.desc}
											</div>
										</div>
									</div>

									{tab.badge && (
										<span
											className={`ml-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
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

					{/* Bottom System Info (Firmly anchored at the bottom, zero clipping) */}
					<div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/10 shrink-0">
						<div className="flex items-center gap-1.5">
							<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
							<span className="text-[10px] font-medium text-zinc-300">
								MorningTV Desktop
							</span>
						</div>
						<span className="text-[9px] font-mono text-zinc-400 font-bold">
							v{APP_VERSION}
						</span>
					</div>
				</div>

				{/* Right Content Area */}
				<div className="flex-1 min-w-0 h-full p-4 sm:p-5 flex flex-col overflow-hidden bg-black/20 backdrop-blur-md">
					{/* Top Header of Active View */}
					<div className="shrink-0 flex items-start justify-between pb-3 mb-3.5 border-b border-white/10">
						<div>
							<h3 className="text-sm font-bold text-white tracking-wide">
								{activeTab === "playlist" && "Playlist & Channels"}
								{activeTab === "cinema" && "Cinema & Display"}
								{activeTab === "audio" && "Sound & Acoustics"}
								{activeTab === "ai" && "AI Neural Engine & Sources"}
								{activeTab === "cloud" && "Cloud Repository"}
								{activeTab === "system" && "System & Startup"}
								{activeTab === "updates" && "Software Update"}
								{activeTab === "about" && "Legal & About"}
							</h3>
							<p className="text-[11px] text-zinc-400 mt-0.5">
								{activeTab === "playlist" &&
									"Manage streaming links, compatibility & verified channels"}
								{activeTab === "cinema" &&
									"Customize visual ambient lighting and stream buffer stability"}
								{activeTab === "audio" &&
									"Fine-tune channel volume balance and prevent sudden loudness spikes"}
								{activeTab === "ai" &&
									"Universal multi-model AI copilot (Groq, OpenAI, Gemini, Claude, OpenRouter, DeepSeek) & stream healing"}
								{activeTab === "cloud" &&
									"Sync verified channels and backup mirrors directly from cloud repository"}
								{activeTab === "system" &&
									"Windows boot autostart, system tray quick controls, and GitHub integration"}
								{activeTab === "updates" &&
									"Check for new releases, install updates, and review changelogs"}
								{activeTab === "about" &&
									"Compliance, open-source attribution, and architecture"}
							</p>
						</div>

						<button
							onClick={closeSettings}
							className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
							title="Close (Esc)"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					{/* Content Container (dynamically fills vertical space with custom scrollbar, zero clipping) */}
					<div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-start gap-3.5 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-white/15 hover:scrollbar-thumb-white/25 scrollbar-track-transparent">
						{/* TAB 1: PLAYLIST & CHANNELS */}
						{activeTab === "playlist" && (
							<div className="flex flex-col gap-3.5">
								{/* Card 1: Cloud Channels Library */}
								<div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors flex items-center justify-between gap-3">
									<div className="flex items-center gap-3 min-w-0">
										<div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 shadow-sm">
											<Tv className="w-4 h-4" />
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="text-lg sm:text-xl font-bold tracking-tight text-white">
													{totalChannelsCount > 0
														? totalChannelsCount.toLocaleString()
														: "11,046"}
												</span>
												<span className="text-[11px] text-zinc-400 font-medium">
													Total Channels
												</span>
												<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
													<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
													Cloud Synced
												</span>
											</div>
											<p className="text-[10px] text-zinc-400 mt-0.5 truncate">
												GitHub Master Cloud Feed • Updated automatically
											</p>
										</div>
									</div>

									<button
										type="button"
										onClick={handleFetchGitHub}
										disabled={isFetchingGitHub || isSyncing}
										className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-white/10 text-zinc-200 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shrink-0 shadow-sm"
										title="Fetch latest channels directly from GitHub"
									>
										<RefreshCw
											className={`w-3 h-3 ${
												isFetchingGitHub ? "animate-spin text-cyan-400" : ""
											}`}
										/>
										<span>
											{isFetchingGitHub ? "Fetching..." : "Fetch Master"}
										</span>
									</button>
								</div>

								{/* Card 2: Local ISP Stream Verification */}
								<div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors flex flex-col gap-2.5">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-3 min-w-0">
											<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
												<Wifi className="w-4 h-4" />
											</div>
											<div className="min-w-0">
												<h4 className="text-xs font-semibold text-white tracking-normal">
													Local ISP Stream Verification
												</h4>
												<p className="text-[10px] text-zinc-400 mt-0.5">
													Audits live streams on your connection and auto-promotes backup mirrors
												</p>
											</div>
										</div>

										<button
											type="button"
											onClick={syncCloudStreams}
											disabled={isSyncing || isFetchingGitHub}
											className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 active:scale-95 text-white text-[11px] font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-sm shrink-0"
										>
											<RefreshCw
												className={`w-3 h-3 ${
													isSyncing ? "animate-spin" : ""
												}`}
											/>
											<span>
												{isSyncing
													? "Auditing Network..."
													: "Verify on My Network"}
											</span>
										</button>
									</div>

									{/* Live Audit Progress (Clean Glassmorphism Panel) */}
									{(isSyncing ||
										(syncProgress && !syncProgress.is_complete)) && (
										<div className="rounded-lg p-2.5 bg-white/[0.025] border border-cyan-500/20 flex flex-col gap-2 shadow-sm">
											<div className="flex items-center justify-between text-[11px]">
												<div className="flex items-center gap-1.5 min-w-0">
													<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
													<span className="font-medium text-zinc-200 truncate">
														{syncProgress?.phase ||
															"Testing stream mirrors on your network..."}
													</span>
												</div>
												<span className="font-mono font-bold text-cyan-300 text-[11px] shrink-0 ml-2">
													{syncProgress?.percent ?? 0}%
												</span>
											</div>

											<div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
												<div
													className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 rounded-full transition-all duration-300"
													style={{ width: `${syncProgress?.percent ?? 0}%` }}
												/>
											</div>

											<div className="flex items-center justify-between text-[10px] text-zinc-400">
												<span className="text-zinc-300 font-medium">
													{syncProgress?.updated_count
														? `⚡ ${syncProgress.updated_count} mirrors optimized`
														: "Testing latency..."}
												</span>
												<span className="font-mono text-cyan-400 font-semibold text-[9.5px]">
													{syncProgress?.total_count
														? `${syncProgress.total_count.toLocaleString()} Channels`
														: `${totalChannelsCount.toLocaleString()} Channels`}
												</span>
											</div>
										</div>
									)}
								</div>

								{/* Card 3: Playback Filter Mode (Independent Card) */}
								<div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
									<div className="min-w-0">
										<h4 className="text-xs font-semibold text-white tracking-normal">
											Playback Filter Mode
										</h4>
										<p className="text-[10px] text-zinc-400 mt-0.5">
											{showOnlyVerified
												? "Showing only streams verified to work on your network"
												: "Showing all channels from the cloud library"}
										</p>
									</div>

									{/* Clean Segmented Switch: All Channels vs Verified Only */}
									<div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 shrink-0 self-start sm:self-auto">
										<button
											type="button"
											onClick={() => {
												if (showOnlyVerified) {
													toggleShowOnlyVerified();
												}
											}}
											className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
												!showOnlyVerified
													? "bg-white/20 text-white shadow-sm"
													: "text-zinc-400 hover:text-white"
											}`}
										>
											All (
											{totalChannelsCount > 0
												? totalChannelsCount.toLocaleString()
												: "11,046"}
											)
										</button>
										<button
											type="button"
											onClick={() => {
												if (!showOnlyVerified) {
													toggleShowOnlyVerified();
												}
											}}
											className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
												showOnlyVerified
													? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25"
													: "text-zinc-400 hover:text-white"
											}`}
										>
											<span
												className={`w-1.5 h-1.5 rounded-full ${
													showOnlyVerified
														? "bg-emerald-400 animate-pulse"
														: "bg-zinc-500"
												}`}
											/>
											Verified Only ({verifiedChannelsCount.toLocaleString()})
										</button>
									</div>
								</div>
							</div>
						)}

						{/* TAB 2: CINEMA & DISPLAY */}
						{activeTab === "cinema" && (
							<div className="flex flex-col gap-2.5">
								{/* Ambilight Card */}
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2">
									<div className="flex items-start justify-between gap-2.5">
										<div className="flex items-center gap-2.5">
											<div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 flex items-center justify-center shrink-0">
												<Sparkles className="w-4 h-4" />
											</div>
											<div>
												<h4 className="text-xs font-semibold text-white">
													Ambilight Ambient Glow
												</h4>
												<p className="text-[10px] text-zinc-400 mt-0.5">
													Projects dynamic ambient colors on the wall behind the player
												</p>
											</div>
										</div>

										<button
											type="button"
											role="switch"
											aria-checked={ambientGlow}
											onClick={toggleAmbientGlow}
											className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
												ambientGlow ? "bg-cyan-600" : "bg-zinc-800"
											}`}
										>
											<span
												className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
													ambientGlow ? "translate-x-4.5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>

									{/* Visual Preview Box */}
									<div className="relative h-10 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-black/60">
										{ambientGlow && (
											<div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-cyan-500/30 to-purple-600/30 filter blur-xl animate-pulse" />
										)}
										<div className="relative z-10 flex items-center gap-2 text-[10px] text-zinc-300 font-medium">
											<div className="w-8 h-5 rounded bg-zinc-800 border border-white/20 flex items-center justify-center text-[8px] font-mono text-zinc-400">
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
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex items-start justify-between gap-3">
									<div className="flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
											<Zap className="w-4 h-4" />
										</div>
										<div>
											<div className="flex items-center gap-2">
												<h4 className="text-xs font-semibold text-white">
													Smooth Stream Protection
												</h4>
												<span className="flex items-center gap-1 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
													<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
													PROTECTED
												</span>
											</div>
											<p className="text-[10px] text-zinc-400 mt-0.5">
												Deep background buffering and automated failover keep playback smooth without freezing
											</p>
										</div>
									</div>

									<div className="text-emerald-400 text-[10px] font-bold shrink-0 flex items-center gap-1 pt-0.5">
										<ShieldCheck className="w-3.5 h-3.5" />
										<span>Zero-Freeze</span>
									</div>
								</div>
							</div>
						)}

						{/* TAB 3: AUDIO & ACOUSTICS */}
						{activeTab === "audio" && (
							<div className="flex flex-col gap-2.5">
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-2.5">
											<div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
												<Volume2 className="w-4 h-4" />
											</div>
											<div>
												<div className="flex items-center gap-2">
													<h4 className="text-xs font-semibold text-white">
														Smart Volume Leveler
													</h4>
													{normalizeAudio && (
														<span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-bold">
															ACTIVE
														</span>
													)}
												</div>
												<p className="text-[10px] text-zinc-400 mt-0.5">
													Balances loudness variations between channels so switching never hurts your ears
												</p>
											</div>
										</div>

										<button
											type="button"
											role="switch"
											aria-checked={normalizeAudio}
											onClick={toggleNormalizeAudio}
											className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
												normalizeAudio ? "bg-emerald-600" : "bg-zinc-800"
											}`}
										>
											<span
												className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
													normalizeAudio ? "translate-x-4.5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>

									{/* Simulated Audio Equalizer Bars */}
									<div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
										<span className="text-[10px] text-zinc-400">
											Dynamic range limiter & audio spike guard
										</span>
										<div className="flex items-end gap-1 h-3.5">
											<div className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-3.5 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
											<div className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse" />
										</div>
									</div>
								</div>
							</div>
						)}

						{/* TAB: AI BRAIN & SOURCES */}
						{activeTab === "ai" && (
							<div className="flex flex-col gap-3.5">
								{/* Card 1: Universal AI Neural Engine */}
								<div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors flex flex-col gap-3">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2.5 min-w-0">
											<div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 shadow-sm">
												<Cpu className="w-4 h-4" />
											</div>
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<h4 className="text-xs font-semibold text-white tracking-normal">
														AI Neural Engine
													</h4>
													<span className="px-1.5 py-0.5 text-[9px] font-medium rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
														{settings?.ai_provider || "Multi-Provider"}
													</span>
												</div>
												<p className="text-[10px] text-zinc-400 mt-0.5">
													Multi-model voice copilot, semantic channel navigation & autonomous stream healing
												</p>
											</div>
										</div>

										{/* Toggle Switch */}
										<button
											type="button"
											onClick={toggleAiBrain}
											className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
												settings?.ai_brain_enabled
													? "bg-purple-600"
													: "bg-white/10"
											}`}
										>
											<div
												className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${
													settings?.ai_brain_enabled
														? "translate-x-5"
														: "translate-x-0"
												}`}
											/>
										</button>
									</div>

									{/* Step 1: Select AI Provider */}
									<div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
										<div className="flex items-center justify-between">
											<span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
												<Cpu className="w-3 h-3 text-purple-400" />
												<span>AI Provider</span>
											</span>
											<span className="text-[9.5px] text-zinc-400">
												Choose provider to fetch live models
											</span>
										</div>

										<div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
											{AI_PROVIDERS.map((prov) => {
												const isSelected = selectedProvider === prov.id;
												return (
													<button
														key={prov.id}
														type="button"
														onClick={() => {
															setSelectedProvider(prov.id);
															if (prov.id === "ollama") {
																setShowEndpointField(true);
																if (!aiEndpointInput) {
																	setAiEndpointInput("http://localhost:11434/v1");
																}
															}
															loadModelsForProvider(
																prov.id,
																aiKeyInput,
																prov.id === "ollama" ? (aiEndpointInput || "http://localhost:11434/v1") : aiEndpointInput,
															);
														}}
														className={`p-2 rounded-lg text-left transition-all border flex flex-col gap-0.5 cursor-pointer relative ${
															isSelected
																? "bg-purple-600/20 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/40"
																: "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
														}`}
													>
														<div className="flex items-center justify-between gap-1">
															<span className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-zinc-200"}`}>
																{prov.name}
															</span>
															<span className={`text-[7.5px] font-bold px-1 py-0.2 rounded ${
																prov.badge.includes("Free") || prov.badge.includes("100%")
																	? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
																	: "bg-white/10 text-zinc-400"
															}`}>
																{prov.badge}
															</span>
														</div>
														<span className="text-[8.5px] text-zinc-400 line-clamp-1">
															{prov.desc}
														</span>
													</button>
												);
											})}
										</div>

										{/* Selected Provider Guidance Box */}
										{(() => {
											const provObj = AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0];
											return (
												<div className="p-2 sm:p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-0.5">
													<div className="flex flex-col gap-0.5 min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="text-[11px] font-bold text-purple-200">
																{provObj.name}
															</span>
															<span className="text-[8.5px] font-semibold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
																{provObj.badge}
															</span>
														</div>
														<p className="text-[10px] text-zinc-300 leading-snug">
															{provObj.guideDesc}
														</p>
													</div>
													{provObj.keyUrl && (
														<button
															type="button"
															onClick={() => window.open(provObj.keyUrl, "_blank")}
															className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0 border border-white/15 shadow-sm active:scale-95"
														>
															<ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
															<span>{provObj.id === "groq" ? "Get Free Groq Key" : "Get API Key"}</span>
														</button>
													)}
												</div>
											);
										})()}
									</div>

									{/* Step 2: API Key Input Section */}
									<div className="flex flex-col gap-2 pt-2 border-t border-white/5">
										<div className="flex items-center justify-between">
											<label
												htmlFor="universal-ai-key-input"
												className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5"
											>
												<Key className="w-3.5 h-3.5 text-purple-400" />
												<span>API Key</span>
											</label>
											<span className="text-[10px] text-zinc-400">
												{selectedProvider === "ollama"
													? "Ollama is 100% free & offline (no key needed)"
													: "Encrypted & stored locally on your device"}
											</span>
										</div>

										<div className="flex items-center gap-2">
											<div className="relative flex-1">
												<input
													id="universal-ai-key-input"
													type={showAiKey ? "text" : "password"}
													value={aiKeyInput}
													onChange={(e) => setAiKeyInput(e.target.value)}
													placeholder={
														selectedProvider === "groq"
															? "Paste Groq API Key (gsk_...) - 100% Free Rate Limits"
															: selectedProvider === "gemini"
																? "Paste Google Gemini API Key (AIzaSy...) - Free Flash Tier"
																: selectedProvider === "openrouter"
																	? "Paste OpenRouter API Key (sk-or-...) - Has :free models"
																	: selectedProvider === "deepseek"
																		? "Paste DeepSeek API Key (dsk_... or sk-...)"
																		: selectedProvider === "openai"
																			? "Paste OpenAI API Key (sk-proj-... / sk-...)"
																			: selectedProvider === "ollama"
																				? "Local Ollama requires no key (leave empty)"
																				: "Paste API Key (gsk_..., sk-..., AIzaSy..., dsk_...)"
													}
													className="w-full px-2.5 py-1.5 pr-8 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 font-mono transition-colors"
												/>
												<button
													type="button"
													onClick={() => setShowAiKey(!showAiKey)}
													className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
													title={showAiKey ? "Hide key" : "Show key"}
												>
													{showAiKey ? (
														<EyeOff className="w-3 h-3" />
													) : (
														<Eye className="w-3 h-3" />
													)}
												</button>
											</div>

											{/* Verify & Connect Button */}
											<button
												type="button"
												disabled={isVerifyingAi || (!aiKeyInput.trim() && selectedProvider !== "ollama")}
												onClick={async () => {
													setIsVerifyingAi(true);
													setAiVerifyResult(null);
													try {
														const res = await verifyAiKey(
															aiKeyInput.trim(),
															aiEndpointInput.trim() || null,
															selectedProvider,
															selectedModel || null,
														);
														setAiVerifyResult(res);
														if (res.success) {
															await saveAiConfiguration({
																apiKey: aiKeyInput.trim() || (selectedProvider === "ollama" ? "local" : null),
																provider: res.provider_name || selectedProvider,
																model: selectedModel || res.active_model,
																endpoint: res.endpoint,
															});
															// Refresh models with verified connection
															loadModelsForProvider(selectedProvider, aiKeyInput, aiEndpointInput);
														}
													} catch (err) {
														setAiVerifyResult({
															success: false,
															message: String(err),
														});
													} finally {
														setIsVerifyingAi(false);
													}
												}}
												className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-[11px] font-semibold text-white transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm active:scale-95"
											>
												<Zap
													className={`w-3 h-3 ${
														isVerifyingAi ? "animate-spin" : ""
													}`}
												/>
												<span>
													{isVerifyingAi ? "Connecting..." : "Verify & Connect"}
												</span>
											</button>

											{/* Clear / Disconnect if present */}
											{(settings?.ai_api_key || settings?.groq_api_key) && (
												<button
													type="button"
													onClick={async () => {
														setAiKeyInput("");
														setAiVerifyResult(null);
														await saveAiConfiguration({
															apiKey: null,
															provider: null,
															model: null,
															endpoint: null,
														});
													}}
													className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-white/10 text-[11px] transition-colors cursor-pointer shrink-0"
													title="Disconnect and remove key"
												>
													Disconnect
												</button>
											)}
										</div>
									</div>

									{/* Step 3: Live Model Picker from Provider Server */}
									<div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1.5">
												<Sparkles className="w-3.5 h-3.5 text-cyan-400" />
												<span className="text-xs font-semibold text-zinc-200">
													Available Live Models
												</span>
												<span className="text-[10px] text-zinc-400 font-mono">
													({(() => {
														const list = availableModelsList.filter((m) => {
															const matchesSearch = !modelSearchQuery.trim() || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase());
															const matchesFree = !showFreeOnly || m.is_free;
															return matchesSearch && matchesFree;
														});
														return `${list.length} of ${availableModelsList.length}`;
													})()})
												</span>
											</div>
											<button
												type="button"
												onClick={() => loadModelsForProvider(selectedProvider)}
												disabled={isLoadingModels}
												className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
											>
												<RefreshCw className={`w-3 h-3 ${isLoadingModels ? "animate-spin" : ""}`} />
												<span>{isLoadingModels ? "Fetching..." : "Refresh Live"}</span>
											</button>
										</div>

										{/* Search Bar & Free Filter Switch */}
										<div className="flex items-center gap-1.5">
											<div className="relative flex-1">
												<Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
												<input
													type="text"
													value={modelSearchQuery}
													onChange={(e) => setModelSearchQuery(e.target.value)}
													placeholder="Search models (llama-3.3, 8b, flash, r1)..."
													className="w-full pl-7 pr-6 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono transition-colors"
												/>
												{modelSearchQuery && (
													<button
														type="button"
														onClick={() => setModelSearchQuery("")}
														className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
													>
														<X className="w-2.5 h-2.5" />
													</button>
												)}
											</div>

											{/* Free Tier Filter Button */}
											<button
												type="button"
												onClick={() => setShowFreeOnly(!showFreeOnly)}
												className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border flex items-center gap-1 cursor-pointer shrink-0 ${
													showFreeOnly
														? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
														: "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
												}`}
											>
												<Filter className="w-2.5 h-2.5 text-emerald-400" />
												<span>{showFreeOnly ? "🟢 Free Only" : "All Models"}</span>
											</button>
										</div>

										{isLoadingModels ? (
											<div className="p-3 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center gap-2 text-zinc-300 text-[11px]">
												<RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
												<span>Fetching live models from {selectedProvider} server...</span>
											</div>
										) : availableModelsList.length === 0 ? (
											<div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-center text-zinc-400 text-[10px]">
												Click "Refresh Live" or connect API key to fetch server models.
											</div>
										) : (() => {
											const filtered = availableModelsList.filter((m) => {
												const matchesSearch = !modelSearchQuery.trim() || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase());
												const matchesFree = !showFreeOnly || m.is_free;
												return matchesSearch && matchesFree;
											});
											if (filtered.length === 0) {
												return (
													<div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-center text-zinc-400 text-[10px]">
														No models match "{modelSearchQuery}" with current filters.
													</div>
												);
											}
											return (
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">
													{filtered.map((m) => {
														const isModelActive = selectedModel === m.id;
														return (
															<button
																key={m.id}
																type="button"
																onClick={async () => {
																	setSelectedModel(m.id);
																	if (settings?.ai_api_key || settings?.groq_api_key) {
																		await setActiveAiModel(m.id);
																	}
																}}
																className={`p-1.5 px-2 rounded-lg text-left transition-all border flex items-center justify-between gap-1.5 cursor-pointer ${
																	isModelActive
																		? "bg-purple-600/30 border-purple-500/70 text-white shadow-md ring-1 ring-purple-500/40"
																		: "bg-white/[0.02] border-white/5 text-zinc-300 hover:bg-white/[0.06] hover:border-white/15"
																}`}
															>
																<div className="flex items-center gap-1.5 min-w-0">
																	{isModelActive && (
																		<Check className="w-2.5 h-2.5 text-purple-400 shrink-0" />
																	)}
																	<span className={`text-[10px] font-mono truncate ${isModelActive ? "font-bold text-white" : "text-zinc-200"}`}>
																		{m.id}
																	</span>
																</div>
																{m.is_free ? (
																	<span className="px-1 py-0.2 rounded text-[7.5px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shrink-0">
																		FREE
																	</span>
																) : (
																	<span className="text-[7.5px] text-zinc-500 font-medium shrink-0">STD</span>
																)}
															</button>
														);
													})}
												</div>
											);
										})()}

										{/* Pro tip */}
										<div className="text-[9.5px] text-zinc-400 flex items-center gap-1 pt-0.5">
											<span className="text-purple-400 font-bold">💡 Tip:</span>
											<span>Switch models in chat with <code className="text-purple-300 bg-white/5 px-1 rounded font-mono">\model &lt;name&gt;</code>.</span>
										</div>
									</div>

									{/* Step 4: Autonomous Permissions & Stream Doctor Gating */}
									<div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1.5">
												<ShieldCheck className="w-3 h-3 text-emerald-400" />
												<span className="text-[11px] font-semibold text-zinc-200">
													Autonomous Superpowers & Database Permissions
												</span>
											</div>
											<span className="text-[9px] text-zinc-400 font-mono">
												Antigravity 3-Tier Gated
											</span>
										</div>
										<p className="text-[10px] text-zinc-400">
											Choose how much autonomy the AI Brain has to diagnose failed streams, hunt mirrors, and modify your SQLite database.
										</p>

										<div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-0.5">
											{/* Full Autonomous */}
											<button
												type="button"
												onClick={() => setAiPermissionLevel("full_access")}
												className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
													(settings?.ai_permission_level ?? "full_access") === "full_access"
														? "bg-emerald-500/15 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30 text-white"
														: "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
												}`}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1">
														<Zap className="w-3 h-3 text-emerald-400" />
														<span className="text-[11px] font-bold text-emerald-300">Full Access</span>
													</div>
													{(settings?.ai_permission_level ?? "full_access") === "full_access" && (
														<Check className="w-3 h-3 text-emerald-400" />
													)}
												</div>
												<p className="text-[9.5px] text-zinc-300 leading-snug">
													Autonomous healing. Auto-recovers broken channels and writes directly to database without prompting.
												</p>
												<span className="text-[8.5px] font-mono text-emerald-400/90 font-semibold mt-auto">
													● Recommended
												</span>
											</button>

											{/* Ask Permission */}
											<button
												type="button"
												onClick={() => setAiPermissionLevel("ask_permission")}
												className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
													settings?.ai_permission_level === "ask_permission"
														? "bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/30 text-white"
														: "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
												}`}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1">
														<ShieldCheck className="w-3 h-3 text-amber-400" />
														<span className="text-[11px] font-bold text-amber-300">Ask Permission</span>
													</div>
													{settings?.ai_permission_level === "ask_permission" && (
														<Check className="w-3 h-3 text-amber-400" />
													)}
												</div>
												<p className="text-[9.5px] text-zinc-300 leading-snug">
													Semi-Autonomous. Stream Doctor finds working mirrors, but requires 1-click confirmation before writing to DB.
												</p>
												<span className="text-[8.5px] font-mono text-amber-400/90 font-semibold mt-auto">
													● Interactive
												</span>
											</button>

											{/* Read Only */}
											<button
												type="button"
												onClick={() => setAiPermissionLevel("read_only")}
												className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
													settings?.ai_permission_level === "read_only"
														? "bg-rose-500/15 border-rose-500/60 shadow-md ring-1 ring-rose-500/30 text-white"
														: "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
												}`}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1">
														<Eye className="w-3 h-3 text-rose-400" />
														<span className="text-[11px] font-bold text-rose-300">Read-Only</span>
													</div>
													{settings?.ai_permission_level === "read_only" && (
														<Check className="w-3 h-3 text-rose-400" />
													)}
												</div>
												<p className="text-[9.5px] text-zinc-300 leading-snug">
													Diagnostics Only. Database writes locked. AI only provides telemetry, suggestions, and EPG recommendations.
												</p>
												<span className="text-[8.5px] font-mono text-rose-400/90 font-semibold mt-auto">
													● Locked
												</span>
											</button>
										</div>
									</div>

									{/* Advanced Custom Endpoint & Verification Result */}
									<div className="flex flex-col gap-2 pt-1 border-t border-white/5">
										<div className="pt-1">
											<button
												type="button"
												onClick={() => setShowEndpointField(!showEndpointField)}
												className="text-[11px] text-zinc-400 hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
											>
												<span>
													{showEndpointField ? "▼" : "▶"} Advanced: Custom
													Endpoint (Ollama / Local AI)
												</span>
											</button>
											{showEndpointField && (
												<div className="mt-1.5 flex items-center gap-2 animate-in fade-in">
													<input
														type="url"
														value={aiEndpointInput}
														onChange={(e) => setAiEndpointInput(e.target.value)}
														placeholder="http://localhost:11434/v1 or custom gateway"
														className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
													/>
												</div>
											)}
										</div>

										{/* Test & Verification Result Card */}
										{aiVerifyResult && (
											<div
												className={`mt-1 p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
													aiVerifyResult.success
														? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
														: "bg-rose-500/10 border-rose-500/25 text-rose-300"
												}`}
											>
												<div className="flex items-center gap-2">
													{aiVerifyResult.success ? (
														<Check className="w-4 h-4 shrink-0 text-emerald-400" />
													) : (
														<X className="w-4 h-4 shrink-0 text-rose-400" />
													)}
													<span className="font-semibold">
														{aiVerifyResult.success
															? `${aiVerifyResult.provider_name || "Provider"} Connected Successfully`
															: "Verification Failed"}
													</span>
													{aiVerifyResult.latency_ms !== undefined && (
														<span className="ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
															⚡ {aiVerifyResult.latency_ms}ms
														</span>
													)}
												</div>
												{aiVerifyResult.active_model && (
													<p className="text-[11px] text-emerald-300/80 pl-6">
														Active Model:{" "}
														<span className="font-mono font-bold text-white">
															{aiVerifyResult.active_model}
														</span>
													</p>
												)}
												<p className="text-[10px] opacity-80 pl-6">
													{aiVerifyResult.message}
												</p>
											</div>
										)}
									</div>
								</div>

								{/* Card 2: Custom Upstream Sources */}
								<div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors flex flex-col gap-2.5">
									<div className="flex items-center gap-2.5 min-w-0">
										<div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 shadow-sm">
											<Globe className="w-4 h-4" />
										</div>
										<div className="min-w-0">
											<h4 className="text-xs font-semibold text-white tracking-normal">
												Custom Upstream Sources
											</h4>
											<p className="text-[10px] text-zinc-400 mt-0.5">
												Add custom M3U playlist URLs for Sentinel to search & heal channels
											</p>
										</div>
									</div>

									{/* Add Custom Source Input */}
									<div className="flex items-center gap-1.5">
										<input
											type="url"
											value={newSourceInput}
											onChange={(e) => setNewSourceInput(e.target.value)}
											placeholder="https://example.com/live.m3u8 or .m3u"
											className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[10px] text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 font-mono transition-colors"
										/>
										<button
											type="button"
											disabled={isAddingSource || !newSourceInput.trim()}
											onClick={async () => {
												if (!newSourceInput.trim()) return;
												setIsAddingSource(true);
												try {
													await addCustomSource(newSourceInput.trim());
													setNewSourceInput("");
												} finally {
													setIsAddingSource(false);
												}
											}}
											className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-[10px] font-semibold text-white transition-all cursor-pointer flex items-center gap-1 shrink-0"
										>
											<Plus className="w-3 h-3" />
											<span>Add Source</span>
										</button>
									</div>

									{/* List of Custom Sources */}
									{settings?.custom_upstream_sources &&
									settings.custom_upstream_sources.length > 0 ? (
										<div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
											{settings.custom_upstream_sources.map((src) => (
												<div
													key={src}
													className="p-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between gap-2 text-[10px]"
												>
													<span className="font-mono text-zinc-300 truncate text-[10px]">
														{src}
													</span>
													<button
														type="button"
														onClick={() => removeCustomSource(src)}
														className="text-zinc-500 hover:text-rose-400 transition-colors p-0.5 rounded hover:bg-rose-500/10 cursor-pointer shrink-0"
														title="Remove source"
													>
														<Trash2 className="w-3 h-3" />
													</button>
												</div>
											))}
										</div>
									) : (
										<div className="p-2 rounded-lg bg-black/20 border border-dashed border-white/10 text-center text-[10px] text-zinc-500">
											No custom sources added. Sentinel is using built-in master feeds.
										</div>
									)}
								</div>
							</div>
						)}

						{/* TAB 4: CLOUD REPOSITORY */}
						{activeTab === "cloud" && (
							<div className="flex flex-col gap-2.5">
								{/* Cloud Repository Card */}
								<div className="rounded-xl p-3 bg-gradient-to-br from-cyan-950/30 via-blue-950/20 to-black/40 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
									<div className="flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
											<Cloud className="w-4 h-4" />
										</div>
										<div>
											<h4 className="text-xs font-semibold text-white">
												Cloud Repository Sync
											</h4>
											<p className="text-[10px] text-zinc-400 mt-0.5">
												Refreshes verified live streaming channels from the cloud mirror
											</p>
											<div className="text-[9.5px] text-cyan-300 font-mono mt-0.5 font-bold">
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
										className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-500/20 shrink-0 active:scale-95"
									>
										<RefreshCw
											className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`}
										/>
										<span>
											{isSyncing ? "Syncing..." : "Sync Channels Now"}
										</span>
									</button>
								</div>

								{/* Cloud Mirror Health Card */}
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2">
									<div className="flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
											<ShieldCheck className="w-4 h-4" />
										</div>
										<div>
											<h4 className="text-xs font-semibold text-white">
												High-Speed Cloud Resilience
											</h4>
											<p className="text-[10px] text-zinc-400 mt-0.5">
												All channels are verified with automatic fallback mirrors
											</p>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-1.5 pt-0.5 text-xs">
										<div className="p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5">
											<span className="text-[8.5px] uppercase font-bold text-zinc-500">
												Live Channels
											</span>
											<span className="text-xs font-bold text-cyan-300 font-mono">
												{totalChannelsCount > 0
													? totalChannelsCount.toLocaleString()
													: "8,300+"}
											</span>
										</div>
										<div className="p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5">
											<span className="text-[8.5px] uppercase font-bold text-zinc-500">
												Mirror Fallback
											</span>
											<span className="text-xs font-bold text-emerald-400 font-mono">
												Multi-Server
											</span>
										</div>
										<div className="p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5">
											<span className="text-[8.5px] uppercase font-bold text-zinc-500">
												Sync Protocol
											</span>
											<span className="text-xs font-bold text-white font-mono">
												HTTPS Cloud
											</span>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* TAB: SYSTEM & STARTUP */}
						{activeTab === "system" && (
							<div className="flex flex-col gap-2 max-h-[365px] overflow-y-auto pr-1 scrollbar-thin">
								{/* Autostart Card */}
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2.5">
											<div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 flex items-center justify-center shrink-0">
												<Power className="w-4 h-4" />
											</div>
											<div>
												<h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
													Start With Windows
													<span
														className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
															isLaunchAtStartup
																? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
																: "bg-zinc-800 text-zinc-400 border border-zinc-700"
														}`}
													>
														{isLaunchAtStartup ? "Enabled" : "Disabled"}
													</span>
												</h4>
												<p className="text-[10px] text-zinc-400">
													Automatically launch MorningTV when Windows boots or restarts
												</p>
											</div>
										</div>
										<button
											type="button"
											onClick={() => toggleStartupStatus(!isLaunchAtStartup)}
											className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
												isLaunchAtStartup ? "bg-cyan-500" : "bg-zinc-700"
											}`}
										>
											<div
												className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transition-transform ${
													isLaunchAtStartup ? "translate-x-4.5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>
								</div>

								{/* Tray Quick Controls Card */}
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2">
									<div className="flex items-center gap-2.5">
										<div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center shrink-0">
											<Monitor className="w-4 h-4" />
										</div>
										<div>
											<h4 className="text-xs font-semibold text-white">
												Windows Taskbar System Tray
											</h4>
											<p className="text-[10px] text-zinc-400">
												MorningTV runs quietly in the Windows Notification Area
											</p>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-1.5 text-xs text-zinc-300 pt-0.5">
										<div className="p-2 rounded-lg bg-black/30 border border-white/5 flex flex-col gap-0.5">
											<span className="font-semibold text-white flex items-center gap-1 text-[11px]">
												📺 Left Click Tray
											</span>
											<span className="text-[9.5px] text-zinc-400 leading-tight">
												Instantly show, unminimize, or focus player window.
											</span>
										</div>
										<div className="p-2 rounded-lg bg-black/30 border border-white/5 flex flex-col gap-0.5">
											<span className="font-semibold text-white flex items-center gap-1 text-[11px]">
												🖱️ Right Click Tray
											</span>
											<span className="text-[9.5px] text-zinc-400 leading-tight">
												Access Quick Menu: Autostart, GitHub, Reload, and Exit.
											</span>
										</div>
									</div>
								</div>

								{/* 3G Data Saver & Adaptive Playback Card */}
								<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2.5">
											<div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
												<Zap className="w-4 h-4" />
											</div>
											<div>
												<h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
													Adaptive 3G / Low-Speed Data Saver
													<span
														className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
															is3GDataSaver
																? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
																: "bg-zinc-800 text-zinc-400 border border-zinc-700"
														}`}
													>
														{is3GDataSaver ? "Active" : "Auto"}
													</span>
												</h4>
												<p className="text-[10px] text-zinc-400">
													Locks to 360p/480p and tightens buffer under weak networks (&lt;700 kbps)
												</p>
											</div>
										</div>
										<button
											type="button"
											onClick={() => toggle3GDataSaver()}
											className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
												is3GDataSaver ? "bg-amber-500" : "bg-zinc-700"
											}`}
										>
											<div
												className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transition-transform ${
													is3GDataSaver ? "translate-x-4.5" : "translate-x-0"
												}`}
											/>
										</button>
									</div>
								</div>

								{/* GitHub Repository Card */}
								<div className="rounded-xl p-3 bg-gradient-to-r from-blue-950/30 to-purple-950/30 border border-blue-500/20 flex items-center justify-between gap-3">
									<div>
										<h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
											🌐 GitHub Open Source Repository
										</h4>
										<p className="text-[10px] text-zinc-400">
											View source code, star the project, report stream issues, and check latest releases
										</p>
									</div>
									<button
										type="button"
										onClick={openGitHubRepo}
										className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer shrink-0"
									>
										<ExternalLink className="w-3 h-3" />
										Open Repo
									</button>
								</div>
							</div>
						)}

						{/* TAB 5: SOFTWARE UPDATE */}
						{activeTab === "updates" && (
							<div className="flex flex-col gap-3">
								{!isUpdateAvailable ? (
									/* Default Clean Update Card */
									<div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
										<div className="flex items-center justify-between gap-3">
											<div className="flex items-center gap-2.5">
												<div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0">
													<Check className="w-4 h-4" />
												</div>
												<div>
													<div className="flex items-center gap-1.5">
														<h4 className="text-xs font-semibold text-white">
															MorningTV Desktop
														</h4>
														<span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[8.5px] font-bold font-mono">
															v{APP_VERSION}
														</span>
													</div>
													<p className="text-[10px] text-zinc-400 mt-0.5">
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
												className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[10px] font-semibold text-zinc-200 transition-all cursor-pointer disabled:opacity-50 shrink-0"
											>
												<RefreshCw
													className={`w-3 h-3 ${
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
									</div>
								) : (
									/* Expanded Update Showcase Card (Shows What's New & Download) */
									<div className="rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-blue-950/40 via-indigo-950/25 to-black/60 border border-blue-500/30 flex flex-col gap-2.5 shadow-xl shadow-blue-950/30 animate-in fade-in zoom-in-95 duration-200">
										{/* Update Header */}
										<div className="flex items-start justify-between gap-2.5">
											<div className="flex items-center gap-2.5 min-w-0">
												<div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0">
													<ArrowDownCircle className="w-4 h-4 text-cyan-400 animate-pulse" />
												</div>
												<div className="min-w-0">
													<div className="flex items-center gap-2 flex-wrap">
														<h4 className="text-xs sm:text-sm font-bold text-white truncate">
															MorningTV Feature Update
														</h4>
														<span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold font-mono shrink-0">
															v{updateInfo?.version} Available
														</span>
													</div>
													<p className="text-[11px] text-zinc-300 mt-0.5 truncate">
														A new verified version is ready with performance and
														channel improvements
													</p>
												</div>
											</div>

											{updateStatus !== "downloading" && (
												<button
													type="button"
													onClick={dismissUpdate}
													className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer shrink-0"
													title="Dismiss update view"
												>
													<X className="w-4 h-4" />
												</button>
											)}
										</div>

										{/* What's New Section */}
										<div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-black/40 border border-white/10">
											<div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
												<Sparkles className="w-3 h-3 text-cyan-400" />
												<span>What's New in v{updateInfo?.version}:</span>
											</div>
											<div className="flex flex-col gap-1.5 text-xs text-zinc-300 max-h-36 overflow-y-auto pr-1">
												{updateInfo?.body ? (
													updateInfo.body
														.split("\n")
														.filter(Boolean)
														.map((line, idx) => (
															<div
																key={idx}
																className="flex items-start gap-1.5 text-[11px] text-zinc-300"
															>
																<span className="text-cyan-400 font-bold shrink-0 mt-0.5">
																	•
																</span>
																<span>{line.replace(/^[•\-*]\s*/, "")}</span>
															</div>
														))
												) : (
													<p className="text-[11px] text-zinc-400">
														Verified production stability updates and stream
														performance enhancements.
													</p>
												)}
											</div>
										</div>

										{/* Download / Install Controls */}
										{updateStatus === "available" && (
											<div className="flex items-center justify-between pt-2 border-t border-white/10">
												<div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
													<ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
													<span>Ed25519 Verified</span>
												</div>
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={dismissUpdate}
														className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
													>
														Later
													</button>
													<button
														type="button"
														onClick={startDownloadUpdate}
														className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-600/30 active:scale-95"
													>
														<ArrowDownCircle className="w-3.5 h-3.5" />
														<span>Download & Install Now</span>
													</button>
												</div>
											</div>
										)}

										{/* Downloading Progress Bar */}
										{updateStatus === "downloading" && (
											<div className="flex flex-col gap-1.5 p-2.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl">
												<div className="flex items-center justify-between text-xs font-bold text-cyan-300">
													<span className="flex items-center gap-2">
														<RefreshCw className="w-3 h-3 animate-spin" />
														<span>Downloading & verifying package...</span>
													</span>
													<span className="font-mono text-xs">
														{updateProgress}%
													</span>
												</div>
												<div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
													<div
														className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
														style={{ width: `${updateProgress}%` }}
													/>
												</div>
												<span className="text-[9px] text-zinc-400 font-mono">
													Silent background update in progress
												</span>
											</div>
										)}

										{/* Ready to Restart */}
										{updateStatus === "ready" && (
											<div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between gap-3">
												<div className="flex items-center gap-2 text-xs text-emerald-300 font-bold min-w-0">
													<Check className="w-4 h-4 text-emerald-400 shrink-0" />
													<span className="truncate">
														Update downloaded! Restart to apply changes.
													</span>
												</div>
												<div className="flex items-center gap-2 shrink-0">
													<button
														type="button"
														onClick={dismissUpdate}
														className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
													>
														Later
													</button>
													<button
														type="button"
														onClick={relaunchApp}
														className="px-3.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
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

						{/* Tab: Legal & About */}
						{activeTab === "about" && (
							<div className="space-y-3">
								<div>
									<h3 className="text-xs font-semibold text-white">
										Legal & Compliance Notice
									</h3>
									<p className="text-[10px] text-zinc-400 mt-0.5">
										Open-source architecture, stream attributions, and privacy policies
									</p>
								</div>

								<div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2.5">
									<div className="flex items-start gap-2.5">
										<ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
										<div className="space-y-1 text-[10px] text-zinc-300">
											<div className="font-semibold text-white text-[11px]">
												Non-Hosting & Aggregation Policy
											</div>
											<p className="text-zinc-400 leading-relaxed text-[10px]">
												MorningTV is an open-source client media player. MorningTV does{" "}
												<strong className="text-white">not</strong> host, store, cache, distribute, or rebroadcast any video, audio, or copyrighted stream content. All playlist items are aggregated from publicly available IPTV repositories maintained by the open-source community.
											</p>
										</div>
									</div>

									<div className="flex items-start gap-2.5 pt-2 border-t border-white/10">
										<Globe className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
										<div className="space-y-1 text-[10px] text-zinc-300">
											<div className="font-semibold text-white text-[11px]">
												Third-Party Web Services & Attribution
											</div>
											<p className="text-zinc-400 leading-relaxed text-[10px]">
												The embedded YouTube and JioHotstar buttons launch official provider web applications directly in native sandboxed webviews. MorningTV is not affiliated with, endorsed by, or sponsored by YouTube, Google LLC, Jio, or Star India. All trademarks and brand assets belong to their respective holders.
											</p>
										</div>
									</div>

									<div className="flex items-start gap-2.5 pt-2 border-t border-white/10">
										<Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
										<div className="space-y-1 text-[10px] text-zinc-300">
											<div className="font-semibold text-white text-[11px]">
												Local Security & Privacy Guard
											</div>
											<p className="text-zinc-400 leading-relaxed text-[10px]">
												MorningTV runs a hardened local Axum proxy with Anti-SSRF protection, IPv4/IPv6 private range blocking, and ephemeral cryptographic token authentication. Zero personal tracking or viewing metrics are collected or sent to external telemetry servers.
											</p>
										</div>
									</div>
								</div>

								<div className="p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between text-[10px] text-zinc-400">
									<div>
										<span className="font-semibold text-white">License:</span> MIT Open Source
									</div>
									<div className="font-mono text-[9.5px]">
										MorningTV v{APP_VERSION} (Production Release)
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Modal Footer Controls */}
					<div className="shrink-0 pt-3 mt-3 border-t border-white/10 flex items-center justify-end text-xs text-zinc-300">
						<button
							type="button"
							onClick={closeSettings}
							className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all cursor-pointer border border-white/10 active:scale-95 shadow-sm"
						>
							Done
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
