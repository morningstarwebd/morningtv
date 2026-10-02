import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Production Security & Native Desktop Polish:
// In production builds: disable default right-click context menu and browser DevTools shortcuts
if (!import.meta.env.DEV) {
	document.addEventListener("contextmenu", (e) => {
		e.preventDefault();
	});
	document.addEventListener("keydown", (e) => {
		// Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+R, F5 in production
		if (
			e.key === "F12" ||
			((e.ctrlKey || e.metaKey) &&
				e.shiftKey &&
				["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
			((e.ctrlKey || e.metaKey) && ["u", "U", "r", "R"].includes(e.key)) ||
			e.key === "F5"
		) {
			e.preventDefault();
		}
	});
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
