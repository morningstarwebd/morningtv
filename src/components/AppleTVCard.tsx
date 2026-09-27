// src/components/AppleTVCard.tsx
// Apple TV / Google TV-inspired spacious live channel card with sleek glassmorphism and focus effects

import { Star, Tv } from "lucide-react";
import { memo, useState } from "react";
import type { Channel } from "../types";
import { getChannelIdString } from "../types";

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

		return (
			<div
				onClick={() => onSelect(channel)}
				className={`group relative w-48 sm:w-56 h-32 sm:h-36 rounded-2xl p-3 flex flex-col justify-between cursor-pointer select-none transition-all duration-300 shrink-0 border overflow-hidden ${
					isActive
						? "bg-gradient-to-b from-cyan-950/60 via-[#091224] to-blue-950/70 border-cyan-400 ring-2 ring-cyan-500/40 shadow-2xl shadow-cyan-500/20 scale-[1.03]"
						: "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/20 hover:scale-105 shadow-xl hover:shadow-2xl hover:shadow-black/80"
				}`}
			>
				{/* Top Header: Channel Number & Favorite */}
				<div className="flex items-center justify-between z-10">
					<span
						className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-lg border ${
							isActive
								? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
								: "bg-black/40 text-zinc-400 border-white/5 group-hover:text-zinc-200"
						}`}
					>
						CH {formattedNum}
					</span>

					<div className="flex items-center gap-1.5">
						{resolution && (
							<span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/5 text-zinc-400 border border-white/10">
								{resolution}
							</span>
						)}
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleFavorite(channelId);
							}}
							className="p-1 rounded-lg text-zinc-400 hover:text-amber-400 transition-all hover:bg-white/10 cursor-pointer"
							title={
								channel.is_favorite
									? "Remove from favorites"
									: "Add to favorites"
							}
						>
							<Star
								className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
									channel.is_favorite
										? "fill-amber-400 text-amber-400 filter drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
										: ""
								}`}
							/>
						</button>
					</div>
				</div>

				{/* Center Logo with Shimmer Skeleton */}
				<div className="flex-1 flex items-center justify-center my-1 z-10 px-2 relative">
					{channel.logo && !logoError ? (
						<>
							{!imageLoaded && (
								<div className="w-20 h-10 rounded-xl animate-shimmer bg-white/[0.05] border border-white/5 flex items-center justify-center absolute" />
							)}
							<img
								src={channel.logo}
								alt={cleanName}
								onLoad={() => setImageLoaded(true)}
								onError={() => setLogoError(true)}
								className={`max-h-12 max-w-[85%] object-contain filter drop-shadow-md group-hover:scale-110 transition-all duration-300 ${
									imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
								}`}
								loading="lazy"
								decoding="async"
							/>
						</>
					) : (
						<div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
							<Tv
								className={`w-6 h-6 ${isActive ? "text-cyan-400" : "text-zinc-500"}`}
							/>
						</div>
					)}
				</div>

				{/* Bottom Bar: Channel Name & Live Status */}
				<div className="z-10 pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
					<span
						title={cleanName}
						className={`text-xs font-bold truncate flex-1 min-w-0 pr-2 ${
							isActive
								? "text-white font-extrabold"
								: "text-zinc-300 group-hover:text-white"
						}`}
					>
						{cleanName}
					</span>

					{isActive ? (
						<div className="flex items-center gap-1 shrink-0">
							<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
							{isPlaying && (
								<div className="flex items-end gap-0.5 h-2.5">
									<span className="w-0.5 h-2 bg-cyan-400 rounded-full animate-bounce" />
									<span className="w-0.5 h-3 bg-blue-500 rounded-full animate-pulse" />
									<span className="w-0.5 h-1.5 bg-cyan-300 rounded-full animate-bounce" />
								</div>
							)}
						</div>
					) : (
						<span
							title={channel.provider || channel.group || "Live TV"}
							className="text-[10px] text-zinc-500 group-hover:text-cyan-400 font-medium shrink-0 max-w-[90px] truncate text-right transition-colors"
						>
							{channel.provider || channel.group || "Live TV"}
						</span>
					)}
				</div>

				{/* Subtle Gradient Backlight */}
				<div
					className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl ${
						isActive
							? "bg-gradient-to-t from-cyan-500/10 to-transparent"
							: "bg-gradient-to-t from-white/[0.03] to-transparent"
					}`}
				/>
			</div>
		);
	},
);
AppleTVCard.displayName = "AppleTVCard";
