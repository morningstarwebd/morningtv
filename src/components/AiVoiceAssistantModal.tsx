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
import type { AiModelItem, StreamHealResult } from "../types";
import { AiAvatarPicker, type AvatarPreset } from "./ai/AiAvatarPicker";
import { AiChatFeed, type ChatMessage } from "./ai/AiChatFeed";
import {
	AI_SYSTEM_COMMANDS,
	type AiCommandItem,
	AiCommandPalette,
} from "./ai/AiCommandPalette";
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

const CHAT_MEMORY_KEY = "morningtv_ai_chat_memory_v2";

const getInitialMessages = (): ChatMessage[] => {
	try {
		if (typeof window !== "undefined" && window.localStorage) {
			const raw = localStorage.getItem(CHAT_MEMORY_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed;
				}
			}
		}
	} catch (e) {
		console.warn("Failed to load saved chat memory:", e);
	}
	return [
		{
			id: "welcome",
			sender: "ai",
			text: "Hello! I am your MorningTV AI Co-Pilot. You can speak or type to switch channels, adjust volume, or search & heal expired streams from the internet.",
			timestamp: new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			}),
		},
	];
};

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
		showToast,
	} = useAppStore();

	const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
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
	const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

	const inputRef = useRef<HTMLInputElement>(null);

	// Persist conversation history to local storage (up to last 100 messages)
	useEffect(() => {
		try {
			if (typeof window !== "undefined" && window.localStorage) {
				localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(messages.slice(-100)));
			}
		} catch (e) {
			console.warn("Failed to save chat memory:", e);
		}
	}, [messages]);

	const handleClearHistory = () => {
		try {
			if (typeof window !== "undefined" && window.localStorage) {
				localStorage.removeItem(CHAT_MEMORY_KEY);
			}
		} catch {}
		setMessages([
			{
				id: "welcome",
				sender: "ai",
				text: "🧹 Conversation memory cleared! What would you like to watch or do?",
				timestamp: new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
			},
		]);
		showToast("🧹 Chat memory cleared", false);
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

	// Command Palette Trigger & Filtering for backslash (\) and slash (/)
	const isCommandTrigger = inputText.startsWith("\\") || inputText.startsWith("/");
	const cleanCommandQuery = inputText.replace(/^[/\\+]/, "").trim().toLowerCase();

	const filteredCommands = AI_SYSTEM_COMMANDS.filter((cmd) => {
		if (!cleanCommandQuery) return true;
		return (
			cmd.trigger.toLowerCase().includes(cleanCommandQuery) ||
			cmd.label.toLowerCase().includes(cleanCommandQuery) ||
			cmd.syntax.toLowerCase().includes(cleanCommandQuery) ||
			cmd.description.toLowerCase().includes(cleanCommandQuery)
		);
	});

	useEffect(() => {
		setSelectedCommandIndex(0);
	}, [cleanCommandQuery]);

	const handleSelectCommand = (cmd: AiCommandItem) => {
		const triggerChar = inputText.startsWith("/") ? "/" : "\\";
		if (cmd.hasParams) {
			setInputText(`${triggerChar}${cmd.trigger} `);
			setTimeout(() => inputRef.current?.focus(), 40);
		} else {
			setInputText("");
			if (cmd.trigger === "clear") {
				handleClearHistory();
			} else if (cmd.trigger === "models") {
				handleOpenModelPicker();
			} else {
				handleSendMessage(`${triggerChar}${cmd.trigger}`);
			}
		}
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (isCommandTrigger && filteredCommands.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
				return;
			}
			if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
				if (!inputText.includes(" ") && filteredCommands[selectedCommandIndex]) {
					e.preventDefault();
					handleSelectCommand(filteredCommands[selectedCommandIndex]);
					return;
				}
			}
			if (e.key === "Escape") {
				setInputText("");
				return;
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

			if (cmd === "heal" || cmd === "find" || cmd === "hunt" || cmd === "add") {
				if (!arg) {
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: "Please specify a channel name, e.g.: `\\hunt Zee Bangla HD` or `\\add Hungama`",
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
					return;
				}
				setIsThinking(true);
				try {
					const feedback = await executeAiAction("hunt_stream", arg);
					const isSuccess = feedback?.startsWith("⚡") || feedback?.startsWith("✅");
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Searching internet for ${arg}...`,
						actionFeedback: isSuccess ? "Stream Active & Playing" : undefined,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
				} finally {
					setIsThinking(false);
				}
				return;
			}

			if (cmd === "addstream" || cmd === "addchannel") {
				if (!arg) {
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: "Please provide stream URL and channel name, e.g.: `\\addstream https://example.com/live.m3u8 for Pogo`",
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					};
					setMessages((prev) => [...prev, aiMsg]);
					return;
				}
				setIsThinking(true);
				try {
					let name = "Custom Channel";
					let url = arg;
					if (arg.includes(" for ")) {
						const parts = arg.split(" for ");
						url = parts[0].trim();
						name = parts[1].trim();
					} else if (arg.includes(" ")) {
						const parts = arg.split(" ");
						if (parts[0].startsWith("http")) {
							url = parts[0];
							name = parts.slice(1).join(" ");
						} else {
							name = parts[0];
							url = parts.slice(1).join(" ");
						}
					}
					const feedback = await executeAiAction("add_channel", `${name}|${url}`);
					const aiMsg: ChatMessage = {
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Adding stream for ${name}...`,
						actionFeedback: feedback?.startsWith("✅") ? "Added & Playing" : undefined,
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

			if (cmd === "tools" || cmd === "capabilities" || cmd === "help") {
				const aiMsg: ChatMessage = {
					id: (Date.now() + 1).toString(),
					sender: "ai",
					text: "🛠️ **MorningTV Autonomous AI Powers & Available Tools:**\n\n" +
						"- `\\play <channel>` — Tune into any live channel (e.g. `\\play Zee Bangla HD`)\n" +
						"- `\\hunt <channel>` — Autonomous stream hunter: Finds internet mirrors & saves to SQLite\n" +
						"- `\\doctor <channel>` — Stream Doctor diagnostics: Verifies stream health & mirrors\n" +
						"- `\\volume <0-100>` — Set audio volume level\n" +
						"- `\\mute` — Toggle audio mute\n" +
						"- `\\sleep <mins>` — Set sleep timer to automatically turn off playback\n" +
						"- `\\remind <channel>` — Schedule auto-tune channel switch\n" +
						"- `\\category <name>` — Filter library by category\n" +
						"- `\\vibe <mood>` — Recommend channels matching your mood\n" +
						"- `\\epg` — Query live TV schedule\n" +
						"- `\\fullscreen` — Toggle cinema fullscreen mode\n" +
						"- `\\model <name>` / `\\models` — Switch or browse live AI models\n" +
						"- `\\clear` — Reset conversation memory",
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
				};
				setMessages((prev) => [...prev, aiMsg]);
				return;
			}

			if (cmd === "play") {
				if (!arg) {
					setMessages((prev) => [
						...prev,
						{
							id: (Date.now() + 1).toString(),
							sender: "ai",
							text: "Please specify a channel name, e.g.: `\\play Zee Bangla HD` or `\\play Hungama`",
							timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						},
					]);
					return;
				}
				const feedback = await executeAiAction("play_channel", arg);
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Tuning into "${arg}"...`,
						actionFeedback: feedback,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
				return;
			}

			if (cmd === "doctor") {
				const target = arg || activeChannel?.name || "Zee Bangla HD";
				setIsThinking(true);
				try {
					const res = await invoke<StreamHealResult>("ai_diagnose_stream", {
						channelName: target,
					});
					const text = `🩺 **Stream Doctor Report for "${res.channel_name}":**\n\n` +
						`- Status: ${res.healed ? "✅ Healed & Saved to DB" : res.requires_user_confirmation ? "🟡 Candidate Found (Confirmation Required)" : "ℹ️ Diagnostic Complete"}\n` +
						`- Result: ${res.message}\n` +
						(res.new_url ? `- Working Stream URL: \`${res.new_url}\`` : "");
					setMessages((prev) => [
						...prev,
						{
							id: (Date.now() + 1).toString(),
							sender: "ai",
							text,
							actionFeedback: res.message,
							timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						},
					]);
				} catch (err) {
					setMessages((prev) => [
						...prev,
						{
							id: (Date.now() + 1).toString(),
							sender: "ai",
							text: `Stream Doctor check failed: ${err}`,
							timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						},
					]);
				} finally {
					setIsThinking(false);
				}
				return;
			}

			if (cmd === "volume") {
				const feedback = await executeAiAction("set_volume", arg);
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Volume set to ${arg}%`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
				return;
			}

			if (cmd === "mute") {
				const feedback = await executeAiAction("toggle_mute");
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || "Mute toggled",
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
				return;
			}

			if (cmd === "sleep") {
				const feedback = await executeAiAction("sleep_timer", arg || "30");
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Sleep timer set for ${arg || 30} minutes`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
				return;
			}

			if (cmd === "remind") {
				const feedback = await executeAiAction("schedule_channel", arg);
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Auto-tune scheduled for ${arg}`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
				return;
			}

			if (cmd === "category") {
				const feedback = await executeAiAction("set_category", arg);
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || `Category filtered to "${arg}"`,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
				return;
			}

			if (cmd === "fullscreen") {
				const feedback = await executeAiAction("toggle_fullscreen");
				setMessages((prev) => [
					...prev,
					{
						id: (Date.now() + 1).toString(),
						sender: "ai",
						text: feedback || "Fullscreen toggled",
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					},
				]);
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
			let mainReply = response.reply;
			if (response.action) {
				actionFeedback = await executeAiAction(response.action, response.param);
				if (actionFeedback) {
					if (response.action === "hunt_stream") {
						mainReply = actionFeedback;
						actionFeedback = actionFeedback.startsWith("⚡") ? "Stream Verified" : undefined;
					} else if (response.action === "add_channel") {
						mainReply = actionFeedback;
						actionFeedback = "Added & Playing";
					}
				}
			}

			const aiMsg: ChatMessage = {
				id: (Date.now() + 1).toString(),
				sender: "ai",
				text: mainReply,
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
				<div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02] gap-2.5">
					{/* Left: Avatar & Title info */}
					<div className="flex items-center gap-2.5 min-w-0">
						{/* Avatar Circle with live status indicator */}
						<div className="relative shrink-0">
							{aiCustomAvatarUrl ? (
								<img
									src={aiCustomAvatarUrl}
									alt="AI Avatar"
									className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/50 shadow-md"
								/>
							) : (
								<div
									className={`w-8 h-8 rounded-full bg-gradient-to-tr ${currentPreset.gradient} p-0.5 shadow-md flex items-center justify-center`}
								>
									<Sparkles className="w-4 h-4 text-white" />
								</div>
							)}
							<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#070914] shadow-sm" />
						</div>

						<div className="min-w-0">
							<div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
								<h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
									MorningTV AI
								</h3>
								<button
									type="button"
									onClick={handleOpenModelPicker}
									className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
									title="Click to quickly switch AI model"
								>
									<span className="max-w-[110px] sm:max-w-[140px] truncate">
										{settings?.ai_model || "Select Model"}
									</span>
									<ChevronDown className={`w-2.5 h-2.5 transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
								</button>
							</div>
							<p className="text-[10px] text-zinc-400 truncate mt-0.5">
								{activeChannel
									? `Playing: ${activeChannel.name} • ${volume}%`
									: `Memory Active • ${messages.length > 1 ? `${messages.length - 1} turns` : "Ready"}`}
							</p>
						</div>
					</div>

					{/* Right Controls: Language, Avatar, Clear Memory, Close */}
					<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
						{/* Language Selector Pill */}
						<div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-[9px] font-semibold text-zinc-400">
							<button
								type="button"
								onClick={() => setSelectedLang("en-US")}
								className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
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
								className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
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
								className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
									selectedLang === "hi-IN"
										? "bg-purple-600 text-white shadow-sm"
										: "hover:text-white"
								}`}
								title="Hindi (India)"
							>
								HI
							</button>
						</div>

						{/* Customize Avatar Button */}
						<button
							type="button"
							onClick={() => setShowAvatarSelector(!showAvatarSelector)}
							className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center gap-1 ${
								showAvatarSelector
									? "bg-purple-600/30 text-purple-200 border-purple-500/50"
									: "bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10"
							}`}
							title="Customize AI Avatar & Persona"
						>
							<ImageIcon className="w-3.5 h-3.5 text-purple-400" />
						</button>

						{/* Clear Chat Memory Button */}
						<button
							type="button"
							onClick={handleClearHistory}
							className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 transition-colors cursor-pointer"
							title="Clear Chat Memory & Reset"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</button>

						{/* Close Button */}
						<button
							type="button"
							onClick={closeAiAssistant}
							className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer ml-0.5"
							title="Close (Esc)"
						>
							<X className="w-3.5 h-3.5" />
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

				{/* Rich Autocomplete Floating Command Palette for Backslash and Slash */}
				<AiCommandPalette
					isOpen={isCommandTrigger}
					filterQuery={inputText}
					selectedIndex={selectedCommandIndex}
					onSelect={handleSelectCommand}
					onClose={() => setInputText("")}
				/>

				{/* Bottom Input & Voice Control Bar */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSendMessage();
					}}
					className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2.5 shrink-0 relative"
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
						ref={inputRef}
						type="text"
						value={inputText}
						onChange={(e) => setInputText(e.target.value)}
						onKeyDown={handleInputKeyDown}
						placeholder="Type message, mood, or command (\play, \hunt, \tools, \doctor, \sleep)..."
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
