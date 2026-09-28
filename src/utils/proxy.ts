// src/utils/proxy.ts
// Client utility for communicating with local Axum stream proxy securely

import { invoke } from "@tauri-apps/api/core";

let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string> | null = null;

export async function getProxyToken(): Promise<string> {
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

export function buildProxiedUrl(targetUrl: string, token: string): string {
	if (!targetUrl) return "";
	if (targetUrl.startsWith("http://127.0.0.1:18181/")) {
		if (token && !targetUrl.includes("token=")) {
			const sep = targetUrl.includes("?") ? "&" : "?";
			return `${targetUrl}${sep}token=${encodeURIComponent(token)}`;
		}
		return targetUrl;
	}
	const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
	return `http://127.0.0.1:18181/stream?url=${encodeURIComponent(targetUrl)}${tokenParam}`;
}

export function buildPrewarmUrl(targetUrl: string, token: string): string {
	if (!targetUrl) return "";
	const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
	return `http://127.0.0.1:18181/prewarm?url=${encodeURIComponent(targetUrl)}${tokenParam}`;
}
