// src/utils/channelFilter.ts
// Pure client-side channel filtering engine for category, search query, and favorites

import type { Channel } from "../types/index.ts";

export function filterChannelsClient(
	allChannels: Channel[],
	activeCategory: string,
	searchQuery: string,
): Channel[] {
	const q = searchQuery.trim().toLowerCase();
	return allChannels.filter((ch) => {
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
