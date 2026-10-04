// src/components/VideoPlayer.tsx
// Cinema-Grade Video Player composed with custom lifecycle hooks, WakeLock, and Watchdog

import { invoke } from "@tauri-apps/api/core";
import { ChevronRight, RefreshCw } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHlsPlayer } from "../hooks/useHlsPlayer";
import { usePlayerKeyboard } from "../hooks/usePlayerKeyboard";
import { usePrewarm } from "../hooks/usePrewarm";
import { useStallWatchdog } from "../hooks/useStallWatchdog";
import { useStreamFailover } from "../hooks/useStreamFailover";
import { useStreamTelemetry } from "../hooks/useStreamTelemetry";
import { useWakeLock } from "../hooks/useWakeLock";
import { useAppStore } from "../stores/appStore";
import { isGeoRestrictedUrl } from "../utils/channelFilter";
import { buildProxyLogoUrl, getProxyToken } from "../utils/proxy";
import { MorningTVLogo } from "./MorningTVLogo";

export const VideoPlayer: React.FC = () => {
	const {
		activeChannel,
		channels,
		isPlaying,
		hideRegionBlocked,
		soundBoost,
		ambientGlow,
		is3GDataSaver,
		selectedQualityLevel,
		aspectRatio,
		mirrorIndex,
		isChannelLoading,
		bufferSecs,
		reconnectCountdown,
		cycleMirror,
		setMirrorIndex,
		setStreamHealthStatus,
		incrementStallCount,
		setIsChannelLoading,
		setReconnectCountdown,
		showToast,
		togglePlayPause,
		toggleMute,
		setSoundBoost,
		openChannelDrawer,
		openShortcuts,
		selectChannelByIndex,
		nextChannel,
		prevChannel,
		cycleAspectRatio,
		set3GDataSaver,
		setSelectedQualityLevel,
	} = useAppStore();

	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [proxyToken, setProxyToken] = useState<string>("");

	useEffect(() => {
		let isMounted = true;
		getProxyToken().then((token) => {
			if (isMounted && token) {
				setProxyToken(token);
			}
		});
		return () => {
			isMounted = false;
		};
	}, []);

	// Active and fallback URLs (filtering geo-blocked/dead mirrors when direct playback is active)
	const allUrls = useMemo(() => {
		if (!activeChannel) return [];
		const raw = [activeChannel.url, ...(activeChannel.fallback_urls || [])];
		if (!hideRegionBlocked) return raw;
		return raw.filter((u) => !isGeoRestrictedUrl(u, activeChannel.provider));
	}, [activeChannel, hideRegionBlocked]);

	const currentUrl = allUrls[mirrorIndex] || allUrls[0] || "";

	// 1. Failover and Mirror Cycling
	const { tryNextFallback, resetFailover } = useStreamFailover({
		activeChannelId: activeChannel ? String(activeChannel.id) : undefined,
		allUrls,
		currentUrl,
		mirrorIndex,
		setMirrorIndex,
		cycleMirror,
		showToast,
		setStreamHealthStatus,
		setReconnectCountdown,
		videoRef,
	});

	// 2. Core HLS.js Lifecycle & Quality Management
	const { hlsRef, isBuffering, setIsBuffering } = useHlsPlayer({
		videoRef,
		currentUrl,
		proxyToken,
		selectedQualityLevel,
		is3GDataSaver,
		isPlaying,
		tryNextFallback,
		setIsChannelLoading,
		setStreamHealthStatus,
	});

	// 3. Real-time Stream Telemetry Poller
	useStreamTelemetry(videoRef, hlsRef);

	// 4. Intelligent Stall Detection & Tiered Adaptation Watchdog
	useStallWatchdog({
		videoRef,
		hlsRef,
		isPlaying,
		bufferSecs,
		allUrls,
		currentUrl,
		showToast,
		is3GDataSaver,
		set3GDataSaver,
		selectedQualityLevel,
		setSelectedQualityLevel,
		setIsBuffering,
		incrementStallCount,
		setStreamHealthStatus,
		tryNextFallback,
		resetFailover,
	});

	// 5. Predictive Channel Pre-Warming into RAM
	usePrewarm(activeChannel, channels, proxyToken);

	// 6. Screen Wake Lock (prevents display sleep during playback)
	useWakeLock(isPlaying);

	const [isNativePip, setIsNativePip] = useState<boolean>(false);

	// Picture-in-Picture handler (Native Floating Window with fallback to browser PiP)
	const handlePiPRequest = useCallback(async () => {
		try {
			const nextState = !isNativePip;
			await invoke("toggle_native_pip", { isPip: nextState });
			setIsNativePip(nextState);
			showToast(
				nextState
					? "📌 Native Floating Mini-Player Active"
					: "PiP Window Restored",
				false,
			);
		} catch {
			if (videoRef.current && document.pictureInPictureEnabled) {
				try {
					if (document.pictureInPictureElement) {
						await document.exitPictureInPicture();
					} else {
						await videoRef.current.requestPictureInPicture();
					}
				} catch (err) {
					console.warn("PiP error:", err);
				}
			}
		}
	}, [isNativePip, showToast]);

	// 7. Keyboard Navigation & Number Key Tuning
	const { channelTuneBanner } = usePlayerKeyboard({
		channels,
		containerRef,
		togglePlayPause,
		toggleMute,
		soundBoost,
		setSoundBoost,
		cycleAspectRatio,
		nextChannel,
		prevChannel,
		selectChannelByIndex,
		openChannelDrawer,
		openShortcuts,
		handlePiPRequest,
	});

	const getAspectRatioClasses = () => {
		switch (aspectRatio) {
			case "4:3":
				return "h-full aspect-[4/3] max-w-full object-contain";
			case "fill":
				return "w-full h-full object-cover";
			case "21:9":
				return "w-full aspect-[21/9] max-h-full object-contain";
			default:
				// YouTube-style fixed viewport: fills 100% container, scales seamlessly across all ABR quality switches without layout shifts
				return "w-full h-full object-contain";
		}
	};

	return (
		<div
			ref={containerRef}
			onDoubleClick={() => {
				if (!document.fullscreenElement) {
					containerRef.current?.requestFullscreen().catch(() => {});
				} else {
					document.exitFullscreen().catch(() => {});
				}
			}}
			className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden select-none"
		>
			{/* On-Screen Channel Tune Number Banner */}
			{channelTuneBanner && (
				<div className="absolute top-16 left-8 z-50 px-5 py-3 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
					<div className="flex items-center gap-2.5">
						<span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
						<span className="text-sm font-mono font-black text-white tracking-wider">
							{channelTuneBanner}
						</span>
					</div>
				</div>
			)}

			{/* Ambilight Ambient Glow Aura */}
			{ambientGlow && activeChannel && (
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 blur-3xl z-0">
					<div className="w-[140%] h-[140%] -left-[20%] -top-[20%] absolute bg-gradient-to-tr from-cyan-900/40 via-indigo-950/60 to-blue-900/40 animate-pulse" />
				</div>
			)}

			{activeChannel ? (
				<div className="w-full h-full relative z-10 flex items-center justify-center">
					<video
						ref={videoRef}
						className={getAspectRatioClasses()}
						style={{ imageRendering: "-webkit-optimize-contrast" }}
						autoPlay
						playsInline
						onWaiting={() => setIsBuffering(true)}
						onTimeUpdate={() => {
							if (reconnectCountdown !== null) {
								resetFailover();
								if (useAppStore.getState().toast?.isError) {
									useAppStore.getState().hideToast();
								}
							}
						}}
						onPlaying={() => {
							resetFailover();
							setIsBuffering(false);
							setIsChannelLoading(false);
							setStreamHealthStatus("good");
							if (useAppStore.getState().toast?.isError) {
								useAppStore.getState().hideToast();
							}
							if (!useAppStore.getState().isPlaying) {
								useAppStore.setState({ isPlaying: true });
							}
						}}
						onPlay={() => {
							if (!useAppStore.getState().isPlaying) {
								useAppStore.setState({ isPlaying: true });
							}
						}}
						onPause={() => {
							if (
								videoRef.current?.paused &&
								useAppStore.getState().isPlaying
							) {
								useAppStore.setState({ isPlaying: false });
							}
						}}
						onCanPlay={() => {
							resetFailover();
							setIsBuffering(false);
							setIsChannelLoading(false);
							if (useAppStore.getState().toast?.isError) {
								useAppStore.getState().hideToast();
							}
							if (
								videoRef.current?.paused &&
								useAppStore.getState().isPlaying
							) {
								videoRef.current.play().catch(() => {});
							}
						}}
						onLoadedData={() => {
							resetFailover();
							setIsBuffering(false);
							setIsChannelLoading(false);
							if (useAppStore.getState().toast?.isError) {
								useAppStore.getState().hideToast();
							}
							if (
								videoRef.current?.paused &&
								useAppStore.getState().isPlaying
							) {
								videoRef.current.play().catch(() => {});
							}
						}}
					/>

					{/* Reconnecting Backoff Indicator */}
					{reconnectCountdown !== null && (
						<div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-none transition-opacity duration-200">
							<div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-black/90 border border-rose-500/40 shadow-2xl shadow-rose-950/50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-auto">
								<RefreshCw className="w-4 h-4 text-rose-400 animate-spin" />
								<span className="text-xs font-bold text-rose-300">
									Stream reconnecting in {reconnectCountdown}s...
								</span>
								<button
									onClick={() => {
										resetFailover();
										cycleMirror();
									}}
									className="px-3 py-1 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-500/40 text-[11px] font-bold text-rose-200 transition-all cursor-pointer hover:scale-105 active:scale-95"
								>
									Retry Now
								</button>
							</div>
						</div>
					)}

					{/* YouTube-Style Sleek Top Edge Buffer Line */}
					{(isBuffering || isChannelLoading) && (
						<div className="absolute top-0 left-0 right-0 h-1 bg-black/40 z-50 overflow-hidden pointer-events-none">
							<div className="h-full w-full bg-gradient-to-r from-transparent via-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-yt-progress" />
						</div>
					)}

					{/* Cinematic Zero-Blackout Channel Transition Aura */}
					{isChannelLoading && activeChannel && (
						<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xl transition-opacity duration-300 pointer-events-none animate-in fade-in">
							<div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-zinc-950/60 border border-white/10 shadow-2xl backdrop-blur-2xl">
								<img
									src={buildProxyLogoUrl(
										activeChannel.logo,
										activeChannel.name,
									)}
									alt={activeChannel.name}
									className="w-16 h-16 object-contain rounded-2xl drop-shadow-[0_0_24px_rgba(6,182,212,0.5)] animate-pulse"
									onError={(e) => {
										(e.target as HTMLElement).style.display = "none";
									}}
								/>
								<span className="text-sm font-black text-white mt-3 tracking-wide">
									{activeChannel.name}
								</span>
								<div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/20">
									<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
									<span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
										Tuning Live Feed
									</span>
								</div>
							</div>
						</div>
					)}
				</div>
			) : (
				/* Clean Welcome Screen with MorningTV Branding */
				<div className="flex flex-col items-center justify-center text-center p-8 max-w-lg select-none relative z-10">
					<div className="mb-6 flex items-center justify-center">
						<MorningTVLogo className="w-24 h-24" glow={true} />
					</div>
					<h2 className="text-2xl font-black text-white mb-2 tracking-tight">
						MorningTV
					</h2>
					<p className="text-xs text-zinc-400 leading-relaxed mb-6 max-w-sm">
						Ultra-smooth live television player with 3G shield and 300% Web
						Audio Booster.
					</p>
					<button
						onClick={openChannelDrawer}
						className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-black shadow-xl shadow-white/15 transition-all cursor-pointer hover:scale-105 active:scale-95"
					>
						<span>Open Channel Guide</span>
						<ChevronRight className="w-4 h-4" />
					</button>
				</div>
			)}
		</div>
	);
};
