// src/hooks/usePrewarm.ts
// Predictive pre-warming of adjacent channel streams into local RAM cache

import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import type { Channel } from "../types";
import { createLogger } from "../utils/logger";
import { buildPrewarmUrl, getCurrentProxyPort } from "../utils/proxy";

const log = createLogger("Prewarm");

export function usePrewarm(
	activeChannel: Channel | null,
	channels: Channel[],
	proxyToken: string,
): void {
	useEffect(() => {
		if (!activeChannel || channels.length < 2 || !proxyToken) return;

		const currentIndex = channels.findIndex(
			(c) => c.id === activeChannel.id || c.url === activeChannel.url,
		);
		if (currentIndex === -1) return;

		// Prewarm next and previous channels
		const nextChannel = channels[(currentIndex + 1) % channels.length];
		const prevChannel =
			channels[(currentIndex - 1 + channels.length) % channels.length];

		const targets = [nextChannel, prevChannel].filter(
			(ch): ch is Channel => !!ch && ch.url !== activeChannel.url,
		);

		const timeoutId = setTimeout(() => {
			const appState = useAppStore.getState();
			// Suppress pre-warming if currently loading/buffering, buffer cushion is low (< 8s), or in 3G Data Saver mode
			if (
				appState.isChannelLoading ||
				appState.bufferSecs < 8.0 ||
				appState.is3GDataSaver
			) {
				log.debug(
					"Pre-warming suppressed to conserve bandwidth for active stream",
					{
						isChannelLoading: appState.isChannelLoading,
						bufferSecs: appState.bufferSecs,
						is3GDataSaver: appState.is3GDataSaver,
					},
				);
				return;
			}

			const port = getCurrentProxyPort();
			for (const target of targets) {
				const prewarmUrl = buildPrewarmUrl(target.url, proxyToken, port);
				if (prewarmUrl) {
					fetch(prewarmUrl, { method: "GET", mode: "no-cors" }).catch((err) => {
						log.debug("Prewarm failed silently", {
							url: target.url,
							error: err,
						});
					});
				}
			}
		}, 2500); // 2.5s delay after tuning to avoid competing with primary channel buffer fill

		return () => clearTimeout(timeoutId);
	}, [activeChannel, channels, proxyToken]);
}
