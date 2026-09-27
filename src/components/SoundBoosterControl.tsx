// src/components/SoundBoosterControl.tsx
// Professional Audio Booster popover with pre-amp gain up to 300% & equalizer visualizer

import { Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";

export const SoundBoosterControl: React.FC = () => {
	const { volume, soundBoost, isMuted, setVolume, setSoundBoost, toggleMute } =
		useAppStore();

	const [isOpen, setIsOpen] = useState(false);
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
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const isBoosted = soundBoost > 100;

	const presets = [
		{ label: "100%", value: 100, desc: "Normal" },
		{ label: "150%", value: 150, desc: "Boost" },
		{ label: "200%", value: 200, desc: "Turbo" },
		{ label: "300%", value: 300, desc: "Max Gain" },
	];

	return (
		<div ref={containerRef} className="relative flex items-center">
			{/* Sound Booster Popover Menu */}
			{isOpen && (
				<div className="absolute bottom-12 right-0 w-72 p-4 rounded-2xl bg-[#0b0e18]/95 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
					<div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
						<div className="flex items-center gap-2">
							<div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
								<Zap className="w-4 h-4 text-white fill-white" />
							</div>
							<div>
								<h4 className="text-xs font-bold text-white tracking-wide">
									Sound Booster
								</h4>
								<p className="text-[10px] text-zinc-400">
									Web Audio Anti-Distortion Gain
								</p>
							</div>
						</div>
						<span
							className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
								isBoosted
									? "bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse"
									: "bg-white/5 text-zinc-400 border-white/10"
							}`}
						>
							{soundBoost}%
						</span>
					</div>

					{/* Master Volume Slider (0 - 100%) */}
					<div className="space-y-1.5 mb-4">
						<div className="flex justify-between text-[11px] font-medium text-zinc-300">
							<span>Master Volume</span>
							<span className="font-mono text-zinc-400">
								{isMuted ? 0 : volume}%
							</span>
						</div>
						<input
							type="range"
							min="0"
							max="100"
							value={isMuted ? 0 : volume}
							onChange={(e) => setVolume(Number(e.target.value))}
							className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
						/>
					</div>

					{/* Audio Pre-Amp Booster Slider (100 - 300%) */}
					<div className="space-y-1.5 mb-4">
						<div className="flex justify-between text-[11px] font-medium text-zinc-300">
							<span className="flex items-center gap-1.5 text-orange-400 font-semibold">
								<Sparkles className="w-3 h-3" />
								Pre-Amp Gain Booster
							</span>
							<span className="font-mono text-orange-400 font-bold">
								{soundBoost}%
							</span>
						</div>
						<input
							type="range"
							min="100"
							max="300"
							step="5"
							value={soundBoost}
							onChange={(e) => setSoundBoost(Number(e.target.value))}
							className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
						/>
					</div>

					{/* Preset Buttons */}
					<div className="grid grid-cols-4 gap-1.5">
						{presets.map((p) => (
							<button
								key={p.value}
								onClick={() => setSoundBoost(p.value)}
								className={`py-1.5 px-1 rounded-xl text-center text-[10px] font-bold transition-all ${
									soundBoost === p.value
										? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 scale-102"
										: "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 hover:border-white/10"
								}`}
							>
								<div>{p.label}</div>
								<div className="text-[8px] font-normal opacity-75">
									{p.desc}
								</div>
							</button>
						))}
					</div>

					{/* Animated Equalizer Waves */}
					{isBoosted && (
						<div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-orange-300">
							<span className="font-medium">Dynamics Compressor Active</span>
							<div className="flex items-end gap-0.5 h-3">
								<span className="w-0.5 h-3 bg-orange-500 rounded-full animate-pulse" />
								<span className="w-0.5 h-2 bg-amber-400 rounded-full animate-bounce" />
								<span className="w-0.5 h-3.5 bg-orange-400 rounded-full animate-pulse" />
								<span className="w-0.5 h-2 bg-amber-500 rounded-full animate-bounce" />
							</div>
						</div>
					)}
				</div>
			)}

			{/* Mute / Unmute Button */}
			<button
				onClick={toggleMute}
				className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
				title={isMuted ? "Unmute" : "Mute"}
			>
				{isMuted || volume === 0 ? (
					<VolumeX className="w-4 h-4 text-red-500" />
				) : (
					<Volume2 className="w-4 h-4" />
				)}
			</button>

			{/* Volume Slider */}
			<div className="flex items-center gap-2">
				<input
					type="range"
					min="0"
					max="100"
					value={isMuted ? 0 : volume}
					onChange={(e) => setVolume(Number(e.target.value))}
					className="w-20 sm:w-28 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
				/>
			</div>

			{/* Sound Booster Badge Trigger Button (Fixed width & tabular numbers) */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`ml-1.5 w-14 py-1 rounded-full text-[10px] font-extrabold tracking-wider flex items-center justify-center gap-0.5 transition-all cursor-pointer shrink-0 font-mono tabular-nums ${
					isBoosted
						? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 ring-1 ring-orange-400/50 hover:brightness-110"
						: "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/10"
				}`}
				title="Open Sound Booster pre-amp gain control"
			>
				<Zap className="w-2.5 h-2.5 fill-current shrink-0" />
				<span className="w-8 text-center">
					{isBoosted ? `${soundBoost}%` : "BOOST"}
				</span>
			</button>
		</div>
	);
};
