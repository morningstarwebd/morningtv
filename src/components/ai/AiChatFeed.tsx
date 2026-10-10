// src/components/ai/AiChatFeed.tsx
// Full-height scrollable conversation feed with modern avatar & action badge styling

import { Zap } from "lucide-react";
import type React from "react";

export interface ChatMessage {
	id: string;
	sender: "user" | "ai";
	text: string;
	actionFeedback?: string;
	timestamp: string;
}

interface AiChatFeedProps {
	messages: ChatMessage[];
	isThinking: boolean;
	currentPreset: {
		gradient: string;
		icon: React.ElementType;
	};
	aiCustomAvatarUrl: string;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const AiChatFeed: React.FC<AiChatFeedProps> = ({
	messages,
	isThinking,
	currentPreset,
	aiCustomAvatarUrl,
	messagesEndRef,
}) => {
	const Icon = currentPreset.icon;

	return (
		<div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
			{messages.map((m) => {
				if (m.sender === "user") {
					return (
						<div key={m.id} className="flex flex-col items-end">
							<div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md">
								<p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
							</div>
							<span className="text-[9px] text-zinc-500 mt-1 px-1">
								{m.timestamp}
							</span>
						</div>
					);
				}

				return (
					<div key={m.id} className="flex items-start gap-3">
						<div
							className={`w-7 h-7 rounded-full bg-gradient-to-tr ${currentPreset.gradient} p-0.5 shrink-0 shadow-md flex items-center justify-center mt-0.5`}
						>
							{aiCustomAvatarUrl ? (
								<img
									src={aiCustomAvatarUrl}
									alt="AI"
									className="w-full h-full object-cover rounded-full"
								/>
							) : (
								<div className="w-full h-full rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
									<Icon className="w-3.5 h-3.5 text-white" />
								</div>
							)}
						</div>
						<div className="flex flex-col items-start max-w-[85%]">
							<div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.06] border border-white/10 text-zinc-100 text-xs shadow-md">
								<p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
								{m.actionFeedback && (
									<div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold">
										<Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
										<span>{m.actionFeedback}</span>
									</div>
								)}
							</div>
							<span className="text-[9px] text-zinc-500 mt-1 px-1">
								{m.timestamp}
							</span>
						</div>
					</div>
				);
			})}

			{isThinking && (
				<div className="flex items-start gap-3">
					<div
						className={`w-7 h-7 rounded-full bg-gradient-to-tr ${currentPreset.gradient} p-0.5 shrink-0 shadow-md flex items-center justify-center mt-0.5`}
					>
						<div className="w-full h-full rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
							<Icon className="w-3.5 h-3.5 text-white animate-spin" />
						</div>
					</div>
					<div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.06] border border-white/10 flex items-center gap-2 shadow-md">
						<div
							className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
							style={{ animationDelay: "0ms" }}
						/>
						<div
							className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
							style={{ animationDelay: "150ms" }}
						/>
						<div
							className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
							style={{ animationDelay: "300ms" }}
						/>
						<span className="text-[11px] text-zinc-400 ml-1">
							Copilot is thinking...
						</span>
					</div>
				</div>
			)}

			<div ref={messagesEndRef as any} />
		</div>
	);
};
