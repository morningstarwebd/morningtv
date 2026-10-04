import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "./logger.ts";

const log = createLogger("ProxyClient");

let cachedToken: string | null = null;
let tokenExpiry = 0;
let tokenFetchPromise: Promise<string> | null = null;

let cachedPort = 18181;
let portExpiry = 0;
let portFetchPromise: Promise<number> | null = null;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

export async function getProxyPort(forceRefresh = false): Promise<number> {
	const now = Date.now();
	if (!forceRefresh && cachedPort > 0 && now < portExpiry) {
		return cachedPort;
	}

	if (portFetchPromise) return portFetchPromise;

	portFetchPromise = (async () => {
		try {
			if (typeof window === "undefined") {
				return cachedPort;
			}
			const port = await invoke<number>("get_proxy_port");
			if (port && port > 0) {
				cachedPort = port;
				portExpiry = Date.now() + CACHE_TTL_MS;
				log.debug("Proxy port refreshed", { port });
			}
			return cachedPort;
		} catch (e) {
			log.warn("Could not query dynamic proxy port, fallback to cached:", {
				error: e,
				cachedPort,
			});
			return cachedPort;
		} finally {
			portFetchPromise = null;
		}
	})();

	return portFetchPromise;
}

export function getCurrentProxyPort(): number {
	return cachedPort;
}

export async function getProxyToken(forceRefresh = false): Promise<string> {
	// Eagerly sync port as well
	getProxyPort(forceRefresh).catch(() => {});

	const now = Date.now();
	if (!forceRefresh && cachedToken && now < tokenExpiry) {
		return cachedToken;
	}

	if (tokenFetchPromise) return tokenFetchPromise;

	tokenFetchPromise = (async () => {
		try {
			if (typeof window === "undefined") {
				return cachedToken || "dev-proxy-token";
			}
			const token = await invoke<string>("get_proxy_auth_token");
			if (token) {
				cachedToken = token;
				tokenExpiry = Date.now() + CACHE_TTL_MS;
				log.debug("Proxy auth token acquired/refreshed");
			}
			return token;
		} catch (e) {
			log.error("Failed to retrieve proxy authentication token", { error: e });
			cachedToken = null;
			tokenExpiry = 0;
			return "";
		} finally {
			tokenFetchPromise = null;
		}
	})();

	return tokenFetchPromise;
}

/** Invalidate cached credentials (e.g. if proxy restarted or returned 401) */
export function invalidateProxyCache(): void {
	log.info("Invalidating proxy cache (token & port)");
	cachedToken = null;
	tokenExpiry = 0;
	portExpiry = 0;
}

export function buildProxiedUrl(
	targetUrl: string,
	token: string,
	port = cachedPort,
): string {
	if (!targetUrl) return "";
	if (/^http:\/\/127\.0\.0\.1:\d+\//.test(targetUrl)) {
		if (token && !targetUrl.includes("token=")) {
			const sep = targetUrl.includes("?") ? "&" : "?";
			return `${targetUrl}${sep}token=${encodeURIComponent(token)}`;
		}
		return targetUrl;
	}
	const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
	return `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(targetUrl)}${tokenParam}`;
}

export function buildPrewarmUrl(
	targetUrl: string,
	token: string,
	port = cachedPort,
): string {
	if (!targetUrl) return "";
	const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
	return `http://127.0.0.1:${port}/prewarm?url=${encodeURIComponent(targetUrl)}${tokenParam}`;
}

export function buildProxyLogoUrl(
	targetUrl?: string | null,
	channelName = "",
	port = cachedPort,
): string {
	const rawUrl = targetUrl?.trim() || "";
	return `http://127.0.0.1:${port}/logo?url=${encodeURIComponent(rawUrl)}&name=${encodeURIComponent(channelName)}`;
}
