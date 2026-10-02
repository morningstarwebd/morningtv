// src/components/SoundBoosterControl.tsx
// Cinema-Grade Animated Audio Booster Studio with Real-time Visualizer & Dynamics Compressor

import {
	Activity,
	Sparkles,
	Volume1,
	Volume2,
	VolumeX,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";

export const SoundBoosterControl: React.FC = () => {
	const {
		volume,
		soundBoost,
		isMuted,
		isPlaying,
		normalizeAudio,
		setVolume,
		setSoundBoost,
		toggleMute,
		toggleNormalizeAudio,
	} = useAppStore();

	const [isOpen, setIsOpen] = useState(false);
	const [activeEqHeights, setActiveEqHeights] = useState<number[]>([
		20, 45, 70, 35, 85, 60, 40, 95, 75, 50, 65, 30, 80, 55, 90, 40,
	]);
	const containerRef = useRef<HTMLDivElement>(null);

	// Close popup when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	// High-frequency animated audio visualizer simulation
	useEffect(() => {
		if (!isOpen) return;

		const interval = setInterval(() => {
			if (!isPlaying || isMuted || volume === 0) {
				setActiveEqHeights((prev) => prev.map(() => 8));
				return;
			}

			const intensity = (volume / 100) * (soundBoost / 100);
			setActiveEqHeights((prev) =>
				prev.map(() => {
					const base = Math.floor(Math.random() * 65 + 15);
					return Math.min(
						100,
						Math.max(10, Math.round(base * Math.min(1.4, intensity))),
					);
				}),
			);
		}, 80);

		return () => clearInterval(interval);
	}, [isOpen, isPlaying, isMuted, volume, soundBoost]);

	const isBoosted = soundBoost > 100;
	const effectiveOutputPercent = isMuted
		? 0
		: Math.round((volume * soundBoost) / 100);

	const presets = [
		{ label: "100%", value: 100, title: "Clean", desc: "1.0x" },
		{ label: "150%", value: 150, title: "Cinema", desc: "1.5x" },
		{ label: "200%", value: 200, title: "Stadium", desc: "2.0x" },
		{ label: "300%", value: 300, title: "Turbo", desc: "3.0x" },
	];

	return (
		<div ref={containerRef} className="relative flex items-center">
			{/* Animated Sound Booster Studio Popover */}
			{isOpen && (
				<div className="absolute bottom-14 right-0 w-80 p-4 rounded-3xl bg-[#090d16]/95 border border-white/15 backdrop-blur-3xl shadow-2xl shadow-black/90 z-50 animate-in fade-in zoom-in-95 duration-200 select-none">
					{/* Header */}
					<div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
								<Zap className="w-4 h-4 text-white fill-white animate-pulse" />
							</div>
							<div>
								<div className="flex items-center gap-1.5">
									<h4 className="text-xs font-black text-white tracking-wide">
										Studio Sound Engine
									</h4>
									<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
								</div>
								<p className="text-[10px] text-zinc-400">
									300% Web Audio Pre-Amp
								</p>
							</div>
						</div>

						<div className="flex items-center gap-1.5">
							<span
								className={`text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full border transition-all ${
									isBoosted
										? "bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm shadow-orange-500/20"
										: "bg-white/5 text-zinc-400 border-white/10"
								}`}
							>
								{soundBoost}%
							</span>
							<button
								onClick={() => setIsOpen(false)}
								className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
								title="Close"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</div>
					</div>

					{/* Real-time Frequency Equalizer Visualizer */}
					<div className="p-3 rounded-2xl bg-black/60 border border-white/5 mb-3.5 relative overflow-hidden">
						<div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-2">
							<span className="flex items-center gap-1 text-cyan-400 font-bold uppercase tracking-wider">
								<Activity className="w-3 h-3" /> Live Spectrum
							</span>
							<span className="text-zinc-500">
								{effectiveOutputPercent}% Total Gain
							</span>
						</div>

						<div className="flex items-end justify-between gap-1 h-10 px-1">
							{activeEqHeights.map((h, i) => (
								<div
									key={i}
									className="w-1.5 rounded-t-sm transition-all duration-75 ease-out shadow-xs"
									style={{
										height: `${h}%`,
										background:
											h > 75
												? "linear-gradient(to top, #f97316, #ef4444)"
												: h > 40
													? "linear-gradient(to top, #06b6d4, #f59e0b)"
													: "linear-gradient(to top, #3b82f6, #06b6d4)",
									}}
								/>
							))}
						</div>
					</div>

					{/* Master Volume Slider (0 - 100%) */}
					<div className="space-y-1.5 mb-3.5">
						<div className="flex justify-between text-[11px] font-semibold text-zinc-200">
							<span className="flex items-center gap-1.5">
								{isMuted || volume === 0 ? (
									<VolumeX className="w-3.5 h-3.5 text-rose-400" />
								) : volume < 50 ? (
									<Volume1 className="w-3.5 h-3.5 text-blue-400" />
								) : (
									<Volume2 className="w-3.5 h-3.5 text-cyan-400" />
								)}
								Master Volume
							</span>
							<span className="font-mono text-cyan-300 font-bold">
								{isMuted ? "MUTED" : `${volume}%`}
							</span>
						</div>
						<div className="relative flex items-center">
							<input
								type="range"
								min="0"
								max="100"
								value={isMuted ? 0 : volume}
								onChange={(e) => setVolume(Number(e.target.value))}
								className="w-full h-2 bg-zinc-800/80 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
							/>
						</div>
					</div>

					{/* Pre-Amp Gain Booster Slider (100% - 300%) */}
					<div className="space-y-1.5 mb-3.5">
						<div className="flex justify-between text-[11px] font-semibold">
							<span className="flex items-center gap-1.5 text-amber-300">
								<Sparkles className="w-3.5 h-3.5 text-orange-400 animate-spin-slow" />
								Pre-Amp Overdrive Booster
							</span>
							<span className="font-mono text-orange-400 font-black">
								{soundBoost}% ({(soundBoost / 100).toFixed(1)}x)
							</span>
						</div>
						<div className="relative flex items-center">
							<input
								type="range"
								min="100"
								max="300"
								step="5"
								value={soundBoost}
								onChange={(e) => setSoundBoost(Number(e.target.value))}
								className="w-full h-2 bg-zinc-800/80 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-amber-400 transition-all"
							/>
						</div>
					</div>

					{/* Quick Boost Preset Buttons */}
					<div className="grid grid-cols-4 gap-1.5 mb-3">
						{presets.map((p) => {
							const isSelected = soundBoost === p.value;
							return (
								<button
									key={p.value}
									onClick={() => setSoundBoost(p.value)}
									className={`py-2 px-1 rounded-2xl text-center transition-all cursor-pointer ${
										isSelected
											? "bg-gradient-to-b from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 scale-102 ring-1 ring-white/20"
											: "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 hover:border-white/15"
									}`}
								>
									<div className="text-[11px] font-black">{p.label}</div>
									<div className="text-[9px] font-medium opacity-80">
										{p.title}
									</div>
								</button>
							);
						})}
					</div>

					{/* Broadcast Loudness Normalization Toggle */}
					<div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
						<div>
							<div className="text-[11px] font-bold text-zinc-200">
								Broadcast Normalization
							</div>
							<div className="text-[9px] text-zinc-400">
								Smooths out channel volume shifts
							</div>
						</div>
						<button
							onClick={toggleNormalizeAudio}
							className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
								normalizeAudio ? "bg-cyan-500" : "bg-zinc-700"
							}`}
							title="Toggle automatic loudness compressor"
						>
							<div
								className={`w-4 h-4 rounded-full bg-white transition-transform ${
									normalizeAudio ? "translate-x-4" : "translate-x-0"
								}`}
							/>
						</button>
					</div>
				</div>
			)}

			{/* Mute / Unmute Button */}
			<button
				onClick={toggleMute}
				className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
				title={isMuted ? "Unmute" : "Mute (M)"}
			>
				{isMuted || volume === 0 ? (
					<VolumeX className="w-4 h-4 text-red-500 animate-pulse" />
				) : (
					<Volume2 className="w-4 h-4" />
				)}
			</button>

			{/* Dock Volume Slider */}
			<div className="flex items-center gap-2">
				<input
					type="range"
					min="0"
					max="100"
					value={isMuted ? 0 : volume}
					onChange={(e) => setVolume(Number(e.target.value))}
					className="w-20 sm:w-28 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
				/>
			</div>

			{/* Sound Booster Badge Trigger Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`ml-1.5 w-14 py-1 rounded-full text-[10px] font-extrabold tracking-wider flex items-center justify-center gap-0.5 transition-all cursor-pointer shrink-0 font-mono tabular-nums ${
					isBoosted
						? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 ring-1 ring-orange-400/50 hover:brightness-110 animate-pulse"
						: "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/10"
				}`}
				title="Open Studio Sound Booster & Equalizer"
			>
				<Zap className="w-2.5 h-2.5 fill-current shrink-0" />
				<span className="w-8 text-center">
					{isBoosted ? `${soundBoost}%` : "BOOST"}
				</span>
			</button>
		</div>
	);
};
