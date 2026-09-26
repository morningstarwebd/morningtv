// src/components/AppleTVTopBar.tsx
// Minimalist Apple TV 4K-style floating top navigation with auto-hide

import {
	Activity,
	HelpCircle,
	Layers,
	RefreshCw,
	Server,
	Settings,
	Tv,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";

export const AppleTVTopBar: React.FC = () => {
	const {
		activeChannel,
		is3GDataSaver,
		currentResolution,
		streamHealthStatus,
		toggleQualityPopover,
		soundBoost,
		mirrorIndex,
		cycleMirror,
		openChannelDrawer,
		openSettings,
		openShortcuts,
		channels,
		isSyncing,
		syncCloudStreams,
	} = useAppStore();

	const allUrls = activeChannel
		? [activeChannel.url, ...(activeChannel.fallback_urls || [])]
		: [];

	const [timeStr, setTimeStr] = useState("");
	const [isVisible, setIsVisible] = useState(true);
	const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Time updater
	useEffect(() => {
		const updateTime = () => {
			const now = new Date();
			setTimeStr(
				now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			);
		};
		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	}, []);

	// Auto-hide top bar after 3 seconds of mouse inactivity
	const resetHideTimer = () => {
		setIsVisible(true);
		if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		hideTimerRef.current = setTimeout(() => {
			setIsVisible(false);
		}, 3000);
	};

	useEffect(() => {
		const handleMouseMove = () => resetHideTimer();
		window.addEventListener("mousemove", handleMouseMove);
		resetHideTimer();
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		};
	}, []);

	return (
		<div
			className={`fixed top-4 left-6 right-6 z-30 flex items-center justify-between pointer-events-none transition-all duration-300 ${
				isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
			}`}
		>
			{/* Left: Brand Identity */}
			<div className="flex items-center gap-3 pointer-events-auto">
				<button
					onClick={openChannelDrawer}
					className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/85 border border-white/10 backdrop-blur-2xl text-white shadow-xl transition-all cursor-pointer group"
					title="Open Channel Shelf (C)"
				>
					<div className="w-5 h-5 rounded-md bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
						<Tv className="w-3 h-3 text-white" />
					</div>
					<span className="text-xs font-black tracking-wider text-white">
						MorningTV
					</span>
					<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping ml-1" />
				</button>

				{activeChannel && (
					<div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-xl">
						{activeChannel.logo && (
							<img
								src={activeChannel.logo}
								alt=""
								className="w-4 h-4 object-contain rounded-xs"
							/>
						)}
						<span className="text-xs font-bold text-white truncate max-w-[180px]">
							{activeChannel.name}
						</span>
						<span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-red-500/90 text-white leading-none">
							LIVE
						</span>
					</div>
				)}

				{/* Minimalist Mirror / Server Switcher Pill */}
				{allUrls.length > 1 && (
					<button
						onClick={cycleMirror}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 hover:text-white backdrop-blur-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
						title="Switch stream mirror server"
					>
						<Server className="w-3.5 h-3.5 text-cyan-400" />
						<span>
							Server {mirrorIndex + 1}/{allUrls.length}
						</span>
						<RefreshCw className="w-3 h-3 text-cyan-300 ml-0.5" />
					</button>
				)}
			</div>

			{/* Right: Clean Action Controls */}
			<div className="flex items-center gap-2 pointer-events-auto">
				{/* Stream Quality & Diagnostics HUD Trigger Pill */}
				<button
					onClick={toggleQualityPopover}
					className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wide transition-all cursor-pointer border ${
						is3GDataSaver
							? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm backdrop-blur-xl"
							: "bg-black/60 text-cyan-300 border-cyan-500/30 hover:bg-black/85 backdrop-blur-xl hover:text-white"
					}`}
					title="Stream Quality, Resolution & Network Diagnostics (Click to configure)"
				>
					<Activity className="w-3.5 h-3.5 text-cyan-400" />
					<span>
						{is3GDataSaver ? "3G SAVER" : currentResolution || "1080p HD"}
					</span>
					<span
						className={`w-1.5 h-1.5 rounded-full ${
							streamHealthStatus === "stalled"
								? "bg-rose-500 animate-ping"
								: streamHealthStatus === "reconnecting"
									? "bg-rose-400 animate-pulse"
									: streamHealthStatus === "critical"
										? "bg-orange-400"
										: streamHealthStatus === "degraded"
											? "bg-amber-400"
											: is3GDataSaver
												? "bg-emerald-400 animate-pulse"
												: "bg-cyan-400"
						}`}
					/>
				</button>

				{/* Audio Boost Badge if active */}
				{soundBoost > 100 && (
					<div className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-mono font-bold backdrop-blur-xl animate-pulse">
						🔊 {soundBoost}%
					</div>
				)}

				{/* Channels Shelf Trigger Button */}
				<button
					onClick={openChannelDrawer}
					className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-2xl text-xs font-bold transition-all cursor-pointer shadow-lg"
					title="Browse Live Channels (C)"
				>
					<Layers className="w-3.5 h-3.5 text-cyan-400" />
					<span>Guide</span>
					<span className="text-[10px] text-zinc-400 font-mono">
						({channels.length})
					</span>
				</button>

				{/* Clock */}
				<div className="px-3.5 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-2xl text-xs font-mono font-bold text-white shadow-xl">
					{timeStr}
				</div>

				{/* Shortcuts */}
				<button
					onClick={openShortcuts}
					className="p-2 rounded-full bg-black/60 hover:bg-black/85 text-zinc-400 hover:text-white border border-white/10 backdrop-blur-2xl transition-all cursor-pointer shadow-xl"
					title="Keyboard Shortcuts (?)"
				>
					<HelpCircle className="w-3.5 h-3.5" />
				</button>

				{/* Cloud Stream Sync Button */}
				<button
					onClick={syncCloudStreams}
					disabled={isSyncing}
					className="p-2 rounded-full bg-black/60 hover:bg-black/85 text-zinc-400 hover:text-cyan-400 border border-white/10 backdrop-blur-2xl transition-all cursor-pointer shadow-xl disabled:opacity-50"
					title="Sync Latest Channels from GitHub (R)"
				>
					<RefreshCw
						className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-cyan-400" : ""}`}
					/>
				</button>

				{/* Settings */}
				<button
					onClick={openSettings}
					className="p-2 rounded-full bg-black/60 hover:bg-black/85 text-zinc-400 hover:text-white border border-white/10 backdrop-blur-2xl transition-all cursor-pointer shadow-xl"
					title="Settings"
				>
					<Settings className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
};
