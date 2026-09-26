// src/components/AppleTVDock.tsx
// Minimalist Apple TV 4K-style floating bottom dock with auto-hide

import {
	Layers,
	Maximize,
	Maximize2,
	Minimize2,
	Pause,
	Play,
	SkipBack,
	SkipForward,
	Sparkles,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { SoundBoosterControl } from "./SoundBoosterControl";

export const AppleTVDock: React.FC = () => {
	const {
		activeChannel,
		isPlaying,
		bufferSecs,
		aspectRatio,
		ambientGlow,
		togglePlayPause,
		nextChannel,
		prevChannel,
		openChannelDrawer,
		cycleAspectRatio,
		toggleAmbientGlow,
	} = useAppStore();

	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isVisible, setIsVisible] = useState(true);
	const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
		document.addEventListener("fullscreenchange", handleFsChange);
		return () =>
			document.removeEventListener("fullscreenchange", handleFsChange);
	}, []);

	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch(() => {});
		} else {
			document.exitFullscreen().catch(() => {});
		}
	};

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

	const getBufferColor = () => {
		if (bufferSecs >= 10) return "bg-emerald-400 shadow-emerald-500/50";
		if (bufferSecs >= 4) return "bg-amber-400 shadow-amber-500/50";
		return "bg-red-400 shadow-red-500/50";
	};

	return (
		<div
			className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300 ${
				isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
			}`}
		>
			<div className="flex items-center gap-2 sm:gap-3 px-4 py-2 rounded-full bg-[#050814]/85 border border-white/15 backdrop-blur-3xl shadow-2xl shadow-black ring-1 ring-white/10 pointer-events-auto">
				{/* Open Channels Shelf (Guide) */}
				<button
					onClick={openChannelDrawer}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-black shadow-lg shadow-white/15 transition-all cursor-pointer hover:scale-105 active:scale-95"
					title="Browse Channels Shelf (C)"
				>
					<Layers className="w-3.5 h-3.5" />
					<span>Channels</span>
				</button>

				<div className="w-px h-5 bg-white/10" />

				{/* Previous Channel */}
				<button
					onClick={prevChannel}
					disabled={!activeChannel}
					className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30"
					title="Previous Channel ([)"
				>
					<SkipBack className="w-4 h-4" />
				</button>

				{/* Play / Pause Toggle */}
				<button
					onClick={togglePlayPause}
					disabled={!activeChannel}
					className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 cursor-pointer ${
						activeChannel
							? "bg-gradient-to-tr from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white hover:scale-105 active:scale-95 shadow-cyan-500/25"
							: "bg-white/5 text-zinc-600 cursor-not-allowed"
					}`}
					title={isPlaying ? "Pause (Space)" : "Play (Space)"}
				>
					{isPlaying ? (
						<Pause className="w-4 h-4 fill-white" />
					) : (
						<Play className="w-4 h-4 fill-white ml-0.5" />
					)}
				</button>

				{/* Next Channel */}
				<button
					onClick={nextChannel}
					disabled={!activeChannel}
					className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30"
					title="Next Channel (])"
				>
					<SkipForward className="w-4 h-4" />
				</button>

				<div className="w-px h-5 bg-white/10" />

				{/* Web Audio 300% Sound Booster & Volume */}
				<SoundBoosterControl />

				{/* Buffer Health Indicator */}
				<div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-300">
					<span className={`w-2 h-2 rounded-full ${getBufferColor()}`} />
					<span className="font-mono text-[11px] font-semibold">
						{bufferSecs}s
					</span>
				</div>

				{/* Aspect Ratio Cycler */}
				<button
					onClick={cycleAspectRatio}
					className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer hidden sm:block"
					title={`Aspect Ratio: ${aspectRatio}`}
				>
					<Maximize className="w-3.5 h-3.5" />
				</button>

				{/* Ambient Glow */}
				<button
					onClick={toggleAmbientGlow}
					className={`p-2 rounded-full transition-all cursor-pointer hidden sm:block ${
						ambientGlow
							? "text-cyan-400 bg-cyan-500/10"
							: "text-zinc-400 hover:text-white"
					}`}
					title="Ambient Glow Aura"
				>
					<Sparkles className="w-3.5 h-3.5" />
				</button>

				<div className="w-px h-5 bg-white/10" />

				{/* Fullscreen Toggle */}
				<button
					onClick={toggleFullscreen}
					className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer"
					title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
				>
					{isFullscreen ? (
						<Minimize2 className="w-4 h-4" />
					) : (
						<Maximize2 className="w-4 h-4" />
					)}
				</button>
			</div>
		</div>
	);
};
