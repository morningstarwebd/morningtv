# MorningTV Modal & Dialog Design System Standard (v1.1.1)

This document establishes the official visual design standard, physical dimensional metrics, and architectural layout rules for all present and future modal windows, popovers, diagnostics panels, and settings dialogs across **MorningTV**.

---

## 1. Core Principles & Physical Dimensions

1. **Standard Physical Dimension: 6 Inches (Width) × 5 Inches (Height)**
   - Standard W3C CSS display pixel calculation at standard 96 DPI:
     - **Width (Left-to-Right):** $6\text{ inches} \times 96\text{ px/inch} = \mathbf{576\text{px}}$ (`w-[576px] max-w-[95vw]`).
     - **Height (Top-to-Bottom):** $5\text{ inches} \times 96\text{ px/inch} = \mathbf{480\text{px}}$ (`h-[480px] max-h-[95vh]`).
   - Both the **Settings Window** (`SettingsDialog.tsx`) and **Stream Speed / Diagnostics Window** (`StreamQualityPopover.tsx`) use this exact identical dimension.
   - **Zero Jitter Rule:** The outer shell size must **NEVER** shrink, grow, stretch, or jitter when switching tabs or loading dynamic metrics.

2. **Absolute Screen-Centered Positioning**
   - Whether displayed on a 15-inch laptop, a 24-inch desktop monitor, or an ultrawide display:
     - Overlay positioning: `fixed inset-0 z-50 flex items-center justify-center`
     - The window is locked dead in the center horizontally and vertically across the entire viewport.

3. **Two-Column Studio Grid Layout**
   - **Left Sidebar:** Locked to exactly **$192\text{px}$** (`w-48 h-full shrink-0`)
     - Contains App Branding / Logo, Navigation Pills, and System Status / App Version (`v1.1.1`).
   - **Right Content Panel:** Fills the remaining **$384\text{px}$** (`flex-1 h-full shrink-0`)
     - Contains Tab Title & Description Header, Close Button (`X`), Inner Scroll Canvas (`h-[385px]`), and Action Footer.

4. **Frosted Translucent Glassmorphism**
   - Outer Container: `bg-[#060814]/75` with `backdrop-blur-2xl`, `border border-white/20`, `rounded-3xl`, `shadow-[0_30px_90px_rgba(0,0,0,0.85)]`, and `ring-1 ring-white/15`.
   - Backdrop Overlay: Lightweight `bg-black/30 backdrop-blur-sm select-none animate-in fade-in duration-200`. The underlying live TV video remains subtly visible and ambient behind the window.

5. **Strict Inner Scroll Boundaries (Zero Outer Scrollbar)**
   - The outer modal and sidebar must never scroll (`overflow-hidden`).
   - All tab body contents scroll inside the dedicated inner container:
     `h-[385px] overflow-y-auto pr-1 flex flex-col justify-start gap-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent`.

---

## 2. Dimensional Blueprint (6" × 5" / 576px × 480px)

```
+====================================================================================+
| Screen Overlay: fixed inset-0 z-50 flex items-center justify-center                |
|                 bg-black/30 backdrop-blur-sm select-none p-2 sm:p-4                |
|                                                                                    |
|  +------------------------------------------------------------------------------+  |
|  | Outer Shell: w-[576px] (6") × h-[480px] (5") | max-w-[95vw] max-h-[95vh]     |  |
|  |              bg-[#060814]/75 backdrop-blur-2xl border border-white/20        |  |
|  |              rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-white/15  |  |
|  |                                                                              |  |
|  |  +-------------------------+  +-------------------------------------------+  |  |
|  |  | Left Sidebar: 192px     |  | Right Content Area: 384px                 |  |  |
|  |  | (w-48 h-full shrink-0)  |  | (flex-1 h-full p-3.5 flex flex-col)       |  |  |
|  |  | bg-black/40             |  | bg-black/20 backdrop-blur-md              |  |  |
|  |  | border-r border-white/10|  |                                           |  |  |
|  |  | p-3 flex flex-col       |  |  +-------------------------------------+  |  |  |
|  |  |                         |  |  | Top Header: Title + Subtitle + (X)   |  |  |  |
|  |  | [Branding / Icon Header]|  |  +-------------------------------------+  |  |  |
|  |  | [Navigation Tab Pills]  |  |  | Scrollable Canvas: h-[385px]        |  |  |  |
|  |  |                         |  |  | overflow-y-auto pr-1 scrollbar-thin |  |  |  |
|  |  |                         |  |  | [Dynamic Tab Cards & Controls]      |  |  |  |
|  |  | [Version / Status:v1.1.1|  |  +-------------------------------------+  |  |  |
|  |  |                         |  |  | Footer: Active Status + Done Action |  |  |  |
|  |  +-------------------------+  +-------------------------------------------+  |  |
|  +------------------------------------------------------------------------------+  |
+====================================================================================+
```

---

## 3. Tailwind CSS Reference Token Matrix

| Component | Standard CSS Classes | Notes |
| :--- | :--- | :--- |
| **Backdrop Overlay** | `fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm select-none p-2 sm:p-4 animate-in fade-in duration-200` | Center-aligned, translucent dimming |
| **Modal Container** | `w-[576px] max-w-[95vw] h-[480px] max-h-[95vh] bg-[#060814]/75 border border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-row overflow-hidden relative backdrop-blur-2xl ring-1 ring-white/15` | Exact 6" × 5", glass blur |
| **Left Sidebar** | `w-48 h-full bg-black/40 border-r border-white/10 p-3 flex flex-col justify-between shrink-0 backdrop-blur-xl` | 192px fixed width |
| **Active Nav Tab** | `bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white shadow-md shadow-cyan-600/30 border border-cyan-400/30` | Gradient highlight |
| **Inactive Nav Tab** | `text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all` | Subtle hover effect |
| **Right Content Pane**| `flex-1 h-full p-3.5 flex flex-col justify-between overflow-hidden bg-black/20 backdrop-blur-md` | 384px remaining width |
| **Tab Header** | `flex items-start justify-between pb-2 mb-2.5 border-b border-white/10` | Standardized header divider |
| **Inner Scroll Canvas**| `h-[385px] overflow-y-auto pr-1 flex flex-col justify-start gap-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent` | Never causes outer resize |
| **Metric Card** | `p-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] backdrop-blur-md` | Glass tile token |
| **Toggle Row** | `rounded-2xl p-3 bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3` | Standard switch container |
| **Modal Footer** | `pt-2 border-t border-white/10 flex items-center justify-between text-xs text-zinc-300` | Footer action bar |

---

## 4. Reusable Copy-Paste Blueprint for Future Modals

All future modals created in MorningTV must be instantiated using this exact template:

```tsx
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandardModalTemplate: React.FC<StandardModalProps> = ({ isOpen, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm select-none p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Exact 6in x 5in (576px x 480px) Dialog Container */}
      <div
        className="w-[576px] max-w-[95vw] h-[480px] max-h-[95vh] bg-[#060814]/75 border border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-row overflow-hidden relative backdrop-blur-2xl ring-1 ring-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Left Sidebar Navigation (192px) */}
        <div className="w-48 h-full bg-black/40 border-r border-white/10 p-3 flex flex-col justify-between shrink-0 backdrop-blur-xl">
          <div>
            {/* Branding Header */}
            <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/10">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                {/* Icon */}
              </div>
              <div>
                <h2 className="text-xs font-black text-white tracking-wider uppercase">MorningTV</h2>
                <p className="text-[10px] text-zinc-300 font-medium">Modal Title</p>
              </div>
            </div>

            {/* Nav Pills */}
            <nav className="flex flex-col gap-1 overflow-y-auto scrollbar-none">
              {/* Button items */}
            </nav>
          </div>

          {/* Bottom Info */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-[10px] text-zinc-400">Status</span>
            <span className="text-[9px] font-mono text-zinc-400 font-bold">v1.1.1</span>
          </div>
        </div>

        {/* 2. Right Content Panel (384px) */}
        <div className="flex-1 h-full p-3.5 flex flex-col justify-between overflow-hidden bg-black/20 backdrop-blur-md">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between pb-2 mb-2.5 border-b border-white/10">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide">Tab Heading</h3>
                <p className="text-[10px] text-zinc-300 mt-0.5 line-clamp-1">Tab description and guidance</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Canvas (Fixed 385px height) */}
            <div className="h-[385px] overflow-y-auto pr-1 flex flex-col justify-start gap-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {/* Body cards */}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-end text-xs text-zinc-300">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-all cursor-pointer border border-white/10 active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```
