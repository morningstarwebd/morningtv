// src/utils/proxy.ts
// Client utility for communicating with local Axum stream proxy securely

import { invoke } from "@tauri-apps/api/core";

let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string> | null = null;
let cachedPort = 18181;
let portFetchPromise: Promise<number> | null = null;

export async function getProxyPort(): Promise<number> {
	if (portFetchPromise) return portFetchPromise;

	portFetchPromise = (async () => {
		try {
			const port = await invoke<number>("get_proxy_port");
			if (port && port > 0) {
				cachedPort = port;
			}
			return cachedPort;
		} catch (e) {
			console.warn("Could not query dynamic proxy port, fallback to 18181:", e);
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

export async function getProxyToken(): Promise<string> {
	// Eagerly sync port as well
	getProxyPort().catch(() => {});

	if (cachedToken) return cachedToken;
	if (tokenFetchPromise) return tokenFetchPromise;

	tokenFetchPromise = (async () => {
		try {
			const token = await invoke<string>("get_proxy_auth_token");
			cachedToken = token;
			return token;
		} catch (e) {
			console.error("Failed to retrieve proxy authentication token:", e);
			return "";
		} finally {
			tokenFetchPromise = null;
		}
	})();

	return tokenFetchPromise;
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
