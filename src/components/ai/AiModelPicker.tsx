// src/components/ai/AiModelPicker.tsx
// Live quick model selector dropdown modal

import { Check, Sparkles, X } from "lucide-react";
import type React from "react";
import type { AiModelItem } from "../../types";

interface AiModelPickerProps {
	isOpen: boolean;
	onClose: () => void;
	quickModels: AiModelItem[];
	isLoading: boolean;
	activeModel?: string;
	provider?: string;
	onSelectModel: (modelId: string) => Promise<void>;
}

export const AiModelPicker: React.FC<AiModelPickerProps> = ({
	isOpen,
	onClose,
	quickModels,
	isLoading,
	activeModel,
	provider,
	onSelectModel,
}) => {
	if (!isOpen) return null;

	return (
		<div className="absolute top-14 left-4 right-4 z-50 p-4 rounded-2xl bg-zinc-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Sparkles className="w-4 h-4 text-cyan-400" />
					<span className="text-xs font-bold text-white">
						Quick Switch Active Model ({provider || "Provider"})
					</span>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-zinc-400 hover:text-white cursor-pointer"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{isLoading ? (
				<div className="p-5 flex items-center justify-center gap-2.5 text-xs text-zinc-300">
					<div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
					<span>Fetching live models from {provider || "provider"}...</span>
				</div>
			) : quickModels.length === 0 ? (
				<div className="p-4 text-center text-xs text-zinc-400">
					No models found. Please configure API key in Settings or type{" "}
					<code className="text-cyan-300 font-mono">\models</code>.
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
					{quickModels.map((m) => {
						const isActive = activeModel === m.id;
						return (
							<button
								key={m.id}
								type="button"
								onClick={() => onSelectModel(m.id)}
								className={`p-2.5 rounded-xl text-left border flex items-center justify-between gap-2 transition-all cursor-pointer ${
									isActive
										? "bg-cyan-500/25 border-cyan-400 text-white shadow-md ring-1 ring-cyan-500/40"
										: "bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-white/[0.08]"
								}`}
							>
								<div className="flex items-center gap-1.5 min-w-0">
									{isActive && (
										<Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
									)}
									<span
										className={`text-[11px] font-mono truncate ${
											isActive ? "font-bold text-white" : ""
										}`}
									>
										{m.id}
									</span>
								</div>
								{m.is_free && (
									<span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 shrink-0">
										FREE
									</span>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
};
