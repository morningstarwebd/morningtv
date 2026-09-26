// src/components/YouTubeModal.tsx
// Embedded YouTube TV Player & 24/7 Live Stream Hub

import { Play, Radio, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";

interface YouTubeItem {
	id: string; // 11-character YouTube video ID or stream ID
	title: string;
	category: "Bengali" | "Hindi" | "Global" | "Music";
	thumbnail: string;
	isLive?: boolean;
}

const FEATURED_YOUTUBE_STREAMS: YouTubeItem[] = [
	{
		id: "jfKfPfyJRdk",
		title: "Lofi Girl - Relaxing Beats to Study/Chill to",
		category: "Music",
		thumbnail:
			"https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&auto=format&fit=crop&q=80",
		isLive: true,
	},
	{
		id: "21X5lGlDOfg",
		title: "NASA Live: Earth Views from the Space Station",
		category: "Global",
		thumbnail:
			"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80",
		isLive: true,
	},
	{
		id: "4xDzrJKXOOY",
		title: "Synthwave Radio - Chill synth / retro beats 24/7",
		category: "Music",
		thumbnail:
			"https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80",
		isLive: true,
	},
	{
		id: "f02mOEt11OQ",
		title: "Relaxing Jazz Piano Radio - 24/7 Cafe Music",
		category: "Music",
		thumbnail:
			"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80",
		isLive: true,
	},
];

export const YouTubeModal: React.FC = () => {
	const {
		isYouTubeModalOpen,
		closeYouTubeModal,
		activeYouTubeVideoId,
		setYouTubeVideoId,
		showToast,
	} = useAppStore();

	const [inputUrl, setInputUrl] = useState("");
	const [currentVideoId, setCurrentVideoId] = useState<string>("jfKfPfyJRdk");
	const [activeTab, setActiveTab] = useState<
		"All" | "Bengali" | "Hindi" | "Music" | "Global"
	>("All");
	const modalRef = useRef<HTMLDivElement>(null);

	// Sync activeYouTubeVideoId from store
	useEffect(() => {
		if (activeYouTubeVideoId) {
			setCurrentVideoId(activeYouTubeVideoId);
		}
	}, [activeYouTubeVideoId]);

	// Close on ESC
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isYouTubeModalOpen) {
				closeYouTubeModal();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isYouTubeModalOpen, closeYouTubeModal]);

	if (!isYouTubeModalOpen) return null;

	// Extract 11-char YouTube ID from various URL formats
	const extractVideoId = (urlOrId: string): string | null => {
		const trimmed = urlOrId.trim();
		if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
			return trimmed;
		}
		const regExp =
			/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|live\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/;
		const match = trimmed.match(regExp);
		return match && match[1].length === 11 ? match[1] : null;
	};

	const handlePlayUrl = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!inputUrl) return;
		const id = extractVideoId(inputUrl);
		if (id) {
			setCurrentVideoId(id);
			setYouTubeVideoId(id);
			setInputUrl("");
			showToast("Loading YouTube Video...", false);
		} else {
			showToast("Please enter a valid YouTube Video or Live link", true);
		}
	};

	const filteredStreams =
		activeTab === "All"
			? FEATURED_YOUTUBE_STREAMS
			: FEATURED_YOUTUBE_STREAMS.filter((s) => s.category === activeTab);

	const tabs: ("All" | "Bengali" | "Hindi" | "Music" | "Global")[] = [
		"All",
		"Music",
		"Global",
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
			{/* Blurred Backdrop */}
			<div
				className="fixed inset-0 bg-black/85 backdrop-blur-md"
				onClick={closeYouTubeModal}
			/>

			{/* Main YouTube TV Cinema Modal */}
			<div
				ref={modalRef}
				className="relative z-10 w-full max-w-5xl max-h-[92vh] bg-[#070913] border border-white/15 rounded-3xl shadow-2xl shadow-black overflow-hidden flex flex-col"
			>
				{/* Modal Top Header */}
				<div className="px-5 py-3.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
							<Play className="w-4 h-4 text-white fill-white ml-0.5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h3 className="text-sm font-black tracking-wider text-white">
									YouTube TV
								</h3>
								<span className="px-1.5 py-0.2 rounded-xs bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold">
									24/7 LIVE
								</span>
							</div>
							<p className="text-[10px] text-zinc-400">
								Watch YouTube live streams, channels & videos directly inside
								NovaTV
							</p>
						</div>
					</div>

					{/* Quick URL Input */}
					<form
						onSubmit={handlePlayUrl}
						className="flex-1 max-w-md hidden sm:flex items-center gap-1.5"
					>
						<div className="relative flex-1">
							<input
								type="text"
								placeholder="Paste any YouTube video or live URL..."
								value={inputUrl}
								onChange={(e) => setInputUrl(e.target.value)}
								className="w-full bg-white/[0.06] hover:bg-white/[0.1] focus:bg-black/90 text-xs text-white placeholder-zinc-500 rounded-full px-4 py-2 border border-white/10 focus:border-red-500 focus:outline-none transition-all"
							/>
						</div>
						<button
							type="submit"
							className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
						>
							Play
						</button>
					</form>

					{/* Close button */}
					<button
						onClick={closeYouTubeModal}
						className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all cursor-pointer"
						title="Close (Esc)"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Modal Body */}
				<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin">
					{/* Mobile URL Input */}
					<form
						onSubmit={handlePlayUrl}
						className="sm:hidden flex items-center gap-2"
					>
						<input
							type="text"
							placeholder="Paste YouTube URL..."
							value={inputUrl}
							onChange={(e) => setInputUrl(e.target.value)}
							className="flex-1 bg-white/[0.06] text-xs text-white placeholder-zinc-500 rounded-full px-4 py-2 border border-white/10 focus:border-red-500 focus:outline-none"
						/>
						<button
							type="submit"
							className="px-4 py-2 rounded-full bg-red-600 text-white text-xs font-bold"
						>
							Play
						</button>
					</form>

					{/* Embedded Cinema Player Container */}
					<div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
						<iframe
							title="NovaTV YouTube Player"
							src={`https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`}
							className="w-full h-full border-0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					</div>

					{/* Stream Shortcuts & Categories */}
					<div>
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
							<div className="flex items-center gap-2">
								<Radio className="w-4 h-4 text-red-500" />
								<h4 className="text-xs font-black tracking-wider text-white uppercase">
									Featured 24/7 Channels & Live Streams
								</h4>
							</div>

							{/* Category Filter Pills */}
							<div className="flex items-center gap-1.5 overflow-x-auto">
								{tabs.map((tab) => (
									<button
										key={tab}
										onClick={() => setActiveTab(tab)}
										className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
											activeTab === tab
												? "bg-red-600 text-white shadow-md"
												: "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
										}`}
									>
										{tab}
									</button>
								))}
							</div>
						</div>

						{/* Grid of YouTube Channels */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
							{filteredStreams.map((stream) => {
								const isPlayingThis = currentVideoId === stream.id;
								return (
									<button
										key={stream.id}
										onClick={() => {
											setCurrentVideoId(stream.id);
											setYouTubeVideoId(stream.id);
										}}
										className={`relative rounded-xl overflow-hidden border transition-all text-left group cursor-pointer ${
											isPlayingThis
												? "border-red-500 ring-2 ring-red-500/50 scale-102 shadow-xl shadow-red-500/20"
												: "border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.06]"
										}`}
									>
										<div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
											<img
												src={stream.thumbnail}
												alt={stream.title}
												className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
											{stream.isLive && (
												<div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[8px] font-black">
													<span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
													<span>LIVE</span>
												</div>
											)}
											<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
												<div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
													<Play className="w-4 h-4 fill-white ml-0.5" />
												</div>
											</div>
										</div>
										<div className="p-2.5">
											<p className="text-[11px] font-bold text-white line-clamp-2 group-hover:text-red-300 transition-colors">
												{stream.title}
											</p>
											<span className="text-[9px] text-zinc-400 font-mono mt-1 block">
												{stream.category}
											</span>
										</div>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
