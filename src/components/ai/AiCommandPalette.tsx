// src/components/ai/AiCommandPalette.tsx
// Rich floating autocomplete command palette triggered on backslash (\) and slash (/)

import {
	Calendar,
	Clock,
	Cpu,
	Folder,
	HelpCircle,
	Maximize,
	Play,
	Plus,
	Sparkles,
	Stethoscope,
	Trash2,
	Tv,
	Volume2,
	VolumeX,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";

export interface AiCommandItem {
	id: string;
	trigger: string;
	syntax: string;
	label: string;
	description: string;
	category: "playback" | "healing" | "automation" | "tools" | "system";
	icon: React.ComponentType<{ className?: string }>;
	hasParams: boolean;
	tag?: string;
}

export const AI_SYSTEM_COMMANDS: AiCommandItem[] = [
	{
		id: "play",
		trigger: "play",
		syntax: "\\play <channel>",
		label: "Play Channel",
		description: "Tune into any TV channel (phonetic & typo tolerant)",
		category: "playback",
		icon: Play,
		hasParams: true,
		tag: "Live Stream",
	},
	{
		id: "hunt",
		trigger: "hunt",
		syntax: "\\hunt <channel>",
		label: "Stream Hunter & Healer",
		description: "Autonomous hunter: Finds working mirrors online & saves to SQLite",
		category: "healing",
		icon: Zap,
		hasParams: true,
		tag: "Superpower",
	},
	{
		id: "add",
		trigger: "add",
		syntax: "\\add <channel>",
		label: "Add Channel from Internet",
		description: "Deep checkup across GitHub & upstream IPTV to find & add channel",
		category: "healing",
		icon: Plus,
		hasParams: true,
		tag: "Deep Hunt",
	},
	{
		id: "addstream",
		trigger: "addstream",
		syntax: "\\addstream <url> for <channel>",
		label: "Add Direct Stream URL",
		description: "Add custom stream or M3U link directly to local database",
		category: "healing",
		icon: Plus,
		hasParams: true,
		tag: "Direct URL",
	},
	{
		id: "doctor",
		trigger: "doctor",
		syntax: "\\doctor <channel>",
		label: "Stream Doctor Diagnostics",
		description: "Run diagnostic checks on stream health, mirrors & resolution",
		category: "healing",
		icon: Stethoscope,
		hasParams: true,
		tag: "Diagnostic",
	},
	{
		id: "tools",
		trigger: "tools",
		syntax: "\\tools",
		label: "AI System Tools & Powers",
		description: "Query all AI powers, database permissions & available tools",
		category: "tools",
		icon: HelpCircle,
		hasParams: false,
		tag: "Capabilities",
	},
	{
		id: "models",
		trigger: "models",
		syntax: "\\models",
		label: "Browse AI Models",
		description: "Open live model picker to browse Groq, Gemini & Ollama models",
		category: "system",
		icon: Cpu,
		hasParams: false,
		tag: "Neural",
	},
	{
		id: "model",
		trigger: "model",
		syntax: "\\model <name>",
		label: "Switch AI Model",
		description: "Quickly switch active model (e.g. \\model llama-3.3-70b-versatile)",
		category: "system",
		icon: Cpu,
		hasParams: true,
		tag: "Model",
	},
	{
		id: "sleep",
		trigger: "sleep",
		syntax: "\\sleep <minutes>",
		label: "Sleep Timer",
		description: "Automatically turn off playback after specified minutes",
		category: "automation",
		icon: Clock,
		hasParams: true,
		tag: "Timer",
	},
	{
		id: "remind",
		trigger: "remind",
		syntax: "\\remind <channel>",
		label: "Schedule Auto-Tune",
		description: "Schedule reminder to switch to a channel at a set time",
		category: "automation",
		icon: Calendar,
		hasParams: true,
		tag: "Schedule",
	},
	{
		id: "volume",
		trigger: "volume",
		syntax: "\\volume <0-100>",
		label: "Set Volume",
		description: "Adjust audio volume to a specific percentage",
		category: "playback",
		icon: Volume2,
		hasParams: true,
		tag: "Audio",
	},
	{
		id: "mute",
		trigger: "mute",
		syntax: "\\mute",
		label: "Toggle Mute",
		description: "Mute or unmute player audio",
		category: "playback",
		icon: VolumeX,
		hasParams: false,
		tag: "Audio",
	},
	{
		id: "category",
		trigger: "category",
		syntax: "\\category <name>",
		label: "Filter Category",
		description: "Filter channels by category (Sports, News, Movies, Kids, etc.)",
		category: "playback",
		icon: Folder,
		hasParams: true,
		tag: "Library",
	},
	{
		id: "vibe",
		trigger: "vibe",
		syntax: "\\vibe <mood>",
		label: "Mood & Vibe Match",
		description: "Suggest channels matching your mood (relax, action, laugh, comedy)",
		category: "tools",
		icon: Sparkles,
		hasParams: true,
		tag: "Emotion",
	},
	{
		id: "epg",
		trigger: "epg",
		syntax: "\\epg",
		label: "Live Program Guide",
		description: "Query what's on TV right now across major channels",
		category: "tools",
		icon: Tv,
		hasParams: false,
		tag: "Live Guide",
	},
	{
		id: "fullscreen",
		trigger: "fullscreen",
		syntax: "\\fullscreen",
		label: "Toggle Fullscreen",
		description: "Enter or exit cinema fullscreen playback mode",
		category: "system",
		icon: Maximize,
		hasParams: false,
		tag: "Display",
	},
	{
		id: "clear",
		trigger: "clear",
		syntax: "\\clear",
		label: "Clear Chat Memory",
		description: "Reset conversation history and start a fresh memory session",
		category: "system",
		icon: Trash2,
		hasParams: false,
		tag: "Memory",
	},
];

interface AiCommandPaletteProps {
	isOpen: boolean;
	filterQuery: string;
	selectedIndex: number;
	onSelect: (command: AiCommandItem) => void;
	onClose: () => void;
}

export const AiCommandPalette: React.FC<AiCommandPaletteProps> = ({
	isOpen,
	filterQuery,
	selectedIndex,
	onSelect,
	onClose,
}) => {
	const listRef = useRef<HTMLDivElement>(null);

	// Filter commands based on typed query after backslash or slash
	const cleanQuery = filterQuery.replace(/^[/\\+]/, "").trim().toLowerCase();
	const filtered = AI_SYSTEM_COMMANDS.filter((cmd) => {
		if (!cleanQuery) return true;
		return (
			cmd.trigger.toLowerCase().includes(cleanQuery) ||
			cmd.label.toLowerCase().includes(cleanQuery) ||
			cmd.syntax.toLowerCase().includes(cleanQuery) ||
			cmd.description.toLowerCase().includes(cleanQuery)
		);
	});

	// Auto-scroll selected item into view
	useEffect(() => {
		if (!listRef.current) return;
		const activeEl = listRef.current.querySelector(
			`[data-index="${selectedIndex}"]`,
		) as HTMLElement | null;
		if (activeEl) {
			activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [selectedIndex]);

	if (!isOpen || filtered.length === 0) return null;

	return (
		<div className="absolute bottom-[66px] left-3 right-3 z-30 max-h-72 rounded-2xl bg-[#090c1f]/95 border border-white/15 shadow-[0_-10px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 ring-1 ring-white/10">
			{/* Header bar */}
			<div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[10px] text-zinc-400 bg-white/[0.02]">
				<span className="flex items-center gap-1.5 font-bold text-purple-300">
					<Sparkles className="w-3 h-3 text-purple-400" />
					<span>AI System Commands & Tools</span>
				</span>
				<div className="flex items-center gap-2">
					<span className="font-mono text-[9px] text-zinc-400">
						Use ↑↓ to navigate • Enter/Tab to select
					</span>
					<button
						type="button"
						onClick={onClose}
						className="p-0.5 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer"
						title="Dismiss commands (Esc)"
					>
						<X className="w-3 h-3" />
					</button>
				</div>
			</div>

			{/* Scrollable command list */}
			<div
				ref={listRef}
				className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1 max-h-60 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent"
			>
				{filtered.map((cmd, idx) => {
					const isSelected = idx === selectedIndex;
					const Icon = cmd.icon;
					return (
						<button
							key={cmd.id}
							type="button"
							data-index={idx}
							onClick={() => onSelect(cmd)}
							className={`w-full px-2.5 py-1.5 rounded-xl text-left transition-all border flex items-center justify-between gap-3 cursor-pointer ${
								isSelected
									? "bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-purple-600/20 border-purple-500/60 text-white shadow-md ring-1 ring-purple-500/30"
									: "bg-white/[0.02] border-white/5 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
							}`}
						>
							<div className="flex items-center gap-2.5 min-w-0">
								<div
									className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
										isSelected
											? "bg-purple-500/30 text-purple-200"
											: "bg-white/5 text-zinc-400"
									}`}
								>
									<Icon className="w-3.5 h-3.5" />
								</div>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-[11px] font-mono font-bold text-cyan-300">
											{cmd.syntax}
										</span>
										<span className="text-[10px] font-semibold text-white">
											{cmd.label}
										</span>
									</div>
									<p className="text-[10px] text-zinc-400 truncate">
										{cmd.description}
									</p>
								</div>
							</div>

							{cmd.tag && (
								<span
									className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
										isSelected
											? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
											: "bg-white/5 text-zinc-400 border border-white/10"
									}`}
								>
									{cmd.tag}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
};
