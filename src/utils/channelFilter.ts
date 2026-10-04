// src/utils/channelFilter.ts
// Pure client-side channel filtering engine for category, search query, favorites, and region-blocked streams

import type { Channel } from "../types/index.ts";

const GEO_RESTRICTED_PROVIDERS = new Set(["Pluto TV", "Roku"]);
const GEO_RESTRICTED_DOMAINS = [
	"pluto.tv",
	"roku.com",
	"therokuchannel",
	"samsungcloudsolution",
	"stirrtv",
	"localnow",
];

export function isGeoRestrictedUrl(
	url: string,
	provider?: string | null,
): boolean {
	if (provider && GEO_RESTRICTED_PROVIDERS.has(provider)) {
		return true;
	}
	const urlLower = url.toLowerCase();
	if (
		urlLower.includes("video_no_available") ||
		urlLower.includes("not_available") ||
		urlLower.includes("offline_stream")
	) {
		return true;
	}
	return GEO_RESTRICTED_DOMAINS.some((domain) => urlLower.includes(domain));
}

export function isGeoRestrictedStream(ch: Channel): boolean {
	return isGeoRestrictedUrl(ch.url, ch.provider);
}

export function isIndianOrRegionalStream(ch: Channel): boolean {
	const p = (ch.provider || "").toLowerCase();
	const g = (ch.group || "").toLowerCase();
	const n = (ch.name || "").toLowerCase();
	const id = (typeof ch.id === "string" ? ch.id : "").toLowerCase();
	return (
		p.includes("india") ||
		p.includes("bengali") ||
		p.includes("hindi") ||
		p.includes("bangladesh") ||
		g.includes("india") ||
		g.includes("bangla") ||
		g.includes("hindi") ||
		id.includes(".in@") ||
		id.endsWith(".in") ||
		id.includes(".bd@") ||
		id.endsWith(".bd") ||
		n.includes("hindi") ||
		n.includes("bangla") ||
		n.includes("bengali")
	);
}

export function filterChannelsClient(
	allChannels: Channel[],
	activeCategory: string,
	searchQuery: string,
	hideRegionBlocked = false,
	showOnlyVerified = false,
): Channel[] {
	const q = searchQuery.trim().toLowerCase();
	return allChannels.filter((ch) => {
		if (showOnlyVerified && !ch.is_verified) {
			return false;
		}

		if (hideRegionBlocked && isGeoRestrictedStream(ch)) {
			return false;
		}

		if (activeCategory === "Favorites") {
			if (!ch.is_favorite) return false;
		} else if (activeCategory === "India") {
			if (!isIndianOrRegionalStream(ch)) return false;
		} else if (activeCategory !== "All") {
			const catMatches = ch.group
				.split(/[;,]/)
				.some(
					(part) => part.trim().toLowerCase() === activeCategory.toLowerCase(),
				);
			if (!catMatches) return false;
		}

		if (q) {
			const nameMatch = ch.name.toLowerCase().includes(q);
			const groupMatch = ch.group.toLowerCase().includes(q);
			if (!nameMatch && !groupMatch) return false;
		}

		return true;
	});
}
