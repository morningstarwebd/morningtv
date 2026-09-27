import { RefreshCw, X, Zap } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { updaterService, type UpdateInfo } from "../services/updaterService";
import { MorningTVLogo } from "./MorningTVLogo";

interface UpdateModalProps {
	isOpen: boolean;
	updateInfo: UpdateInfo | null;
	onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
	isOpen,
	updateInfo,
	onClose,
}) => {
	const [isUpdating, setIsUpdating] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);

	if (!isOpen || !updateInfo) return null;

	const handleInstall = async () => {
		setIsUpdating(true);
		setError(null);
		setProgress(0);

		try {
			await updaterService.downloadAndInstall((pct) => {
				setProgress(pct);
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg);
			setIsUpdating(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm select-none p-4 animate-in fade-in duration-200">
			<div
				className="w-full max-w-lg bg-[#060814]/75 border border-white/20 rounded-3xl p-5 shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col gap-4 relative backdrop-blur-2xl ring-1 ring-white/15 overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-white/10 pb-3">
					<div className="flex items-center gap-2.5">
						<MorningTVLogo className="w-8 h-8" glow={true} />
						<div>
							<h2 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
								MorningTV Update
								<span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-black font-mono">
									v{updateInfo.version}
								</span>
							</h2>
							<p className="text-[11px] text-zinc-300">
								A new verified version is ready to install
							</p>
						</div>
					</div>
					{!isUpdating && (
						<button
							onClick={onClose}
							className="p-1 rounded-full text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
						>
							<X className="w-4 h-4" />
						</button>
					)}
				</div>

				{/* Release Notes */}
				<div className="flex flex-col gap-1.5">
					<span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
						What's New in this release:
					</span>
					<div className="max-h-40 overflow-y-auto scrollbar-none p-3 bg-black/40 border border-white/10 rounded-2xl text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
						{updateInfo.body || "Performance improvements, updated live stream mirrors, and stability fixes."}
					</div>
				</div>

				{/* Progress Bar (when downloading) */}
				{isUpdating && (
					<div className="flex flex-col gap-2 p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-2xl">
						<div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
							<span className="flex items-center gap-2">
								<RefreshCw className="w-3.5 h-3.5 animate-spin" />
								Downloading & verifying package...
							</span>
							<span className="font-mono">{progress}%</span>
						</div>
						<div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
							<div
								className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				)}

				{/* Error Box */}
				{error && (
					<div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300">
						<strong>Update failed:</strong> {error}
					</div>
				)}

				{/* Action Buttons */}
				<div className="flex items-center justify-between pt-2 border-t border-white/10">
					<span className="text-[10px] text-zinc-400 font-mono">
						Ed25519 Verified Package
					</span>
					<div className="flex items-center gap-2">
						{!isUpdating && (
							<button
								onClick={onClose}
								className="px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
							>
								Remind Me Later
							</button>
						)}
						<button
							onClick={handleInstall}
							disabled={isUpdating}
							className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
						>
							{isUpdating ? (
								<>
									<RefreshCw className="w-3.5 h-3.5 animate-spin" />
									Installing...
								</>
							) : (
								<>
									<Zap className="w-3.5 h-3.5" />
									Update & Restart
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
