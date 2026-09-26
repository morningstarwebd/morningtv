// src/components/ShortcutsModal.tsx
// Keyboard shortcuts reference modal

import { Keyboard, X } from "lucide-react";
import type React from "react";
import { useAppStore } from "../stores/appStore";

export const ShortcutsModal: React.FC = () => {
	const { isShortcutsOpen, closeShortcuts } = useAppStore();

	if (!isShortcutsOpen) return null;

	const shortcuts = [
		{ key: "Space / K", desc: "Play / Pause stream" },
		{ key: "F", desc: "Toggle Fullscreen Mode" },
		{ key: "M", desc: "Mute / Unmute audio" },
		{ key: "B", desc: "Cycle Sound Boost (100% / 150% / 200% / 300%)" },
		{ key: "Up / Down", desc: "Volume Increase / Decrease" },
		{ key: "T", desc: "Toggle Theater Mode" },
		{ key: "P", desc: "Picture-in-Picture (Floating player)" },
		{ key: "1 - 4", desc: "Switch live fallback server" },
		{ key: "?", desc: "Open / Close this shortcuts guide" },
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
			<div className="w-full max-w-md bg-[#0b0e18] border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/80">
				<div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
							<Keyboard className="w-4 h-4" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-white tracking-wide">
								Keyboard Shortcuts
							</h3>
							<p className="text-[11px] text-zinc-400">
								Desktop Pro Navigation Controls
							</p>
						</div>
					</div>
					<button
						onClick={closeShortcuts}
						className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="space-y-2.5">
					{shortcuts.map((s) => (
						<div
							key={s.key}
							className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5"
						>
							<span className="text-xs text-zinc-300 font-medium">
								{s.desc}
							</span>
							<kbd className="px-2.5 py-1 text-[11px] font-mono font-bold bg-white/10 text-white border border-white/15 rounded-lg shadow-sm">
								{s.key}
							</kbd>
						</div>
					))}
				</div>

				<div className="mt-6 pt-3 border-t border-white/10 text-center">
					<button
						onClick={closeShortcuts}
						className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
					>
						Got it
					</button>
				</div>
			</div>
		</div>
	);
};
