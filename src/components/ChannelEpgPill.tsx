// src/components/ChannelEpgPill.tsx
// Smart Apple TV-Style Dynamic Island Channel Pill with Ambient EPG Ticker & Interactive Popover

import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, Clock, Tv, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Channel, ChannelEpg } from "../types";
import { buildProxyLogoUrl } from "../utils/proxy";

interface ChannelEpgPillProps {
	activeChannel: Channel;
}

type TickerMode = "channel" | "now" | "next";

export const ChannelEpgPill: React.FC<ChannelEpgPillProps> = ({
	activeChannel,
}) => {
	const [epgData, setEpgData] = useState<ChannelEpg | null>(null);
	const [tickerMode, setTickerMode] = useState<TickerMode>("channel");
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Fetch EPG data on channel change and poll every 60s
	useEffect(() => {
		let isMounted = true;
		invoke<ChannelEpg>("get_channel_epg", {
			channelName: activeChannel.name,
			groupTitle: activeChannel.group || null,
		})
			.then((data) => {
				if (isMounted) setEpgData(data);
			})
			.catch(() => {});

		const interval = setInterval(() => {
			invoke<ChannelEpg>("get_channel_epg", {
				channelName: activeChannel.name,
				groupTitle: activeChannel.group || null,
			})
				.then((data) => {
					if (isMounted) setEpgData(data);
				})
				.catch(() => {});
		}, 60000);

		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, [activeChannel.name, activeChannel.group]);

	// Ambient Ticker: Rotates between Channel Name (8s) -> Now Playing (4.5s) -> Up Next (4.5s)
	useEffect(() => {
		if (!epgData?.current) {
			setTickerMode("channel");
			return;
		}

		let timer: ReturnType<typeof setTimeout>;

		if (tickerMode === "channel") {
			timer = setTimeout(() => {
				if (epgData.current) setTickerMode("now");
			}, 8000);
		} else if (tickerMode === "now") {
			timer = setTimeout(() => {
				if (epgData.next) {
					setTickerMode("next");
				} else {
					setTickerMode("channel");
				}
			}, 4500);
		} else if (tickerMode === "next") {
			timer = setTimeout(() => {
				setTickerMode("channel");
			}, 4500);
		}

		return () => clearTimeout(timer);
	}, [tickerMode, epgData]);

	// Close popover on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsPopoverOpen(false);
			}
		};
		if (isPopoverOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isPopoverOpen]);

	const currentProgram = epgData?.current;
	const nextProgram = epgData?.next;

	return (
		<div
			ref={containerRef}
			className="relative hidden sm:block pointer-events-auto"
		>
			{/* Interactive Channel Pill */}
			<button
				onClick={() => setIsPopoverOpen((prev) => !prev)}
				className={`group flex items-center gap-2 h-8 px-3 rounded-full border backdrop-blur-xl transition-all cursor-pointer select-none max-w-[340px] ${
					isPopoverOpen
						? "bg-black/90 border-cyan-400/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30"
						: "bg-black/55 hover:bg-black/80 border-white/10 hover:border-cyan-400/40 shadow-md"
				}`}
				title="Click to view full Program Schedule & EPG Timeline"
			>
				{/* Channel Logo */}
				<img
					src={buildProxyLogoUrl(activeChannel.logo, activeChannel.name)}
					alt=""
					className="w-4 h-4 object-contain rounded-xs shrink-0 drop-shadow-sm"
					onError={(e) => {
						(e.target as HTMLElement).style.display = "none";
					}}
				/>

				{/* Animated Content Transition Window */}
				<div className="relative overflow-hidden h-5 flex items-center min-w-[140px] max-w-[220px]">
					{/* State 0: Channel Name & LIVE */}
					<div
						className={`flex items-center gap-2 transition-all duration-500 ease-out whitespace-nowrap ${
							tickerMode === "channel"
								? "opacity-100 translate-y-0 relative"
								: "opacity-0 -translate-y-4 absolute pointer-events-none"
						}`}
					>
						<span className="text-xs font-bold text-white truncate max-w-[150px]">
							{activeChannel.name}
						</span>
						<span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-red-500/90 text-white leading-none shadow-xs">
							LIVE
						</span>
					</div>

					{/* State 1: Now Playing Show */}
					{currentProgram && (
						<div
							className={`flex items-center gap-1.5 transition-all duration-500 ease-out whitespace-nowrap ${
								tickerMode === "now"
									? "opacity-100 translate-y-0 relative"
									: "opacity-0 translate-y-4 absolute pointer-events-none"
							}`}
						>
							<Tv className="w-3 h-3 text-cyan-400 shrink-0" />
							<span className="text-[11px] font-medium text-cyan-200 truncate max-w-[160px]">
								{currentProgram.title}
							</span>
							<span className="text-[10px] font-mono font-bold text-cyan-400/90 shrink-0">
								{currentProgram.progress}%
							</span>
						</div>
					)}

					{/* State 2: Up Next Show */}
					{nextProgram && (
						<div
							className={`flex items-center gap-1.5 transition-all duration-500 ease-out whitespace-nowrap ${
								tickerMode === "next"
									? "opacity-100 translate-y-0 relative"
									: "opacity-0 translate-y-4 absolute pointer-events-none"
							}`}
						>
							<Clock className="w-3 h-3 text-amber-400 shrink-0" />
							<span className="text-[11px] font-medium text-zinc-300 truncate max-w-[180px]">
								Next: {nextProgram.title}
							</span>
						</div>
					)}
				</div>

				<ChevronDown
					className={`w-3 h-3 text-zinc-400 group-hover:text-cyan-300 transition-transform duration-200 shrink-0 ${
						isPopoverOpen ? "rotate-180 text-cyan-400" : ""
					}`}
				/>
			</button>

			{/* Floating Mini EPG Schedule Card */}
			{isPopoverOpen && (
				<div className="absolute top-11 left-0 w-80 p-4 rounded-2xl bg-[#090c15]/95 border border-white/15 backdrop-blur-2xl shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-150">
					{/* Header Row */}
					<div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
						<div className="flex items-center gap-2 min-w-0">
							<img
								src={buildProxyLogoUrl(activeChannel.logo, activeChannel.name)}
								alt=""
								className="w-5 h-5 object-contain rounded-xs shrink-0"
								onError={(e) => {
									(e.target as HTMLElement).style.display = "none";
								}}
							/>
							<div className="min-w-0">
								<h4 className="text-xs font-black text-white truncate tracking-wide">
									{activeChannel.name}
								</h4>
								<p className="text-[10px] text-zinc-400 truncate">
									{activeChannel.group || "Live Television"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-[10px] font-bold text-rose-300 uppercase tracking-wider">
								<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
								LIVE
							</span>
							<button
								onClick={(e) => {
									e.stopPropagation();
									setIsPopoverOpen(false);
								}}
								className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
								title="Close"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</div>
					</div>

					{/* Current Show Details */}
					{currentProgram ? (
						<div className="space-y-2 mb-3.5">
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
									Now Playing
								</span>
								<div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
									<Clock className="w-3 h-3 text-cyan-400" />
									<span>
										{currentProgram.startTime} - {currentProgram.endTime}
									</span>
								</div>
							</div>

							<h3 className="text-xs font-bold text-white tracking-wide leading-snug">
								{currentProgram.title}
							</h3>

							{/* Progress Bar */}
							<div className="space-y-1">
								<div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
									<div
										className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
										style={{
											width: `${Math.min(100, Math.max(0, currentProgram.progress))}%`,
										}}
									/>
								</div>
								<div className="flex justify-between text-[10px] font-mono text-zinc-500">
									<span>Live Broadcast</span>
									<span className="text-cyan-400 font-semibold">
										{currentProgram.progress}% elapsed
									</span>
								</div>
							</div>
						</div>
					) : (
						<div className="py-3 text-center text-xs text-zinc-400">
							No current schedule metadata available for this stream.
						</div>
					)}

					{/* Up Next Show Preview */}
					{nextProgram && (
						<div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
							<div className="flex items-center justify-between text-[10px]">
								<span className="font-bold text-amber-400 uppercase tracking-wider">
									Up Next
								</span>
								<span className="font-mono text-zinc-400">
									Starts at {nextProgram.startTime}
								</span>
							</div>
							<p className="text-xs font-semibold text-zinc-200 truncate">
								{nextProgram.title}
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
