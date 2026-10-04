// src/components/AppleTVCard.tsx
// Apple TV / Google TV-inspired spacious live channel card with sleek glassmorphism and focus effects

import { Star, Tv } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { Channel } from "../types";
import { getChannelIdString } from "../types";
import { buildProxyLogoUrl } from "../utils/proxy";

interface AppleTVCardProps {
	channel: Channel;
	index: number;
	isActive: boolean;
	isPlaying?: boolean;
	onSelect: (channel: Channel) => void;
	onToggleFavorite: (channelId: string) => void;
}

export const AppleTVCard = memo<AppleTVCardProps>(
	({
		channel,
		index,
		isActive,
		isPlaying = false,
		onSelect,
		onToggleFavorite,
	}) => {
		const channelId = getChannelIdString(channel.id);
		const [logoError, setLogoError] = useState(false);
		const [imageLoaded, setImageLoaded] = useState(false);

		// Resolution badge if present
		const resolutionMatch = channel.name.match(
			/\((1080p|720p|576p|HD|ABR 3G)\)/i,
		);
		const resolution = resolutionMatch ? resolutionMatch[1] : null;
		const cleanName = channel.name
			.replace(/\s*\((1080p|720p|576p|HD|ABR 3G)\)/i, "")
			.trim();

		const formattedNum = String(index + 1).padStart(2, "0");

		const logoSrc = useMemo(() => {
			return buildProxyLogoUrl(channel.logo, cleanName);
		}, [channel.logo, cleanName]);

		return (
			<div
				onClick={() => onSelect(channel)}
				className={`group relative w-48 sm:w-56 h-32 sm:h-36 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer select-none transition-all duration-200 shrink-0 border overflow-hidden backdrop-blur-xl ${
					isActive
						? "bg-white/[0.09] border-white/30 ring-1 ring-white/20 shadow-[0_14px_36px_rgba(0,0,0,0.65)] scale-[1.02]"
						: "bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.06] hover:border-white/[0.18] shadow-md hover:shadow-2xl hover:scale-[1.02]"
				}`}
			>
				{/* Top ambient highlight reflection */}
				<div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent pointer-events-none rounded-2xl" />

				{/* Top Header: Channel Number & Favorite */}
				<div className="flex items-center justify-between z-10">
					<span
						className={`font-mono text-[10px] font-medium px-2 py-0.5 rounded-md border ${
							isActive
								? "bg-white/15 text-white border-white/20 font-semibold"
								: "bg-black/40 text-white/50 border-white/[0.04] group-hover:text-white/70"
						}`}
					>
						CH {formattedNum}
					</span>

					<div className="flex items-center gap-1.5">
						{resolution && (
							<span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-white/[0.04] text-white/40 border border-white/[0.05]">
								{resolution}
							</span>
						)}
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleFavorite(channelId);
							}}
							className="p-1 rounded-md text-white/40 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
							title={
								channel.is_favorite
									? "Remove from favorites"
									: "Add to favorites"
							}
						>
							<Star
								className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
									channel.is_favorite
										? "fill-amber-400 text-amber-400 filter drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]"
										: ""
								}`}
							/>
						</button>
					</div>
				</div>

				{/* Center Logo */}
				<div className="flex-1 flex items-center justify-center my-1 z-10 px-2 relative">
					{!logoError ? (
						<>
							{!imageLoaded && (
								<div className="w-20 h-10 rounded-xl animate-shimmer bg-white/[0.04] border border-white/5 flex items-center justify-center absolute" />
							)}
							<img
								src={logoSrc}
								alt={cleanName}
								onLoad={() => setImageLoaded(true)}
								onError={() => setLogoError(true)}
								className={`max-h-12 max-w-[82%] object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300 ${
									imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
								}`}
								loading="lazy"
								decoding="async"
							/>
						</>
					) : (
						<div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
							<Tv
								className={`w-6 h-6 ${isActive ? "text-white" : "text-white/40"}`}
							/>
						</div>
					)}
				</div>

				{/* Bottom Bar: Channel Name & Broadcast Live Indicator */}
				<div className="z-10 pt-2 border-t border-white/[0.06] flex items-center justify-between">
					<span
						title={cleanName}
						className={`text-xs truncate flex-1 min-w-0 pr-2 ${
							isActive
								? "text-white font-semibold"
								: "text-white/75 group-hover:text-white font-normal"
						}`}
					>
						{cleanName}
					</span>

					{isActive ? (
						<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 shrink-0">
							<span
								className={`w-1.5 h-1.5 rounded-full bg-red-400 ${
									isPlaying ? "animate-pulse" : ""
								}`}
							/>
							<span className="text-[9px] font-bold text-red-300 tracking-wider">
								LIVE
							</span>
						</div>
					) : (
						<span
							title={channel.provider || channel.group || "Live TV"}
							className="text-[10px] text-white/40 group-hover:text-white/60 font-normal shrink-0 max-w-[90px] truncate text-right transition-colors"
						>
							{channel.provider || channel.group || "Live TV"}
						</span>
					)}
				</div>
			</div>
		);
	},
);
AppleTVCard.displayName = "AppleTVCard";
