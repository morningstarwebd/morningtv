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

export function isGeoRestrictedStream(ch: Channel): boolean {
	if (ch.provider && GEO_RESTRICTED_PROVIDERS.has(ch.provider)) {
		return true;
	}
	const urlLower = ch.url.toLowerCase();
	return GEO_RESTRICTED_DOMAINS.some((domain) => urlLower.includes(domain));
}

export function filterChannelsClient(
	allChannels: Channel[],
	activeCategory: string,
	searchQuery: string,
	hideRegionBlocked = false,
): Channel[] {
	const q = searchQuery.trim().toLowerCase();
	return allChannels.filter((ch) => {
		if (hideRegionBlocked && isGeoRestrictedStream(ch)) {
			return false;
		}

		if (activeCategory === "Favorites") {
			if (!ch.is_favorite) return false;
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
