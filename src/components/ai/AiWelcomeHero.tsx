// src/components/ai/AiWelcomeHero.tsx
// Clean Gemini / ChatGPT style welcome hero with quick prompt suggestion cards

import { Bot, Sparkles, Tv, Zap } from "lucide-react";
import type React from "react";

interface AiWelcomeHeroProps {
	currentPreset: {
		gradient: string;
		icon: React.ElementType;
	};
	aiCustomAvatarUrl: string;
	onSendMessage: (query: string) => void;
}

export const AiWelcomeHero: React.FC<AiWelcomeHeroProps> = ({
	currentPreset,
	aiCustomAvatarUrl,
	onSendMessage,
}) => {
	const Icon = currentPreset.icon;

	return (
		<div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
			{/* Glowing AI Orb Avatar */}
			<div className="relative mb-4 flex items-center justify-center select-none">
				<div
					className={`absolute inset-0 rounded-full filter blur-xl opacity-60 bg-gradient-to-tr ${currentPreset.gradient} animate-pulse`}
				/>
				<div
					className={`relative w-16 h-16 rounded-full bg-gradient-to-tr ${currentPreset.gradient} p-0.5 shadow-xl flex items-center justify-center transition-transform hover:scale-105`}
				>
					{aiCustomAvatarUrl ? (
						<img
							src={aiCustomAvatarUrl}
							alt="AI Profile"
							className="w-full h-full object-cover rounded-full"
						/>
					) : (
						<div className="w-full h-full rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
							<Icon className="w-8 h-8 text-white drop-shadow-md" />
						</div>
					)}
				</div>
			</div>

			<h2 className="text-lg font-bold text-white tracking-wide mb-1">
				MorningTV AI Co-Pilot
			</h2>
			<p className="text-xs text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
				Multilingual AI brain with live tool execution. Switch channels, heal lost streams into database, or ask any question.
			</p>

			{/* Prompt Suggestion Cards (2x2 Grid) */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg mx-auto">
				<button
					type="button"
					onClick={() => onSendMessage("Play Hungama")}
					className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-purple-500/40 text-left transition-all cursor-pointer group flex flex-col gap-1 shadow-sm"
				>
					<div className="flex items-center gap-2">
						<Tv className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
						<span className="text-xs font-semibold text-white">
							Play Hungama
						</span>
					</div>
					<p className="text-[10px] text-zinc-400">
						Switch to Hungama kids channel (typo tolerant)
					</p>
				</button>

				<button
					type="button"
					onClick={() => onSendMessage("Play Zee Bangla HD")}
					className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-cyan-500/40 text-left transition-all cursor-pointer group flex flex-col gap-1 shadow-sm"
				>
					<div className="flex items-center gap-2">
						<Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
						<span className="text-xs font-semibold text-white">
							Play Zee Bangla HD
						</span>
					</div>
					<p className="text-[10px] text-zinc-400">
						Switch to Zee Bangla HD stream
					</p>
				</button>

				<button
					type="button"
					onClick={() => onSendMessage("\\heal Zee Bangla HD")}
					className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-emerald-500/40 text-left transition-all cursor-pointer group flex flex-col gap-1 shadow-sm"
				>
					<div className="flex items-center gap-2">
						<Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
						<span className="text-xs font-semibold text-white font-mono">
							\heal Zee Bangla HD
						</span>
					</div>
					<p className="text-[10px] text-zinc-400">
						Hunt internet & restore stream to database
					</p>
				</button>

				<button
					type="button"
					onClick={() =>
						onSendMessage("What tools and capabilities do you have?")
					}
					className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-amber-500/40 text-left transition-all cursor-pointer group flex flex-col gap-1 shadow-sm"
				>
					<div className="flex items-center gap-2">
						<Bot className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
						<span className="text-xs font-semibold text-white">
							Capabilities & Tools
						</span>
					</div>
					<p className="text-[10px] text-zinc-400">
						Show available playback, healing & system tools
					</p>
				</button>
			</div>
		</div>
	);
};
