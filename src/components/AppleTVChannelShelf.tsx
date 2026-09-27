import {
	ChevronLeft,
	ChevronRight,
	Clapperboard,
	Film,
	LayoutGrid,
	Music,
	Newspaper,
	Radio,
	Search,
	Smile,
	Star,
	Trophy,
	Tv,
	X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { getChannelIdString } from "../types";
import { AppleTVCard } from "./AppleTVCard";
import { AppleTVCardSkeleton } from "./AppleTVCardSkeleton";

export const AppleTVChannelShelf: React.FC = () => {
	const {
		channels,
		categories,
		activeCategory,
		providers,
		activeProvider,
		setActiveProvider,
		searchQuery,
		activeChannel,
		isPlaying,
		isChannelDrawerOpen,
		closeChannelDrawer,
		selectChannel,
		toggleFavorite,
		setCategory,
		setSearchQuery,
		openNativeYouTube,
		openNativeHotstar,
	} = useAppStore();

	const scrollRef = useRef<HTMLDivElement>(null);
	const catScrollRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const INITIAL_COUNT = 40;
	const BATCH_SIZE = 30;
	const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
	const [localSearch, setLocalSearch] = useState(searchQuery);

	const activeChannelId = activeChannel
		? getChannelIdString(activeChannel.id)
		: null;

	// Filter channels by activeProvider
	const displayChannels = useMemo(() => {
		if (activeProvider === "All") return channels;
		return channels.filter(
			(c) => (c.provider || "IPTV-Org") === activeProvider,
		);
	}, [channels, activeProvider]);

	// Sync local search when global searchQuery changes
	useEffect(() => {
		setLocalSearch(searchQuery);
	}, [searchQuery]);

	// Debounce search keystrokes by 150ms to keep 10,000-channel filtering silky smooth
	useEffect(() => {
		const timer = setTimeout(() => {
			if (localSearch !== searchQuery) {
				setSearchQuery(localSearch);
			}
		}, 150);
		return () => clearTimeout(timer);
	}, [localSearch, searchQuery, setSearchQuery]);

	// Load more channels on horizontal scroll or sentinel intersection
	const loadMore = useCallback(() => {
		setVisibleCount((prev) => {
			if (prev < displayChannels.length) {
				return Math.min(prev + BATCH_SIZE, displayChannels.length);
			}
			return prev;
		});
	}, [displayChannels.length]);

	// Reset visibleCount or ensure activeChannel is within visible range
	useEffect(() => {
		if (activeChannelId && displayChannels.length > 0) {
			const activeIdx = displayChannels.findIndex(
				(c) => getChannelIdString(c.id) === activeChannelId,
			);
			if (activeIdx >= 0) {
				setVisibleCount(Math.max(INITIAL_COUNT, activeIdx + 15));
				return;
			}
		}
		setVisibleCount(INITIAL_COUNT);
	}, [activeCategory, activeProvider, searchQuery, displayChannels.length, activeChannelId]);

	// Horizontal scroll listener fallback for smooth chunk loading
	const handleScroll = useCallback(() => {
		if (!scrollRef.current) return;
		const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
		if (scrollLeft + clientWidth >= scrollWidth - 500) {
			loadMore();
		}
	}, [loadMore]);

	// IntersectionObserver on sentinel at the end of the shelf track
	useEffect(() => {
		const sentinel = sentinelRef.current;
		const container = scrollRef.current;
		if (!sentinel || !container) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					loadMore();
				}
			},
			{
				root: container,
				rootMargin: "0px 300px 0px 0px",
			},
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [loadMore, visibleCount]);

	// Scroll active channel into view when shelf opens
	useEffect(() => {
		if (isChannelDrawerOpen && scrollRef.current && activeChannelId) {
			setTimeout(() => {
				const activeElem = scrollRef.current?.querySelector(".ring-2");
				if (activeElem) {
					activeElem.scrollIntoView({
						behavior: "smooth",
						block: "nearest",
						inline: "center",
					});
				}
			}, 100);
		}
	}, [isChannelDrawerOpen, activeChannelId]);

	// Close on ESC
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isChannelDrawerOpen) {
				closeChannelDrawer();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isChannelDrawerOpen, closeChannelDrawer]);

	const scrollBy = (offset: number) => {
		if (scrollRef.current) {
			scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
		}
	};

	const getCategoryIcon = (cat: string) => {
		const lower = cat.toLowerCase();
		if (lower.includes("all")) return <LayoutGrid className="w-3.5 h-3.5" />;
		if (lower.includes("fav"))
			return <Star className="w-3.5 h-3.5 text-amber-400" />;
		if (lower.includes("movie") || lower.includes("cinema"))
			return <Clapperboard className="w-3.5 h-3.5 text-rose-400" />;
		if (lower.includes("enter"))
			return <Film className="w-3.5 h-3.5 text-purple-400" />;
		if (lower.includes("news"))
			return <Newspaper className="w-3.5 h-3.5 text-cyan-400" />;
		if (
			lower.includes("kid") ||
			lower.includes("anim") ||
			lower.includes("cartoon")
		)
			return <Smile className="w-3.5 h-3.5 text-emerald-400" />;
		if (lower.includes("sport"))
			return <Trophy className="w-3.5 h-3.5 text-orange-400" />;
		if (lower.includes("music"))
			return <Music className="w-3.5 h-3.5 text-pink-400" />;
		if (lower.includes("youtube"))
			return (
				<img
					src="/youtube.svg"
					alt="YouTube"
					className="w-4 h-3 object-contain inline-block"
				/>
			);
		if (lower.includes("hotstar"))
			return (
				<img
					src="/jiohotstar_spark.png"
					alt="JioHotstar"
					className="w-3.5 h-3.5 object-contain inline-block"
				/>
			);
		return <Radio className="w-3.5 h-3.5" />;
	};

	const displayCategories = [
		...categories.filter((c) => c !== "YouTube" && c !== "Hotstar"),
		"YouTube",
		"Hotstar",
	];

	if (!isChannelDrawerOpen) return null;

	return (
		<>
			{/* Dimmed backdrop */}
			<div
				onClick={closeChannelDrawer}
				className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200"
			/>

			{/* Floating Apple TV Shelf from Bottom */}
			<div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050814]/92 border-t border-white/15 backdrop-blur-3xl shadow-2xl shadow-black select-none animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[48vh] sm:max-h-[52vh]">
				{/* Top Header of Shelf */}
				<div className="px-3 sm:px-6 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-2 sm:gap-4 shrink-0">
					{/* Categories Pill Selector with Left/Right Buttons and Wheel Support */}
					<div className="relative flex-1 min-w-0 flex items-center gap-1 group/cats overflow-hidden">
						{/* Scroll Categories Left */}
						<button
							onClick={() =>
								catScrollRef.current?.scrollBy({ left: -220, behavior: "smooth" })
							}
							className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white shrink-0 transition-opacity opacity-0 group-hover/cats:opacity-100 cursor-pointer z-10 shadow"
							title="Scroll categories left"
						>
							<ChevronLeft className="w-3.5 h-3.5" />
						</button>

						<div
							ref={catScrollRef}
							onWheel={(e) => {
								if (e.deltaY !== 0 && catScrollRef.current) {
									catScrollRef.current.scrollLeft += e.deltaY;
								}
							}}
							className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 scroll-smooth"
						>
							{displayCategories.map((cat) => {
								const isSelected = activeCategory === cat;
								return (
									<button
										key={cat}
										onClick={(e) => {
											setCategory(cat);
											(e.currentTarget as HTMLElement).scrollIntoView({
												behavior: "smooth",
												block: "nearest",
												inline: "center",
											});
										}}
										className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
											isSelected
												? cat === "YouTube"
													? "bg-red-600 text-white shadow-lg shadow-red-600/30 scale-102 font-extrabold"
													: cat === "Hotstar"
														? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-102 font-extrabold"
														: "bg-white text-black shadow-lg shadow-white/20 scale-102 font-extrabold"
												: cat === "YouTube"
													? "bg-red-500/10 text-red-400 hover:text-white hover:bg-red-600/30 border border-red-500/20"
													: cat === "Hotstar"
														? "bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-600/30 border border-blue-500/20"
														: "bg-white/[0.05] text-zinc-400 hover:text-white hover:bg-white/[0.1] border border-white/[0.06]"
										}`}
									>
										{getCategoryIcon(cat)}
										<span>{cat}</span>
									</button>
								);
							})}
						</div>

						{/* Scroll Categories Right */}
						<button
							onClick={() =>
								catScrollRef.current?.scrollBy({ left: 220, behavior: "smooth" })
							}
							className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white shrink-0 transition-opacity opacity-0 group-hover/cats:opacity-100 cursor-pointer z-10 shadow"
							title="Scroll categories right"
						>
							<ChevronRight className="w-3.5 h-3.5" />
						</button>
					</div>

					{/* Search Box & Close Button */}
					<div className="flex items-center gap-2 shrink-0">
						<div className="relative flex items-center w-48 sm:w-64">
							<Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Search live channels..."
								value={localSearch}
								onChange={(e) => setLocalSearch(e.target.value)}
								className="w-full bg-white/[0.06] hover:bg-white/[0.09] focus:bg-black/80 text-xs text-white placeholder-zinc-500 rounded-full pl-8 pr-7 py-1.5 border border-white/10 focus:border-cyan-400 focus:outline-none transition-all"
							/>
							{localSearch && (
								<button
									onClick={() => {
										setLocalSearch("");
										setSearchQuery("");
									}}
									className="absolute right-2.5 p-1 text-zinc-400 hover:text-white rounded-md cursor-pointer"
								>
									<X className="w-3 h-3" />
								</button>
							)}
						</div>

						<button
							onClick={closeChannelDrawer}
							className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all cursor-pointer"
							title="Close Guide (Esc)"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Provider Filter Sub-bar */}
				{providers.length > 1 && (
					<div className="px-3 sm:px-6 py-1 bg-black/40 border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
						<span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0 flex items-center gap-1">
							<Radio className="w-3 h-3 text-cyan-400" />
							Provider:
						</span>
						<div className="flex items-center gap-1.5">
							{providers.map((p) => {
								const isSelected = activeProvider === p;
								return (
									<button
										key={p}
										onClick={() => setActiveProvider(p)}
										className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
											isSelected
												? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs shadow-cyan-500/20 font-bold"
												: "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.04]"
										}`}
									>
										{p}
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Channels Horizontal Carousel Shelf */}
				<div className="relative flex-1 flex items-center p-3 sm:p-5 overflow-hidden group/shelf">
					{/* Scroll Left Button */}
					<button
						onClick={() => scrollBy(-400)}
						className="absolute left-2 z-20 w-10 h-10 rounded-full bg-black/75 hover:bg-black/95 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-opacity backdrop-blur-md shadow-2xl cursor-pointer"
						title="Scroll Left"
					>
						<ChevronLeft className="w-5 h-5" />
					</button>

					{/* Carousel Track */}
					<div
						ref={scrollRef}
						onScroll={handleScroll}
						className="w-full h-full flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none px-2 sm:px-6 py-2"
					>
						{/* In All Category: Show YouTube and JioHotstar side-by-side at start */}
						{activeCategory === "All" && (
							<>
								{/* Official YouTube Channel Tile with Clean Logo */}
								<div
									onClick={() => {
										openNativeYouTube();
										closeChannelDrawer();
									}}
									className="w-48 sm:w-52 h-28 sm:h-32 shrink-0 rounded-2xl bg-gradient-to-tr from-red-950/80 via-red-900/60 to-red-800/40 border-2 border-red-500/60 hover:border-red-400 p-3 sm:p-4 flex flex-col justify-between cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-900/30 group"
									title="Launch official YouTube (youtube.com with Gmail sign-in, search & 4K)"
								>
									<div className="flex items-center justify-between">
										<div className="h-7 px-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shadow-lg">
											<img
												src="/youtube.svg"
												alt="YouTube"
												className="h-4 w-auto object-contain"
											/>
										</div>
										<span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black tracking-wider">
											OFFICIAL
										</span>
									</div>
									<div>
										<h4 className="text-xs sm:text-sm font-black text-white group-hover:text-red-300 transition-colors">
											YouTube
										</h4>
										<p className="text-[9px] sm:text-[10px] text-zinc-300 mt-0.5 line-clamp-1">
											Search • 4K HDR • Sign-in
										</p>
									</div>
								</div>

								{/* Official JioHotstar Channel Tile */}
								<div
									onClick={() => {
										openNativeHotstar();
										closeChannelDrawer();
									}}
									className="w-48 sm:w-52 h-28 sm:h-32 shrink-0 rounded-2xl bg-gradient-to-tr from-blue-950/80 via-blue-900/60 to-indigo-900/40 border-2 border-blue-500/60 hover:border-blue-400 p-3 sm:p-4 flex flex-col justify-between cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/30 group"
									title="Launch JioHotstar Live Stream"
								>
									<div className="flex items-center justify-between">
										<div className="h-7 px-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shadow-lg">
											<img
												src="/jiohotstar_spark.png"
												alt="JioHotstar"
												className="h-5 w-auto object-contain drop-shadow"
											/>
										</div>
										<span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black tracking-wider">
											OFFICIAL
										</span>
									</div>
									<div>
										<h4 className="text-xs sm:text-sm font-black text-white group-hover:text-blue-300 transition-colors">
											JioHotstar
										</h4>
										<p className="text-[9px] sm:text-[10px] text-zinc-300 mt-0.5 line-clamp-1">
											Live Sports • Movies • Specials
										</p>
									</div>
								</div>
							</>
						)}

						{activeCategory === "YouTube" ? (
							<div
								onClick={() => {
									openNativeYouTube();
									closeChannelDrawer();
								}}
								className="w-80 h-32 shrink-0 rounded-2xl bg-gradient-to-tr from-red-950/90 via-red-900/70 to-red-800/50 border-2 border-red-500/70 hover:border-red-400 p-4 flex flex-col justify-between cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-900/40 group"
								title="Launch official YouTube (youtube.com with Gmail sign-in, search & 4K)"
							>
								<div className="flex items-center justify-between">
									<div className="h-8 px-3 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shadow-lg">
										<img
											src="/youtube.svg"
											alt="YouTube"
											className="h-5 w-auto object-contain"
										/>
									</div>
									<span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black tracking-wider">
										LAUNCH WEB
									</span>
								</div>
								<div>
									<h4 className="text-sm font-black text-white group-hover:text-red-300 transition-colors">
										Open Official YouTube
									</h4>
									<p className="text-[10px] text-zinc-300 mt-0.5">
										Click to browse youtube.com, search videos, or sign in with
										your Gmail account
									</p>
								</div>
							</div>
						) : activeCategory === "Hotstar" ? (
							<div
								onClick={() => {
									openNativeHotstar();
									closeChannelDrawer();
								}}
								className="w-80 h-32 shrink-0 rounded-2xl bg-gradient-to-tr from-blue-950/90 via-blue-900/70 to-indigo-900/50 border-2 border-blue-500/70 hover:border-blue-400 p-4 flex flex-col justify-between cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/40 group"
								title="Launch JioHotstar Live Stream"
							>
								<div className="flex items-center justify-between">
									<div className="h-8 px-3 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shadow-lg">
										<img
											src="/jiohotstar_white.png"
											alt="JioHotstar"
											className="h-6 w-auto object-contain drop-shadow"
										/>
									</div>
									<span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black tracking-wider">
										LAUNCH WEB
									</span>
								</div>
								<div>
									<h4 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
										Open JioHotstar
									</h4>
									<p className="text-[10px] text-zinc-300 mt-0.5">
										Stream live sports, blockbuster movies, and Disney+ Hotstar
										specials
									</p>
								</div>
							</div>
						) : displayChannels.length > 0 ? (
							<>
								{displayChannels.slice(0, visibleCount).map((channel, index) => (
									<AppleTVCard
										key={getChannelIdString(channel.id)}
										channel={channel}
										index={index}
										isActive={activeChannelId === getChannelIdString(channel.id)}
										isPlaying={isPlaying}
										onSelect={selectChannel}
										onToggleFavorite={toggleFavorite}
									/>
								))}

								{/* Progressive YouTube-Style Loading Skeleton Sentinel */}
								{visibleCount < displayChannels.length && (
									<div ref={sentinelRef} className="flex items-center gap-3 sm:gap-4 shrink-0">
										<AppleTVCardSkeleton count={2} />
									</div>
								)}

								{/* End of Category Indicator */}
								{displayChannels.length > INITIAL_COUNT && visibleCount >= displayChannels.length && (
									<div className="shrink-0 px-4 py-8 text-center select-none">
										<span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
											All {displayChannels.length} Channels Loaded
										</span>
									</div>
								)}
							</>
						) : channels.length === 0 ? (
							<div className="flex items-center gap-3 sm:gap-4 px-2">
								<AppleTVCardSkeleton count={6} />
							</div>
						) : (
							<div className="w-full py-8 text-center">
								<Tv className="w-8 h-8 text-zinc-600 mx-auto mb-2 animate-pulse" />
								<p className="text-xs font-bold text-zinc-400">
									No channels found in this category
								</p>
							</div>
						)}
					</div>

					{/* Scroll Right Button */}
					<button
						onClick={() => scrollBy(400)}
						className="absolute right-2 z-20 w-10 h-10 rounded-full bg-black/75 hover:bg-black/95 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-opacity backdrop-blur-md shadow-2xl cursor-pointer"
						title="Scroll Right"
					>
						<ChevronRight className="w-5 h-5" />
					</button>
				</div>
			</div>
		</>
	);
};
