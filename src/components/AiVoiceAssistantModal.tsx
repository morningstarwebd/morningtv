import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	Bot,
	Cpu,
	Globe,
	Image as ImageIcon,
	Mic,
	MicOff,
	Send,
	Sparkles,
	Tv,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";

interface ChatMessage {
	id: string;
	sender: "user" | "ai";
	text: string;
	actionFeedback?: string;
	timestamp: string;
}

interface AiVoiceResponse {
	reply: string;
	action?: string;
	param?: string;
}

const AVATAR_PRESETS = [
	{
		id: "nova" as const,
		name: "Nova (Cosmic Orb)",
		gradient: "from-purple-500 via-indigo-500 to-pink-500",
		shadow: "rgba(168,85,247,0.5)",
		accent: "#a855f7",
		icon: Sparkles,
	},
	{
		id: "jarvis" as const,
		name: "Jarvis (Cyber AI)",
		gradient: "from-cyan-500 via-blue-500 to-emerald-400",
		shadow: "rgba(6,182,212,0.5)",
		accent: "#06b6d4",
		icon: Cpu,
	},
	{
		id: "astra" as const,
		name: "Astra (Nebula)",
		gradient: "from-pink-500 via-rose-500 to-amber-400",
		shadow: "rgba(244,63,94,0.5)",
		accent: "#f43f5e",
		icon: Bot,
	},
	{
		id: "retro" as const,
		name: "Retro (Holo TV)",
		gradient: "from-emerald-500 via-teal-500 to-cyan-500",
		shadow: "rgba(16,185,129,0.5)",
		accent: "#10b981",
		icon: Tv,
	},
];

type VoiceLanguage = "en-US" | "bn-IN" | "hi-IN";

export const AiVoiceAssistantModal: React.FC = () => {
	const {
		isAiAssistantOpen,
		closeAiAssistant,
		aiAvatarPreset,
		aiCustomAvatarUrl,
		setAiAvatarPreset,
		setAiCustomAvatarUrl,
		executeAiAction,
		activeChannel,
		volume,
		settings,
	} = useAppStore();

	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			id: "welcome",
			sender: "ai",
			text: "Hello! I am your MorningTV AI Co-Pilot. You can speak or type to switch channels, adjust volume, or search & heal expired streams from the internet.",
			timestamp: new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			}),
		},
	]);

	const [inputText, setInputText] = useState("");
	const [isListening, setIsListening] = useState(false);
	const [isThinking, setIsThinking] = useState(false);
	const [transcript, setTranscript] = useState("");
	const [selectedLang, setSelectedLang] = useState<VoiceLanguage>("en-US");
	const [isSpeechSupported, setIsSpeechSupported] = useState(true);
	const [speechErrorMessage, setSpeechErrorMessage] = useState<string | null>(
		null,
	);
	const [showAvatarSelector, setShowAvatarSelector] = useState(false);
	const [customUrlInput, setCustomUrlInput] = useState(aiCustomAvatarUrl);

	const recognitionRef = useRef<any>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, transcript]);

	// Initialize Web Speech API for voice recognition
	useEffect(() => {
		const SpeechRecognition =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;

		if (!SpeechRecognition) {
			setIsSpeechSupported(false);
			return;
		}

		try {
			const recognition = new SpeechRecognition();
			recognition.continuous = false;
			recognition.interimResults = true;
			recognition.lang = selectedLang;

			recognition.onstart = () => {
				setIsListening(true);
				setSpeechErrorMessage(null);
				setTranscript("");
			};

			recognition.onresult = (event: any) => {
				let current = "";
				for (let i = event.resultIndex; i < event.results.length; ++i) {
					current += event.results[i][0].transcript;
				}
				setTranscript(current);
			};

			recognition.onerror = (e: any) => {
				setIsListening(false);
				if (e.error === "not-allowed" || e.error === "service-not-allowed") {
					setSpeechErrorMessage(
						"Microphone access is blocked. Please enable microphone permissions or chat using text below.",
					);
				} else if (e.error !== "no-speech") {
					setSpeechErrorMessage(
						`Voice input notice (${e.error}). You can chat using text below.`,
					);
				}
			};

			recognition.onend = () => {
				setIsListening(false);
			};

			recognitionRef.current = recognition;
		} catch {
			setIsSpeechSupported(false);
		}

		return () => {
			if (recognitionRef.current) {
				try {
					recognitionRef.current.abort();
				} catch {}
			}
		};
	}, [selectedLang]);

	// Send message handler
	const handleSendMessage = async (textToSend?: string) => {
		const raw = textToSend || transcript || inputText;
		const query = raw.trim();
		if (!query) return;

		setInputText("");
		setTranscript("");

		const userMsg: ChatMessage = {
			id: Date.now().toString(),
			sender: "user",
			text: query,
			timestamp: new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			}),
		};

		setMessages((prev) => [...prev, userMsg]);
		setIsThinking(true);

		try {
			const response = await invoke<AiVoiceResponse>("ai_voice_chat", {
				message: query,
			});

			let actionFeedback: string | undefined;
			if (response.action) {
				actionFeedback = await executeAiAction(response.action, response.param);
			}

			const aiMsg: ChatMessage = {
				id: (Date.now() + 1).toString(),
				sender: "ai",
				text: response.reply,
				actionFeedback,
				timestamp: new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
			};

			setMessages((prev) => [...prev, aiMsg]);
		} catch (err) {
			const errorMsg: ChatMessage = {
				id: (Date.now() + 1).toString(),
				sender: "ai",
				text: `Notice: ${err}`,
				timestamp: new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
			};
			setMessages((prev) => [...prev, errorMsg]);
		} finally {
			setIsThinking(false);
		}
	};

	// Toggle microphone
	const handleToggleMic = () => {
		if (!isSpeechSupported) {
			setSpeechErrorMessage(
				"Speech recognition is not supported in this runtime. Please type your message below.",
			);
			return;
		}

		if (isListening) {
			try {
				recognitionRef.current?.stop();
			} catch {}
			setIsListening(false);
			if (transcript.trim()) {
				handleSendMessage(transcript);
			}
		} else {
			setSpeechErrorMessage(null);
			try {
				recognitionRef.current?.start();
			} catch {
				try {
					recognitionRef.current?.stop();
					setTimeout(() => recognitionRef.current?.start(), 150);
				} catch {
					setSpeechErrorMessage(
						"Could not activate microphone. Please type below.",
					);
				}
			}
		}
	};

	// Auto-submit voice transcript after speech pause
	useEffect(() => {
		if (!isListening && transcript.trim()) {
			handleSendMessage(transcript);
		}
	}, [isListening, transcript]);

	// Escape key to close
	useEffect(() => {
		if (!isAiAssistantOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeAiAssistant();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isAiAssistantOpen, closeAiAssistant]);

	if (!isAiAssistantOpen) return null;

	const currentPreset =
		AVATAR_PRESETS.find((p) => p.id === aiAvatarPreset) || AVATAR_PRESETS[0];

	return (
		<div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200 select-none">
			{/* Backdrop click to close */}
			<div
				className="absolute inset-0"
				onClick={closeAiAssistant}
				aria-hidden="true"
			/>

			{/* Main Glassmorphic Modal Window */}
			<div className="relative w-full max-w-2xl h-[590px] max-h-[92vh] rounded-3xl bg-[#070914]/90 border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden backdrop-blur-2xl ring-1 ring-white/10">
				{/* Top Header */}
				<div className="px-5 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
					<div className="flex items-center gap-3">
						<div
							className={`w-8 h-8 rounded-full bg-gradient-to-tr ${currentPreset.gradient} p-0.5 shadow-md flex items-center justify-center`}
						>
							<Sparkles className="w-4 h-4 text-white" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h3 className="text-sm font-bold text-white tracking-wide">
									MorningTV AI Co-Pilot
								</h3>
								<span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
									{settings?.ai_provider || "Neural Engine"}
								</span>
							</div>
							<p className="text-[10px] text-zinc-400">
								{activeChannel
									? `Playing: ${activeChannel.name} • Volume: ${volume}%`
									: "Voice & Semantic Playback Control"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Language Selector Pill */}
						<div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-[10px] font-semibold text-zinc-400">
							<button
								type="button"
								onClick={() => setSelectedLang("en-US")}
								className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
									selectedLang === "en-US"
										? "bg-purple-600 text-white shadow-sm"
										: "hover:text-white"
								}`}
								title="English (US) default"
							>
								EN
							</button>
							<button
								type="button"
								onClick={() => setSelectedLang("bn-IN")}
								className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
									selectedLang === "bn-IN"
										? "bg-purple-600 text-white shadow-sm"
										: "hover:text-white"
								}`}
								title="বাংলা (ভারত)"
							>
								বাংলা
							</button>
							<button
								type="button"
								onClick={() => setSelectedLang("hi-IN")}
								className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
									selectedLang === "hi-IN"
										? "bg-purple-600 text-white shadow-sm"
										: "hover:text-white"
								}`}
								title="हिंदी"
							>
								हिंदी
							</button>
						</div>

						{/* Avatar Customizer Button */}
						<button
							type="button"
							onClick={() => setShowAvatarSelector(!showAvatarSelector)}
							className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
							title="Customize AI Persona & Avatar"
						>
							<ImageIcon className="w-3.5 h-3.5 text-purple-400" />
							<span className="text-[11px] font-medium hidden sm:inline">
								Avatar
							</span>
						</button>

						{/* Close Button */}
						<button
							type="button"
							onClick={closeAiAssistant}
							className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Avatar Selector Dropdown Modal */}
				{showAvatarSelector && (
					<div className="absolute top-14 left-4 right-4 z-50 p-4 rounded-2xl bg-zinc-950/95 border border-purple-500/30 shadow-2xl backdrop-blur-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold text-white">
								Select AI Persona & Avatar
							</span>
							<button
								type="button"
								onClick={() => setShowAvatarSelector(false)}
								className="text-zinc-400 hover:text-white cursor-pointer"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</div>

						{/* Preset Avatars */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
							{AVATAR_PRESETS.map((preset) => {
								const Icon = preset.icon;
								const isSelected =
									aiAvatarPreset === preset.id && !aiCustomAvatarUrl;
								return (
									<button
										key={preset.id}
										type="button"
										onClick={() => {
											setAiAvatarPreset(preset.id);
											setAiCustomAvatarUrl("");
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
											setAiAvatarPreset("custom");
											setAiCustomAvatarUrl(customUrlInput.trim());
											setShowAvatarSelector(false);
										}
									}}
									className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shrink-0"
								>
									Apply
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Animated Dynamic Web AI Centerpiece with Highly Animated SVGs */}
				<div className="shrink-0 py-3 flex flex-col items-center justify-center relative bg-gradient-to-b from-purple-950/20 via-transparent to-transparent border-b border-white/5">
					<div className="relative w-36 h-36 flex items-center justify-center select-none">
						{/* Ambient Glow Aura */}
						<div
							className={`absolute inset-2 rounded-full filter blur-xl transition-all duration-700 pointer-events-none ${
								isListening
									? "bg-cyan-500/40 scale-125 animate-pulse"
									: isThinking
										? "bg-purple-600/40 scale-115 animate-ping"
										: "bg-indigo-600/20 scale-100"
							}`}
						/>

						{/* Highly Animated Cybernetic Web3 SVG Canvas */}
						<svg
							className="w-full h-full pointer-events-none"
							viewBox="0 0 160 160"
						>
							{/* Outer Clockwise Rotating Orbital Ring */}
							<circle
								cx="80"
								cy="80"
								r="70"
								fill="none"
								stroke={
									isListening
										? "#22d3ee"
										: isThinking
											? "#c084fc"
											: "rgba(255,255,255,0.15)"
								}
								strokeWidth="1.5"
								strokeDasharray="5 7"
								className="animate-spin"
								style={{
									transformOrigin: "80px 80px",
									animationDuration: isListening ? "4s" : "18s",
								}}
							/>

							{/* Inner Counter-Rotating Tech Ring */}
							<circle
								cx="80"
								cy="80"
								r="58"
								fill="none"
								stroke={
									isListening
										? "rgba(34,211,238,0.6)"
										: isThinking
											? "rgba(192,132,252,0.6)"
											: "rgba(255,255,255,0.12)"
								}
								strokeWidth="1.5"
								strokeDasharray="12 16"
								className="animate-spin"
								style={{
									transformOrigin: "80px 80px",
									animationDuration: isListening ? "6s" : "24s",
									animationDirection: "reverse",
								}}
							/>

							{/* Responsive Ping Wave on Listening */}
							{isListening && (
								<circle
									cx="80"
									cy="80"
									r="48"
									fill="none"
									stroke="#38bdf8"
									strokeWidth="2"
									className="animate-ping opacity-60"
									style={{ transformOrigin: "80px 80px" }}
								/>
							)}

							{/* Orbiting Satellite Particles */}
							<circle
								cx="80"
								cy="10"
								r="2.5"
								fill={isListening ? "#22d3ee" : "#a855f7"}
								className="animate-spin"
								style={{
									transformOrigin: "80px 80px",
									animationDuration: "10s",
								}}
							/>
							<circle
								cx="80"
								cy="150"
								r="2"
								fill={isListening ? "#38bdf8" : "#ec4899"}
								className="animate-spin"
								style={{
									transformOrigin: "80px 80px",
									animationDuration: "14s",
									animationDirection: "reverse",
								}}
							/>
						</svg>

						{/* Center Profile Picture / Animated Avatar */}
						<div
							className={`absolute w-20 h-20 rounded-full p-1 bg-gradient-to-tr ${currentPreset.gradient} relative z-10 shadow-[0_0_25px_${currentPreset.shadow}] flex items-center justify-center overflow-hidden transition-all duration-300 ${
								isListening
									? "scale-105 ring-4 ring-cyan-400/60 shadow-[0_0_35px_rgba(34,211,238,0.7)]"
									: isThinking
										? "scale-105 ring-4 ring-purple-400/60 shadow-[0_0_35px_rgba(192,132,252,0.7)]"
										: "hover:scale-105"
							}`}
						>
							{aiCustomAvatarUrl ? (
								<img
									src={aiCustomAvatarUrl}
									alt="AI Profile"
									className="w-full h-full object-cover rounded-full"
									onError={() => setAiCustomAvatarUrl("")}
								/>
							) : (
								<div className="w-full h-full rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
									<currentPreset.icon className="w-9 h-9 text-white drop-shadow-md" />
								</div>
							)}
						</div>
					</div>

					{/* Responsive Audio Frequency Visualizer */}
					<div className="flex items-center gap-1 mt-2 h-3.5">
						{[
							{ id: "b1", h: 40 },
							{ id: "b2", h: 70 },
							{ id: "b3", h: 100 },
							{ id: "b4", h: 60 },
							{ id: "b5", h: 85 },
							{ id: "b6", h: 45 },
							{ id: "b7", h: 95 },
							{ id: "b8", h: 30 },
						].map((bar, i) => (
							<div
								key={bar.id}
								className={`w-1 rounded-full transition-all duration-150 ${
									isListening
										? "bg-cyan-400 animate-pulse"
										: isThinking
											? "bg-purple-400 animate-bounce"
											: "bg-white/20 h-1.5"
								}`}
								style={{
									height: isListening
										? `${bar.h}%`
										: isThinking
											? "65%"
											: "5px",
									animationDelay: `${i * 75}ms`,
								}}
							/>
						))}
					</div>

					<p className="text-[11px] font-medium text-zinc-400 mt-1">
						{isListening
							? "🎙️ Listening to voice..."
							: isThinking
								? "⚡ Processing request..."
								: "Tap microphone to speak or type in chat"}
					</p>

					{transcript && (
						<div className="mt-1 px-3 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300 font-medium max-w-[80%] truncate">
							"{transcript}"
						</div>
					)}
				</div>

				{/* Scrollable Conversation Stream */}
				<div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
					{messages.map((m) => (
						<div
							key={m.id}
							className={`flex flex-col ${
								m.sender === "user" ? "items-end" : "items-start"
							}`}
						>
							<div
								className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
									m.sender === "user"
										? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none shadow-md"
										: "bg-white/[0.06] border border-white/10 text-zinc-100 rounded-bl-none shadow-md"
								}`}
							>
								<p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
								{m.actionFeedback && (
									<div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold">
										<Zap className="w-3 h-3 text-emerald-400 shrink-0" />
										<span>{m.actionFeedback}</span>
									</div>
								)}
							</div>
							<span className="text-[9px] text-zinc-500 mt-1 px-1">
								{m.timestamp}
							</span>
						</div>
					))}
					<div ref={messagesEndRef} />
				</div>

				{/* Voice Fallback Notice Banner (shown if mic is unsupported or error occurs) */}
				{(!isSpeechSupported || speechErrorMessage) && (
					<div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 text-xs text-amber-300 shrink-0">
						<AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
						<span className="flex-1">
							{speechErrorMessage ||
								"Voice speech recognition is unavailable in this environment. You can interact freely using the chat input below."}
						</span>
					</div>
				)}

				{/* Quick Suggestions Chips (English & Regional support) */}
				<div className="px-4 py-1.5 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-white/5 bg-black/20">
					<button
						type="button"
						onClick={() => handleSendMessage("Play Zee Bangla")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						📺 Zee Bangla
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("Play Star Jalsha")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						📺 Star Jalsha
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("Set volume to 50%")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						🔊 Volume 50%
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("Mute audio")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						🔇 Mute
					</button>
					<button
						type="button"
						onClick={() =>
							handleSendMessage(
								`Hunt and heal stream for ${activeChannel?.name || "Zee Bangla"} from internet`,
							)
						}
						className="px-2.5 py-1 rounded-full bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-[10px] text-purple-300 whitespace-nowrap cursor-pointer transition-colors"
					>
						⚡ Hunt & Heal Stream
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("Show Sports channels")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						⚽ Sports
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("Show News channels")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						📰 News
					</button>
				</div>

				{/* Bottom Input & Voice Control Bar */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSendMessage();
					}}
					className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2.5 shrink-0"
				>
					{/* Glowing Microphone Button */}
					<button
						type="button"
						onClick={handleToggleMic}
						className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-lg ${
							isListening
								? "bg-cyan-500 text-white animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.6)]"
								: isSpeechSupported
									? "bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/10"
									: "bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed opacity-60"
						}`}
						title={
							isSpeechSupported
								? isListening
									? "Stop listening"
									: "Click to speak with voice"
								: "Voice recognition unsupported on this runtime; use text chat"
						}
					>
						{isListening ? (
							<MicOff className="w-5 h-5 text-white" />
						) : (
							<Mic className="w-5 h-5" />
						)}
					</button>

					{/* Text Input Field */}
					<input
						type="text"
						value={inputText}
						onChange={(e) => setInputText(e.target.value)}
						placeholder="Speak or type (e.g. Play Zee Bangla, Volume 40%, Hunt stream)..."
						className="flex-1 px-4 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
					/>

					{/* Send Button */}
					<button
						type="submit"
						disabled={!inputText.trim()}
						className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
					>
						<Send className="w-4 h-4" />
					</button>
				</form>
			</div>
		</div>
	);
};
