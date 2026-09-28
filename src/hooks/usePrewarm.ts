// src/hooks/usePrewarm.ts
// Predictive pre-warming of adjacent channel streams into local RAM cache

import { useEffect } from "react";
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
