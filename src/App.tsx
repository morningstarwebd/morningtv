// src/App.tsx
// Simplified, Next-Generation Apple TV & Google TV Live Streaming Interface

import type React from "react";
import { useEffect } from "react";
import { AppleTVChannelShelf } from "./components/AppleTVChannelShelf";
import { AppleTVDock } from "./components/AppleTVDock";
import { AppleTVTopBar } from "./components/AppleTVTopBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { StreamQualityPopover } from "./components/StreamQualityPopover";
import { ToastBanner } from "./components/ToastBanner";
import { VideoPlayer } from "./components/VideoPlayer";
import { YouTubeModal } from "./components/YouTubeModal";
import { useAppStore } from "./stores/appStore";

const App: React.FC = () => {
	const { init } = useAppStore();

	useEffect(() => {
		init();
	}, [init]);

	return (
		<div className="h-screen w-screen relative bg-black text-zinc-100 overflow-hidden select-none font-sans">
			{/* Floating System Alerts */}
			<ToastBanner />

			{/* 100% Immersive Full-Bleed Video Canvas */}
			<main className="w-full h-full">
				<VideoPlayer />
			</main>

			{/* Minimalist Apple TV Top Navigation Bar (Auto-Hides) */}
			<AppleTVTopBar />

			{/* Real-time Stream & Network Quality Popover HUD */}
			<StreamQualityPopover />

			{/* YouTube TV Live Player & Channels Modal */}
			<YouTubeModal />

			{/* Minimalist Apple TV Bottom Control Dock (Auto-Hides) */}
			<AppleTVDock />

			{/* Apple TV / Google TV Bottom Horizontal Channel Shelf */}
			<AppleTVChannelShelf />

			{/* Settings Dialog */}
			<SettingsDialog />

			{/* Shortcuts Guide Modal */}
			<ShortcutsModal />
		</div>
	);
};

export default App;
