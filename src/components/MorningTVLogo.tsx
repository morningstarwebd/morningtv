import type React from "react";

interface MorningTVLogoProps {
	className?: string;
	showText?: boolean;
	glow?: boolean;
	size?: number;
}

export const MorningTVLogo: React.FC<MorningTVLogoProps> = ({
	className = "w-6 h-6",
	showText = false,
	glow = true,
	size,
}) => {
	const style = size ? { width: size, height: size } : undefined;

	return (
		<div className="inline-flex items-center gap-2.5 select-none shrink-0">
			{/* SVG Vector Emblem */}
			<div
				className={`relative flex items-center justify-center shrink-0 ${glow ? "drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" : ""}`}
				style={style}
			>
				<svg
					viewBox="0 0 512 512"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className={`${className} transition-transform duration-300 group-hover:scale-105`}
					style={style}
				>
					<defs>
						<radialGradient id="mtv-cmp-ambient" cx="50%" cy="45%" r="60%">
							<stop offset="0%" stopColor="#06B6D4" stopOpacity="0.35" />
							<stop offset="60%" stopColor="#3B82F6" stopOpacity="0.1" />
							<stop offset="100%" stopColor="#000000" stopOpacity="0" />
						</radialGradient>
						<linearGradient
							id="mtv-cmp-bezel"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#38BDF8" />
							<stop offset="40%" stopColor="#06B6D4" />
							<stop offset="70%" stopColor="#3B82F6" />
							<stop offset="100%" stopColor="#6366F1" />
						</linearGradient>
						<linearGradient
							id="mtv-cmp-sun"
							x1="50%"
							y1="100%"
							x2="50%"
							y2="0%"
						>
							<stop offset="0%" stopColor="#EA580C" />
							<stop offset="35%" stopColor="#F97316" />
							<stop offset="70%" stopColor="#FBBF24" />
							<stop offset="100%" stopColor="#FEF08A" />
						</linearGradient>
						<linearGradient
							id="mtv-cmp-m-left"
							x1="0%"
							y1="100%"
							x2="100%"
							y2="0%"
						>
							<stop offset="0%" stopColor="#0284C7" />
							<stop offset="50%" stopColor="#06B6D4" />
							<stop offset="100%" stopColor="#38BDF8" />
						</linearGradient>
						<linearGradient
							id="mtv-cmp-m-right"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#38BDF8" />
							<stop offset="50%" stopColor="#3B82F6" />
							<stop offset="100%" stopColor="#6366F1" />
						</linearGradient>
						<clipPath id="mtv-cmp-clip">
							<rect x="70" y="150" width="372" height="276" rx="38" />
						</clipPath>
					</defs>

					{/* Background Glow */}
					<rect
						x="0"
						y="0"
						width="512"
						height="512"
						rx="110"
						fill="url(#mtv-cmp-ambient)"
					/>

					{/* Antennas */}
					<g>
						<path
							d="M 186 92 L 236 142"
							stroke="url(#mtv-cmp-bezel)"
							strokeWidth="14"
							strokeLinecap="round"
						/>
						<circle cx="180" cy="86" r="11" fill="#38BDF8" />
						<path
							d="M 326 92 L 276 142"
							stroke="url(#mtv-cmp-m-right)"
							strokeWidth="14"
							strokeLinecap="round"
						/>
						<circle cx="332" cy="86" r="11" fill="#818CF8" />
					</g>

					{/* Chassis */}
					<rect
						x="52"
						y="132"
						width="408"
						height="312"
						rx="54"
						fill="#0A0E1A"
						stroke="url(#mtv-cmp-bezel)"
						strokeWidth="10"
					/>
					<rect
						x="68"
						y="148"
						width="376"
						height="280"
						rx="40"
						fill="#050814"
					/>

					{/* Artwork Clip Area */}
					<g clipPath="url(#mtv-cmp-clip)">
						{/* Dawn Horizon Glow */}
						<ellipse
							cx="256"
							cy="380"
							rx="180"
							ry="100"
							fill="#EA580C"
							opacity="0.4"
						/>
						<ellipse
							cx="256"
							cy="330"
							rx="130"
							ry="70"
							fill="#F97316"
							opacity="0.5"
						/>

						{/* Morning Sun */}
						<circle cx="256" cy="315" r="76" fill="url(#mtv-cmp-sun)" />
						<circle cx="256" cy="315" r="42" fill="#FFFBEB" opacity="0.9" />

						{/* "M" Crest */}
						<path
							d="M 124 380 L 198 226 C 203 216 215 214 223 222 L 256 256 L 222 380 Z"
							fill="url(#mtv-cmp-m-left)"
						/>
						<path
							d="M 388 380 L 314 226 C 309 216 297 214 289 222 L 256 256 L 290 380 Z"
							fill="url(#mtv-cmp-m-right)"
						/>

						{/* Center Play Beacon */}
						<polygon points="248,276 248,324 286,300" fill="#FFFFFF" />

						{/* Broadcast Arc Waves */}
						<path
							d="M 218 190 A 52 52 0 0 1 294 190"
							fill="none"
							stroke="#38BDF8"
							strokeWidth="5"
							strokeLinecap="round"
						/>
					</g>

					{/* Stand Base */}
					<path
						d="M 234 444 L 278 444 L 286 466 L 226 466 Z"
						fill="#182032"
						stroke="#2563EB"
						strokeWidth="2"
					/>
					<rect
						x="180"
						y="466"
						width="152"
						height="14"
						rx="7"
						fill="#0F172A"
						stroke="url(#mtv-cmp-bezel)"
						strokeWidth="3"
					/>
					<circle cx="256" cy="436" r="3.5" fill="#22D3EE" />
				</svg>
			</div>

			{/* Optional Typography Lockup */}
			{showText && (
				<div className="flex items-center tracking-tight font-black leading-none">
					<span className="text-white">Morning</span>
					<span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent ml-0.5">
						TV
					</span>
				</div>
			)}
		</div>
	);
};
