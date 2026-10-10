// src/components/ai/AiVoiceDock.tsx
// Floating soundwave equalizer dock banner for voice interaction

import type React from "react";

interface AiVoiceDockProps {
	isListening: boolean;
	transcript: string;
}

export const AiVoiceDock: React.FC<AiVoiceDockProps> = ({
	isListening,
	transcript,
}) => {
	if (!isListening) return null;

	return (
		<div className="mx-4 mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-indigo-950/70 to-purple-950/70 border border-cyan-500/40 backdrop-blur-xl flex items-center justify-between gap-3 shadow-xl shrink-0 animate-in fade-in slide-in-from-bottom-2">
			<div className="flex items-center gap-2 min-w-0">
				<div className="relative flex h-3 w-3 shrink-0">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
					<span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
				</div>
				<span className="text-xs font-bold text-cyan-300 shrink-0">
					Listening...
				</span>
				{transcript ? (
					<span className="text-xs text-white font-medium truncate bg-black/40 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
						"{transcript}"
					</span>
				) : (
					<span className="text-[11px] text-zinc-400 italic">
						Speak channel, mood or command...
					</span>
				)}
			</div>
			<div className="flex items-center gap-1 h-3.5 shrink-0">
				{[40, 75, 100, 60, 85, 45, 95, 30].map((h, i) => (
					<div
						key={i}
						className="w-1 rounded-full bg-cyan-400 animate-pulse"
						style={{
							height: `${h}%`,
							animationDelay: `${i * 80}ms`,
						}}
					/>
				))}
			</div>
		</div>
	);
};
