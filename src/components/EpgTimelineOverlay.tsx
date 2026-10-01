// src/components/EpgTimelineOverlay.tsx
// Cinema-Grade Apple TV Electronic Program Guide (EPG) Timeline Overlay

import { invoke } from "@tauri-apps/api/core";
import { Clock } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { ChannelEpg } from "../types";

export const EpgTimelineOverlay: React.FC = () => {
	const { activeChannel, isPlaying } = useAppStore();
	const [epgData, setEpgData] = useState<ChannelEpg | null>(null);

	useEffect(() => {
		if (!activeChannel) {
			setEpgData(null);
			return;
		}

		let isMounted = true;
		invoke<ChannelEpg>("get_channel_epg", {
			channelName: activeChannel.name,
			groupTitle: activeChannel.group || null,
		})
			.then((data) => {
				if (isMounted && data) {
					setEpgData(data);
				}
			})
			.catch((err) => {
				console.debug("Failed to query channel EPG", err);
			});

		// Refresh EPG progress every 60 seconds
		const interval = setInterval(() => {
			if (activeChannel) {
				invoke<ChannelEpg>("get_channel_epg", {
					channelName: activeChannel.name,
					groupTitle: activeChannel.group || null,
				})
					.then((data) => {
						if (isMounted && data) setEpgData(data);
					})
					.catch(() => {});
			}
		}, 60000);

		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, [activeChannel]);

	if (!activeChannel || !isPlaying || !epgData?.current) {
		return null;
	}

	const { current, next } = epgData;

	return (
		<div className="absolute bottom-20 left-8 right-8 z-40 pointer-events-none transition-all duration-300">
			<div className="max-w-2xl bg-black/80 hover:bg-black/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-2xl shadow-black/80 transition-all pointer-events-auto">
				{/* Top Row: Channel Badge, Live Dot, Current Time */}
				<div className="flex items-center justify-between gap-3 mb-2.5">
					<div className="flex items-center gap-2.5">
						<span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-[11px] font-bold text-rose-300 uppercase tracking-wider">
							<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
							LIVE
						</span>
						<span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
							{activeChannel.group || "General"}
						</span>
						<span className="text-xs font-bold text-white/90 truncate max-w-[200px]">
							{activeChannel.name}
						</span>
					</div>

					<div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-white/60">
						<Clock className="w-3.5 h-3.5 text-cyan-400" />
						<span>
							{current.startTime} - {current.endTime}
						</span>
					</div>
				</div>

				{/* Center: Current Program Title */}
				<div className="flex items-baseline justify-between gap-4 mb-2">
					<h3 className="text-sm font-bold text-white tracking-wide truncate">
						{current.title}
					</h3>
					<span className="text-xs font-mono font-bold text-cyan-300 shrink-0">
						{current.progress}%
					</span>
				</div>

				{/* Progress Bar */}
				<div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2.5 relative">
					<div
						className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
						style={{ width: `${Math.max(3, current.progress)}%` }}
					/>
				</div>

				{/* Bottom: Up Next Preview */}
				{next && (
					<div className="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/10">
						<div className="flex items-center gap-1.5 truncate">
							<span className="text-white/40 font-semibold shrink-0">
								UP NEXT:
							</span>
							<span className="text-white/80 font-medium truncate">
								{next.title}
							</span>
						</div>
						<span className="font-mono text-white/50 shrink-0 ml-2">
							{next.startTime}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};
