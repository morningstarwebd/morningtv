// src/components/StreamQualityPopover.tsx
// Glassmorphic Apple TV-style Network & Stream Quality Diagnostics HUD

import {
	Activity,
	Check,
	Gauge,
	HardDrive,
	Radio,
	ShieldCheck,
	Signal,
	Sliders,
	Sparkles,
	Wifi,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

export const StreamQualityPopover: React.FC = () => {
	const {
		isQualityPopoverOpen,
		closeQualityPopover,
		is3GDataSaver,
		toggle3GDataSaver,
		currentResolution,
		networkSpeed,
		bufferSecs,
		availableQualityLevels,
		selectedQualityLevel,
		streamHealthStatus,
		stallCount,
		abrTier,
		setSelectedQualityLevel,
	} = useAppStore();

	const popoverRef = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node)
			) {
				closeQualityPopover();
			}
		};
		if (isQualityPopoverOpen) {
			document.addEventListener("mousedown", handleOutsideClick);
		}
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [isQualityPopoverOpen, closeQualityPopover]);

	// Close on ESC
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isQualityPopoverOpen) {
				closeQualityPopover();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isQualityPopoverOpen, closeQualityPopover]);

	if (!isQualityPopoverOpen) return null;

	// Calculate buffer percentage (0-30s mapped to 0-100%)
	const bufferPercent = Math.min(100, Math.round((bufferSecs / 30) * 100));

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-6 pointer-events-none select-none">
			{/* Semi-transparent backdrop for clicking outside on small screens */}
			<div
				className="fixed inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
				onClick={closeQualityPopover}
			/>

			{/* Popover Panel */}
			<div
				ref={popoverRef}
				className="relative z-10 w-96 bg-[#0a0e1c]/95 border border-white/20 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-2xl p-5 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
			>
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
							<Activity className="w-4 h-4 text-cyan-400" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-white tracking-wide">
								Stream & Network HUD
							</h3>
							<p className="text-[10px] text-zinc-400">
								Real-time performance diagnostics
							</p>
						</div>
					</div>
					<button
						onClick={closeQualityPopover}
						className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Live Performance Diagnostics Grid */}
				<div className="grid grid-cols-2 gap-2.5 mb-4">
					{/* Current Resolution */}
					<div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col">
						<span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1 mb-1">
							<Sparkles className="w-3 h-3 text-cyan-400" /> Current Resolution
						</span>
						<span className="text-xs font-black text-cyan-300 truncate">
							{currentResolution || "Detecting..."}
						</span>
					</div>

					{/* Live Bitrate */}
					<div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col">
						<span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1 mb-1">
							<Gauge className="w-3 h-3 text-emerald-400" /> Live Bitrate
						</span>
						<span className="text-xs font-black text-emerald-300 truncate">
							{networkSpeed || "0 kbps"}
						</span>
					</div>

					{/* Buffer Health */}
					<div className="col-span-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
						<div className="flex items-center justify-between text-[10px] font-medium text-zinc-400 mb-1.5">
							<span className="flex items-center gap-1">
								<HardDrive className="w-3 h-3 text-indigo-400" /> Buffer Health
							</span>
							<span className="font-mono text-zinc-200 font-bold">
								{bufferSecs}s / 30s
							</span>
						</div>
						<div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
							<div
								className={`h-full rounded-full transition-all duration-300 ${
									bufferSecs > 10
										? "bg-emerald-400"
										: bufferSecs > 4
											? "bg-amber-400"
											: "bg-rose-500"
								}`}
								style={{ width: `${bufferPercent}%` }}
							/>
						</div>
					</div>

					{/* Stream Health Status */}
					<div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col">
						<span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1 mb-1">
							<ShieldCheck className="w-3 h-3 text-cyan-400" /> Stream Health
						</span>
						<div className="flex items-center gap-1.5 mt-0.5">
							<span
								className={`w-2 h-2 rounded-full ${
									streamHealthStatus === "good"
										? "bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
										: streamHealthStatus === "degraded"
											? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
											: streamHealthStatus === "critical"
												? "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]"
												: streamHealthStatus === "stalled"
													? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)] animate-ping"
													: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)] animate-pulse"
								}`}
							/>
							<span className="text-xs font-black text-white capitalize">
								{streamHealthStatus === "good"
									? "Optimal"
									: streamHealthStatus}
							</span>
						</div>
					</div>

					{/* ABR Engine Recommendation & Stalls */}
					<div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col">
						<span className="text-[10px] font-medium text-zinc-400 flex items-center justify-between mb-1">
							<span className="flex items-center gap-1">
								<Signal className="w-3 h-3 text-indigo-400" /> ABR Guidance
							</span>
							{stallCount > 0 && (
								<span className="text-[9px] font-mono font-bold text-rose-400">
									{stallCount} stall{stallCount > 1 ? "s" : ""}
								</span>
							)}
						</span>
						<span className="text-xs font-black text-indigo-300">
							{abrTier} Tier
						</span>
					</div>
				</div>

				{/* 3G Data Saver Toggle */}
				<div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border border-emerald-500/25 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div
							className={`w-8 h-8 rounded-lg flex items-center justify-center ${
								is3GDataSaver
									? "bg-emerald-500/20 text-emerald-300"
									: "bg-white/5 text-zinc-400"
							}`}
						>
							<Zap className="w-4 h-4" />
						</div>
						<div>
							<div className="text-xs font-bold text-white flex items-center gap-1.5">
								<span>3G Data Saver Mode</span>
								{is3GDataSaver && (
									<span className="px-1.5 py-0.2 rounded-xs bg-emerald-500/30 text-emerald-300 text-[9px] font-bold">
										ON
									</span>
								)}
							</div>
							<p className="text-[10px] text-zinc-400">
								Caps video to ~360p/480p, cuts data usage by 80%
							</p>
						</div>
					</div>
					<button
						onClick={toggle3GDataSaver}
						className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
							is3GDataSaver ? "bg-emerald-500" : "bg-white/20"
						}`}
					>
						<div
							className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-md ${
								is3GDataSaver ? "translate-x-5" : "translate-x-0.5"
							}`}
						/>
					</button>
				</div>

				{/* Manual Resolution & Quality Selector */}
				<div>
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
							<Sliders className="w-3.5 h-3.5 text-cyan-400" />
							Stream Quality Selector
						</span>
						<span className="text-[10px] text-zinc-400">
							{availableQualityLevels.length > 0
								? `${availableQualityLevels.length} tiers`
								: "Auto"}
						</span>
					</div>

					<div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
						{/* Auto (Adaptive Bitrate) Option */}
						<button
							onClick={() => setSelectedQualityLevel(-1)}
							className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
								selectedQualityLevel === -1
									? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200"
									: "bg-white/[0.03] border-white/[0.06] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
							}`}
						>
							<div className="flex items-center gap-2">
								<Wifi className="w-3.5 h-3.5 text-cyan-400" />
								<div className="text-left">
									<div>Auto (Adaptive ABR)</div>
									<div className="text-[9px] text-zinc-400 font-normal">
										Automatically selects best bitrate for your network
									</div>
								</div>
							</div>
							{selectedQualityLevel === -1 && (
								<Check className="w-4 h-4 text-cyan-400 shrink-0" />
							)}
						</button>

						{/* Individual Quality Levels if provided by HLS */}
						{availableQualityLevels.map((lvl) => {
							const isSelected = selectedQualityLevel === lvl.index;
							const mbps = lvl.bitrate
								? (lvl.bitrate / 1000000).toFixed(1)
								: null;

							return (
								<button
									key={lvl.index}
									onClick={() => setSelectedQualityLevel(lvl.index)}
									className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
										isSelected
											? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200"
											: "bg-white/[0.03] border-white/[0.06] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
									}`}
								>
									<div className="flex items-center gap-2">
										<Radio className="w-3.5 h-3.5 text-zinc-400" />
										<div className="text-left">
											<span>{lvl.label}</span>
											{lvl.height >= 1080 && (
												<span className="ml-1.5 px-1 py-0.2 rounded-xs bg-blue-500/30 text-blue-300 text-[9px] font-bold">
													Crisp HD
												</span>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2">
										{mbps && (
											<span className="text-[10px] font-mono text-zinc-400">
												{mbps} Mbps
											</span>
										)}
										{isSelected && (
											<Check className="w-4 h-4 text-cyan-400 shrink-0" />
										)}
									</div>
								</button>
							);
						})}

						{availableQualityLevels.length === 0 && (
							<div className="p-3 text-center text-[11px] text-zinc-500 bg-white/[0.02] rounded-xl border border-white/[0.04]">
								Direct stream without multi-rendition HLS playlist. Stream will
								play at source native resolution.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
