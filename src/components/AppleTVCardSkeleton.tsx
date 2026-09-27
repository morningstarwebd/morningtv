// src/components/AppleTVCardSkeleton.tsx
// YouTube / Apple TV-style shimmering skeleton placeholder card

import type React from "react";

export const AppleTVCardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
	return (
		<>
			{Array.from({ length: count }).map((_, idx) => (
				<div
					key={`shelf-skeleton-${idx}`}
					className="w-48 sm:w-56 h-32 sm:h-36 rounded-2xl p-3 flex flex-col justify-between shrink-0 border border-white/[0.08] bg-white/[0.03] overflow-hidden relative select-none animate-shimmer"
				>
					{/* Top Header Placeholder */}
					<div className="flex items-center justify-between z-10">
						<div className="w-14 h-4 rounded-lg bg-white/10" />
						<div className="w-4 h-4 rounded-full bg-white/10" />
					</div>

					{/* Center Logo Placeholder */}
					<div className="flex items-center justify-center my-1 z-10">
						<div className="w-20 h-10 rounded-xl bg-white/10 border border-white/5" />
					</div>

					{/* Bottom Bar Placeholder */}
					<div className="z-10 pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
						<div className="w-28 h-3 rounded bg-white/10" />
						<div className="w-12 h-2.5 rounded bg-white/5" />
					</div>
				</div>
			))}
		</>
	);
};
