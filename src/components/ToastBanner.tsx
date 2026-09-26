// src/components/ToastBanner.tsx
// Modern floating toast alert notification for server switches, sound boost, and alerts

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type React from "react";
import { useAppStore } from "../stores/appStore";

export const ToastBanner: React.FC = () => {
	const { toast, hideToast } = useAppStore();

	if (!toast) return null;

	return (
		<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto select-none">
			<div
				className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-2xl ${
					toast.isError
						? "bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50"
						: "bg-[#0b0e18]/95 border-blue-500/30 text-white shadow-black/80"
				}`}
			>
				{toast.isError ? (
					<AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
				) : (
					<CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
				)}
				<span className="text-xs font-semibold tracking-wide">
					{toast.message}
				</span>
				<button
					onClick={hideToast}
					className="p-1 text-zinc-400 hover:text-white transition-opacity ml-1 cursor-pointer"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
};
