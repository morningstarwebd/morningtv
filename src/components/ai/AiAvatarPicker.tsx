// src/components/ai/AiAvatarPicker.tsx
// Avatar preset and custom profile picture selector modal

import { Globe, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

export interface AvatarPreset {
	id: string;
	name: string;
	gradient: string;
	shadow: string;
	accent: string;
	icon: React.ElementType;
}

interface AiAvatarPickerProps {
	isOpen: boolean;
	onClose: () => void;
	presets: AvatarPreset[];
	currentPresetId: string;
	customAvatarUrl: string;
	onSelectPreset: (presetId: string) => void;
	onApplyCustomUrl: (url: string) => void;
}

export const AiAvatarPicker: React.FC<AiAvatarPickerProps> = ({
	isOpen,
	onClose,
	presets,
	currentPresetId,
	customAvatarUrl,
	onSelectPreset,
	onApplyCustomUrl,
}) => {
	const [customUrlInput, setCustomUrlInput] = useState(customAvatarUrl);

	if (!isOpen) return null;

	return (
		<div className="absolute top-14 left-4 right-4 z-50 p-4 rounded-2xl bg-zinc-950/95 border border-purple-500/30 shadow-2xl backdrop-blur-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
			<div className="flex items-center justify-between">
				<span className="text-xs font-bold text-white">
					Select AI Persona & Avatar
				</span>
				<button
					type="button"
					onClick={onClose}
					className="text-zinc-400 hover:text-white cursor-pointer"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Preset Avatars */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
				{presets.map((preset) => {
					const Icon = preset.icon;
					const isSelected =
						currentPresetId === preset.id && !customAvatarUrl;
					return (
						<button
							key={preset.id}
							type="button"
							onClick={() => {
								onSelectPreset(preset.id);
								setCustomUrlInput("");
							}}
							className={`p-2.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
								isSelected
									? "bg-purple-500/20 border-purple-400 text-white shadow-lg"
									: "bg-white/[0.03] border-white/5 text-zinc-400 hover:border-white/20"
							}`}
						>
							<div
								className={`w-9 h-9 rounded-full bg-gradient-to-tr ${preset.gradient} flex items-center justify-center text-white shadow-md`}
							>
								<Icon className="w-4.5 h-4.5" />
							</div>
							<span className="text-[10px] font-medium text-center">
								{preset.name}
							</span>
						</button>
					);
				})}
			</div>

			{/* Custom Avatar URL option */}
			<div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
				<label
					htmlFor="custom-avatar-url"
					className="text-[11px] text-zinc-300 font-medium flex items-center gap-1.5"
				>
					<Globe className="w-3.5 h-3.5 text-cyan-400" />
					<span>Custom Image / Profile Picture URL:</span>
				</label>
				<div className="flex items-center gap-2">
					<input
						id="custom-avatar-url"
						type="url"
						value={customUrlInput}
						onChange={(e) => setCustomUrlInput(e.target.value)}
						placeholder="https://example.com/avatar.png"
						className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
					/>
					<button
						type="button"
						onClick={() => {
							if (customUrlInput.trim()) {
								onApplyCustomUrl(customUrlInput.trim());
							}
						}}
						className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shrink-0"
					>
						Apply
					</button>
				</div>
			</div>
		</div>
	);
};
