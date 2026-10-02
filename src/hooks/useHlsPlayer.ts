// src/hooks/useHlsPlayer.ts
// HLS.js lifecycle, adaptive bitrate engine, buffer scaling, and error handling

import Hls from "hls.js";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { audioBooster } from "../utils/audioBooster";
import { createLogger } from "../utils/logger";
import {
	buildProxiedUrl,
	getCurrentProxyPort,
	invalidateProxyCache,
} from "../utils/proxy";
import { formatBytesPerSec } from "../utils/speedFormatter";

const log = createLogger("HlsPlayer");

export interface HlsPlayerOptions {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	currentUrl: string;
	proxyToken: string;
	selectedQualityLevel: number;
	is3GDataSaver: boolean;
	isPlaying: boolean;
	tryNextFallback: () => void;
	setIsChannelLoading: (loading: boolean) => void;
	setStreamHealthStatus: (status: any) => void;
}

export function useHlsPlayer(options: HlsPlayerOptions): {
	hlsRef: React.RefObject<Hls | null>;
	isBuffering: boolean;
	setIsBuffering: (buffering: boolean) => void;
} {
	const {
		videoRef,
		currentUrl,
		proxyToken,
		selectedQualityLevel,
		is3GDataSaver,
		isPlaying,
		tryNextFallback,
		setIsChannelLoading,
		setStreamHealthStatus,
	} = options;

	const hlsRef = useRef<Hls | null>(null);
	const retryCountRef = useRef<number>(0);
	const lowBandwidthStreakRef = useRef<number>(0);
	const highBandwidthStreakRef = useRef<number>(0);
	const [isBuffering, setIsBuffering] = useState(false);

	// Primary HLS lifecycle
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !currentUrl) return;

		setIsChannelLoading(true);
		setIsBuffering(true);

		const port = getCurrentProxyPort();
		const proxiedUrl = buildProxiedUrl(currentUrl, proxyToken, port);
		log.info("Loading stream into player", { currentUrl, port });

		if (Hls.isSupported()) {
			if (hlsRef.current) {
				hlsRef.current.stopLoad();
				hlsRef.current.detachMedia();
				hlsRef.current.destroy();
				hlsRef.current = null;
			}

			video.pause();

			const hls = new Hls({
				enableWorker: true,
				lowLatencyMode: false,
				backBufferLength: is3GDataSaver ? 15 : 30,
				maxBufferLength: is3GDataSaver ? 12 : 35,
				maxMaxBufferLength: is3GDataSaver ? 24 : 60,
				maxBufferSize: is3GDataSaver ? 20 * 1000 * 1000 : 60 * 1000 * 1000,
				maxBufferHole: 0.5,
				highBufferWatchdogPeriod: 3,
				liveSyncDurationCount: is3GDataSaver ? 5 : 3,
				liveMaxLatencyDurationCount: is3GDataSaver ? 12 : 10,
				initialLiveManifestSize: 1,
				liveDurationInfinity: true,
				fragLoadingTimeOut: 15000,
				fragLoadingMaxRetry: 6,
				fragLoadingRetryDelay: 1000,
				fragLoadingMaxRetryTimeout: 35000,
				manifestLoadingTimeOut: 12000,
				manifestLoadingMaxRetry: 6,
				manifestLoadingRetryDelay: 1000,
				manifestLoadingMaxRetryTimeout: 35000,
				levelLoadingTimeOut: 12000,
				levelLoadingMaxRetry: 6,
				levelLoadingRetryDelay: 1000,
				levelLoadingMaxRetryTimeout: 35000,
				nudgeOffset: 0.2,
				nudgeMaxRetry: 15,
				maxStarvationDelay: 3,
				abrEwmaFastLive: 2.0,
				abrEwmaSlowLive: 8.0,
				abrBandWidthFactor: 0.8,
				abrBandWidthUpFactor: 0.7,
				abrMaxWithRealBitrate: true,
				capLevelToPlayerSize: true,
				startLevel: is3GDataSaver ? 0 : -1,
				autoStartLoad: true,
			});

			hlsRef.current = hls;
			hls.loadSource(proxiedUrl);
			hls.attachMedia(video);

			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				retryCountRef.current = 0;
				setIsChannelLoading(false);

				if (hls.levels && hls.levels.length > 0) {
					const levels = hls.levels.map((lvl, index) => {
						const height = lvl.height || 0;
						const bitrate = lvl.bitrate || 0;
						let label: string;
						if (height >= 1080) label = "1080p Full HD";
						else if (height >= 720) label = "720p HD";
						else if (height >= 480) label = "480p SD";
						else if (height >= 360) label = "360p (Saver)";
						else if (height > 0) label = `${height}p Low`;
						else label = `Level ${index + 1}`;
						return { index, label, height, bitrate };
					});
					useAppStore.getState().setAvailableQualityLevels(levels);

					const { selectedQualityLevel: selLvl, is3GDataSaver: saver } =
						useAppStore.getState();
					if (selLvl >= 0 && selLvl < hls.levels.length) {
						hls.currentLevel = selLvl;
					} else if (saver) {
						const saverIdx = levels.findIndex(
							(l) => l.height >= 360 && l.height <= 480,
						);
						hls.currentLevel = saverIdx !== -1 ? saverIdx : 0;
					} else {
						hls.currentLevel = -1;
					}
				}

				const appState = useAppStore.getState();
				audioBooster.attach(
					video,
					appState.volume,
					appState.soundBoost,
					appState.isMuted,
				);
				if (appState.isPlaying) {
					video.play().catch(() => {});
				}
			});

			hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
				if (hls.levels?.[data.level]) {
					const lvl = hls.levels[data.level];
					const resStr = `${lvl.height}p (${lvl.width}x${lvl.height})`;
					useAppStore.getState().setCurrentResolution(resStr);
				}
			});

			hls.on(Hls.Events.FRAG_BUFFERED, () => {
				setIsBuffering(false);
				setIsChannelLoading(false);
				setStreamHealthStatus("good");
			});

			hls.on(Hls.Events.FRAG_LOADED, (_event, data: any) => {
				setIsBuffering(false);
				setIsChannelLoading(false);
				setStreamHealthStatus("good");

				try {
					const frag = data?.frag;
					if (frag) {
						const payloadBytes = data?.payload?.byteLength || 0;
						const statsBytes = frag.stats?.total || frag.stats?.loaded || 0;
						const totalBytes = payloadBytes > 0 ? payloadBytes : statsBytes;
						const durationSec = frag.duration > 0 ? frag.duration : 2.0;

						const loadStart = frag.stats?.loading?.start || 0;
						const loadEnd = frag.stats?.loading?.end || performance.now();
						const loadDurationSec = Math.max(
							0.01,
							(loadEnd - loadStart) / 1000,
						);

						const downloadBytesSec = totalBytes / loadDurationSec;
						const fmtDownload = formatBytesPerSec(downloadBytesSec);
						const streamBytesSec =
							totalBytes > 0 ? totalBytes / durationSec : 0;
						const bwEstimateBits = hls.bandwidthEstimate || 0;
						const fmtCapacity = formatBytesPerSec(bwEstimateBits / 8);

						let nominalBitrateStr = "";
						if (
							hls.levels &&
							hls.currentLevel >= 0 &&
							hls.levels[hls.currentLevel]?.bitrate
						) {
							const nomBits = hls.levels[hls.currentLevel].bitrate;
							const nomFmt = formatBytesPerSec(nomBits / 8);
							nominalBitrateStr = `${nomFmt.formatted} (${nomFmt.mbps})`;
						}

						const activeStreamBytes =
							streamBytesSec > 0
								? streamBytesSec
								: hls.levels?.[hls.currentLevel]?.bitrate
									? hls.levels[hls.currentLevel].bitrate / 8
									: 0;

						const finalStreamFmt = formatBytesPerSec(activeStreamBytes);

						useAppStore.getState().setTelemetryStats({
							networkSpeed: fmtDownload.formatted,
							downloadSpeedFormatted: fmtDownload.formatted,
							downloadSpeedMbps: fmtDownload.mbps,
							streamBitrateFormatted: finalStreamFmt.formatted,
							streamBitrateMbps: finalStreamFmt.mbps,
							bandwidthCapacityFormatted: fmtCapacity.formatted,
							bandwidthCapacityMbps: fmtCapacity.mbps,
							nominalBitrate: nominalBitrateStr || "--",
						});

						// Auto 3G Mode Hysteresis detection
						if (bwEstimateBits > 0) {
							if (bwEstimateBits < 700_000) {
								lowBandwidthStreakRef.current += 1;
								highBandwidthStreakRef.current = 0;
								if (
									lowBandwidthStreakRef.current >= 3 &&
									!useAppStore.getState().is3GDataSaver
								) {
									log.info(
										"Auto-activating 3G Data Saver due to sustained low throughput",
										{ bwEstimateBits },
									);
									useAppStore.getState().set3GDataSaver(true);
								}
							} else if (bwEstimateBits > 2_500_000) {
								highBandwidthStreakRef.current += 1;
								lowBandwidthStreakRef.current = 0;
								if (
									highBandwidthStreakRef.current >= 8 &&
									useAppStore.getState().is3GDataSaver
								) {
									log.info(
										"Auto-restoring HD playback due to sustained high throughput",
										{ bwEstimateBits },
									);
									useAppStore.getState().set3GDataSaver(false);
								}
							} else {
								lowBandwidthStreakRef.current = 0;
								highBandwidthStreakRef.current = 0;
							}
						}
					}
				} catch (err) {
					log.debug("Telemetry calculation exception", { error: err });
				}
			});

			hls.on(Hls.Events.BUFFER_APPENDING, () => {
				setIsBuffering(false);
				setIsChannelLoading(false);
			});

			hls.on(Hls.Events.ERROR, (_event, data) => {
				if (data.fatal) {
					switch (data.type) {
						case Hls.ErrorTypes.NETWORK_ERROR:
							if (data.response?.code === 401 || data.response?.code === 403) {
								invalidateProxyCache();
							}
							retryCountRef.current += 1;
							if (retryCountRef.current <= 2) {
								// If fragment timed out on slow network and multi-bitrate is available,
								// step down to lightweight level before failing
								if (
									(data.details === "fragLoadError" ||
										data.details === "fragLoadTimeOut") &&
									hls.levels &&
									hls.levels.length > 1 &&
									!useAppStore.getState().is3GDataSaver
								) {
									log.info(
										"Fragment load timed out on slow network, stepping down to 3G Data Saver",
									);
									useAppStore.getState().set3GDataSaver(true);
									hls.currentLevel = 0;
								}
								const backoff = Math.min(2000, retryCountRef.current * 500);
								setTimeout(() => {
									if (hlsRef.current) {
										hls.startLoad();
									}
								}, backoff);
							} else {
								retryCountRef.current = 0;
								invalidateProxyCache();
								hls.destroy();
								hlsRef.current = null;
								tryNextFallback();
							}
							break;
						case Hls.ErrorTypes.MEDIA_ERROR:
							retryCountRef.current += 1;
							if (retryCountRef.current <= 2) {
								hls.recoverMediaError();
							} else if (retryCountRef.current === 3) {
								hls.swapAudioCodec();
								hls.recoverMediaError();
							} else {
								retryCountRef.current = 0;
								hls.destroy();
								hlsRef.current = null;
								tryNextFallback();
							}
							break;
						default:
							retryCountRef.current += 1;
							if (retryCountRef.current <= 2) {
								hls.startLoad();
							} else {
								retryCountRef.current = 0;
								hls.destroy();
								hlsRef.current = null;
								tryNextFallback();
							}
							break;
					}
				}
			});
		} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
			video.src = proxiedUrl;
			const onLoadedMeta = () => {
				setIsBuffering(false);
				video.play().catch(() => {});
			};
			const onError = () => tryNextFallback();
			video.addEventListener("loadedmetadata", onLoadedMeta);
			video.addEventListener("error", onError);

			return () => {
				if (hlsRef.current) {
					hlsRef.current.destroy();
					hlsRef.current = null;
				}
				video.removeEventListener("loadedmetadata", onLoadedMeta);
				video.removeEventListener("error", onError);
			};
		}

		return () => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
		};
	}, [
		currentUrl,
		proxyToken,
		is3GDataSaver,
		tryNextFallback,
		setIsChannelLoading,
		setStreamHealthStatus,
		videoRef,
	]);

	// Level switching effect and dynamic buffer scaling
	useEffect(() => {
		if (!hlsRef.current) return;

		// Dynamically adjust buffer scale based on 3G mode
		if (hlsRef.current.config) {
			hlsRef.current.config.maxBufferLength = is3GDataSaver ? 12 : 35;
			hlsRef.current.config.maxMaxBufferLength = is3GDataSaver ? 24 : 60;
			hlsRef.current.config.liveSyncDurationCount = is3GDataSaver ? 5 : 3;
		}

		if (!hlsRef.current.levels) return;
		if (
			selectedQualityLevel >= 0 &&
			selectedQualityLevel < hlsRef.current.levels.length
		) {
			hlsRef.current.currentLevel = selectedQualityLevel;
		} else if (is3GDataSaver) {
			const levels = hlsRef.current.levels;
			const saverLevelIdx = levels.findIndex(
				(l) => (l.height || 0) >= 360 && (l.height || 0) <= 480,
			);
			hlsRef.current.currentLevel = saverLevelIdx !== -1 ? saverLevelIdx : 0;
		} else {
			hlsRef.current.currentLevel = -1;
		}
	}, [selectedQualityLevel, is3GDataSaver]);

	// Playback play/pause synchronization
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (isPlaying) {
			video.play().catch(() => {});
		} else {
			video.pause();
		}
	}, [isPlaying, videoRef]);

	return { hlsRef, isBuffering, setIsBuffering };
}
