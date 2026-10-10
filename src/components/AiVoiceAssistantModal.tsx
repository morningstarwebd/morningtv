// src/components/AiVoiceAssistantModal.tsx
// Modular AI Voice Assistant Modal with ChatGPT / Gemini Harness Layout

import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	Bot,
	ChevronDown,
	Cpu,
	Image as ImageIcon,
	Mic,
	MicOff,
	Send,
	Sparkles,
	Trash2,
	Tv,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { AiModelItem } from "../types";
import { AiAvatarPicker, type AvatarPreset } from "./ai/AiAvatarPicker";
import { AiChatFeed, type ChatMessage } from "./ai/AiChatFeed";
import { AiModelPicker } from "./ai/AiModelPicker";
import { AiVoiceDock } from "./ai/AiVoiceDock";
import { AiWelcomeHero } from "./ai/AiWelcomeHero";

interface AiVoiceResponse {
	reply: string;
	action?: string;
	param?: string;
}

const AVATAR_PRESETS: AvatarPreset[] = [
	{
		id: "nova",
		name: "Nova (Cosmic Orb)",
		gradient: "from-purple-500 via-indigo-500 to-pink-500",
		shadow: "rgba(168,85,247,0.5)",
		accent: "#a855f7",
		icon: Sparkles,
	},
	{
		id: "jarvis",
		name: "Jarvis (Cyber AI)",
		gradient: "from-cyan-500 via-blue-500 to-emerald-400",
		shadow: "rgba(6,182,212,0.5)",
		accent: "#06b6d4",
		icon: Cpu,
	},
	{
		id: "astra",
		name: "Astra (Nebula)",
		gradient: "from-pink-500 via-rose-500 to-amber-400",
		shadow: "rgba(244,63,94,0.5)",
		accent: "#f43f5e",
		icon: Bot,
	},
	{
		id: "retro",
		name: "Retro (Holo TV)",
		gradient: "from-emerald-500 via-teal-500 to-cyan-500",
		shadow: "rgba(160,185,129,0.5)",
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
		fetchProviderModels,
		setActiveAiModel,
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
	const [showModelPicker, setShowModelPicker] = useState(false);
	const [quickModels, setQuickModels] = useState<AiModelItem[]>([]);
	const [isLoadingQuickModels, setIsLoadingQuickModels] = useState(false);

	const handleClearHistory = () => {
		setMessages([
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
	};

	const handleOpenModelPicker = async () => {
		const next = !showModelPicker;
		setShowModelPicker(next);
		if (showAvatarSelector) setShowAvatarSelector(false);
		if (next && quickModels.length === 0) {
			setIsLoadingQuickModels(true);
			try {
				const provider = settings?.ai_provider || "auto";
				const models = await fetchProviderModels(
					provider,
					settings?.ai_api_key || null,
					settings?.ai_endpoint || null,
				);
				setQuickModels(models);
			} finally {
				setIsLoadingQuickModels(false);
			}
		}
	};

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

		// Support both Slash (/) and Backslash (\) commands
		const isCommand = query.startsWith("/") || query.startsWith("\\");
		if (isCommand) {
			const parts = query.slice(1).trim().split(/\s+/);
			const cmd = parts[0]?.toLowerCase();
			const arg = parts.slice(1).join(" ").trim();

			if (cmd === "model") {
				if (!arg) {
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: `Active Model: ${settings?.ai_model || "Default"}\n\nTo change model, type: \\model <model-name> (or /model <model-name>)\nTo see all models from provider, type: \\models`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
					return;
				}

				setIsThinking(true);
				try {
					await setActiveAiModel(arg);
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: `🤖 Model successfully changed to: "${arg}"! Subsequent queries will route through this model.`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
				} catch (err) {
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: `Failed to set model: ${err}`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
				} finally {
					setIsThinking(false);
				}
				return;
			}

			if (cmd === "models") {
				setIsThinking(true);
				try {
					const provider = settings?.ai_provider || "auto";
					const models = await fetchProviderModels(
						provider,
						settings?.ai_api_key || null,
						settings?.ai_endpoint || null,
					);
					if (models.length === 0) {
						const aiMsg: ChatMessage = {
							id: (Date.now() + 1).toString(),
							sender: "ai",
							text: `No models returned from ${provider}. Make sure your API key is configured in Settings.`,
							timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						};
						setMessages((prev) => [...prev, aiMsg]);
					} else {
						const freeCount = models.filter((m) => m.is_free).length;
						const modelListStr = models
							.slice(0, 16)
							.map((m, i) => `${i + 1}. \`${m.id}\`${m.is_free ? " 🟢 [FREE]" : ""}`)
							.join("\n");

						const aiMsg: ChatMessage = {
							id: (Date.now() + 1).toString(),
							sender: "ai",
							text: `📡 Live Models for **${provider}** (${freeCount} Free Tier models available):\n\n${modelListStr}\n\n💡 Switch model anytime using: \`\\model <name>\` or \`/model <name>\``,
							timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						};
						setMessages((prev) => [...prev, aiMsg]);
					}
				} catch (err) {
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: `Failed to fetch models: ${err}`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
				} finally {
					setIsThinking(false);
				}
				return;
			}

			if (cmd === "heal" || cmd === "find" || cmd === "hunt") {
				if (!arg) {
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: "Please specify a channel name to recover, e.g.: `\\heal Zee Bangla HD`",
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
					return;
				}
				setIsThinking(true);
				try {
					const feedback = await executeAiAction("hunt_stream", arg);
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Searching internet for ${arg}...`,
						actionFeedback: feedback,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
				} finally {
					setIsThinking(false);
				}
				return;
			}

			if (cmd === "clear") {
				handleClearHistory();
				return;
			}

			if (cmd === "help") {
				const aiMsg: ChatMessage = {
					id: (Date.now() + 1).toString(),
					sender: "ai",
					text: "⚡ **Available Commands:**\n\n- `\\model <name>` or `/model <name>` : Switch the active AI model\n- `\\models` or `/models` : List available live free & standard models\n- `\\heal <channel>` or `/heal <channel>` : Hunt down working streams online and update the local database\n- `\\clear` or `/clear` : Clear conversation history",
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
				};
				setMessages((prev) => [...prev, aiMsg]);
				return;
			}
		}

		setIsThinking(true);

		try {
			// Multi-turn conversation history for LLM Brain context (up to last 10 turns)
			const historyPayload = messages
				.filter((m) => m.id !== "welcome")
				.slice(-10)
				.map((m) => ({
					role: m.sender === "user" ? "user" : "assistant",
					content: m.text,
				}));

			const response = await invoke<AiVoiceResponse>("ai_voice_chat", {
				message: query,
				history: historyPayload,
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
			<div className="relative w-full max-w-2xl h-[620px] max-h-[92vh] rounded-3xl bg-[#070914]/90 border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden backdrop-blur-2xl ring-1 ring-white/10">
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
								<button
									type="button"
									onClick={handleOpenModelPicker}
									className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
									title="Click to quickly switch AI model"
								>
									<span className="max-w-[130px] truncate">
										{settings?.ai_model || "Select Model"}
									</span>
									<ChevronDown className={`w-3 h-3 transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
								</button>
							</div>
							<p className="text-[10px] text-zinc-400">
								{activeChannel
									? `Playing: ${activeChannel.name} • Volume: ${volume}%`
									: "Voice & Semantic Playback Control"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Clear Chat History (Reset Memory) */}
						<button
							type="button"
							onClick={handleClearHistory}
							className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 transition-colors cursor-pointer"
							title="Clear conversation history (Reset Memory)"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</button>

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
								title="English (US)"
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
								title="Bengali (India)"
							>
								BN
							</button>
							<button
								type="button"
								onClick={() => setSelectedLang("hi-IN")}
								className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
									selectedLang === "hi-IN"
										? "bg-purple-600 text-white shadow-sm"
										: "hover:text-white"
								}`}
								title="Hindi (India)"
							>
								HI
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

				{/* Quick Model Selector Dropdown Modal */}
				<AiModelPicker
					isOpen={showModelPicker}
					onClose={() => setShowModelPicker(false)}
					quickModels={quickModels}
					isLoading={isLoadingQuickModels}
					activeModel={settings?.ai_model || undefined}
					provider={settings?.ai_provider || undefined}
					onSelectModel={async (modelId) => {
						await setActiveAiModel(modelId);
						setShowModelPicker(false);
						setMessages((prev) => [
							...prev,
							{
								id: Date.now().toString(),
								sender: "ai",
								text: `🤖 Model switched to "${modelId}"!`,
								timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
							},
						]);
					}}
				/>

				{/* Avatar Selector Dropdown Modal */}
				<AiAvatarPicker
					isOpen={showAvatarSelector}
					onClose={() => setShowAvatarSelector(false)}
					presets={AVATAR_PRESETS}
					currentPresetId={aiAvatarPreset}
					customAvatarUrl={aiCustomAvatarUrl}
					onSelectPreset={(presetId) => {
						setAiAvatarPreset(presetId as any);
						setAiCustomAvatarUrl("");
					}}
					onApplyCustomUrl={(url) => {
						setAiAvatarPreset("custom" as any);
						setAiCustomAvatarUrl(url);
						setShowAvatarSelector(false);
					}}
				/>

				{/* Main Body Content: Gemini / ChatGPT Style Layout */}
				<div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
					{messages.length <= 1 ? (
						<AiWelcomeHero
							currentPreset={currentPreset}
							aiCustomAvatarUrl={aiCustomAvatarUrl}
							onSendMessage={handleSendMessage}
						/>
					) : (
						<AiChatFeed
							messages={messages}
							isThinking={isThinking}
							currentPreset={currentPreset}
							aiCustomAvatarUrl={aiCustomAvatarUrl}
							messagesEndRef={messagesEndRef}
						/>
					)}
				</div>

				{/* Floating Soundwave Dock Banner when Voice is Active */}
				<AiVoiceDock
					isListening={isListening}
					transcript={transcript}
				/>

				{/* Voice Fallback Notice Banner */}
				{(!isSpeechSupported || speechErrorMessage) && (
					<div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 text-xs text-amber-300 shrink-0">
						<AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
						<span className="flex-1">
							{speechErrorMessage ||
								"Voice speech recognition is unavailable in this environment. You can interact freely using the chat input below."}
						</span>
					</div>
				)}

				{/* Quick Suggestions Chips */}
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
						onClick={() => handleSendMessage("Play Hungama")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						🧸 Hungama
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
						⚡ Hunt Stream
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("\\models")}
						className="px-2.5 py-1 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono whitespace-nowrap cursor-pointer transition-colors"
						title="List available AI models"
					>
						\models
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("\\heal Zee Bangla HD")}
						className="px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono whitespace-nowrap cursor-pointer transition-colors"
						title="Recover lost Zee Bangla HD stream from internet into database"
					>
						\heal Zee Bangla HD
					</button>
					<button
						type="button"
						onClick={() => handleSendMessage("Show Sports channels")}
						className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-zinc-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
					>
						⚽ Sports
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
						placeholder="Type message, mood, or command (\model <name>, \models, \heal <ch>)..."
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
