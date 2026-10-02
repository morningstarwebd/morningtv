# MorningTV Modal & Dialog Design System Standard (v1.1.2)

This document establishes the official visual design standard, dimensional metrics, and architectural layout rules for all present and future modal windows, popovers, diagnostics panels, and settings dialogs across **MorningTV**.

---

## 1. Core Principles & Spacious Dimensions

1. **Rock-Solid Fixed Studio Proportions: 760px (Width) × 520px (Height)**
   - **Width (Left-to-Right):** $\mathbf{760\text{px}}$ (`w-[760px] max-w-[95vw]` / approx. 7.9-8 inches).
   - **Height (Top-to-Bottom):** $\mathbf{520\text{px}}$ (`h-[520px] max-h-[92vh]` / approx. 5.4 inches).
   - Both the **Settings Window** (`SettingsDialog.tsx`) and **Stream Speed / Diagnostics Window** (`StreamQualityPopover.tsx`) use this exact identical spacious dimension.
   - **Zero Cropping & Zero Jitter Rule:** At 760px × 520px, high-density telemetry meters, channel counters, and multi-line descriptions have full breathing room and **never** get cropped, clipped, or wrapped awkwardly.

2. **Absolute Screen-Centered Positioning**
   - Whether displayed on a 15-inch laptop, a 24-inch desktop monitor, or an ultrawide display:
     - Overlay positioning: `fixed inset-0 z-50 flex items-center justify-center`
     - The window is locked dead in the center horizontally and vertically across the entire viewport.

3. **Two-Column Studio Grid Layout**
   - **Left Sidebar:** Locked to exactly $\mathbf{240\text{px}}$ (`w-[240px] min-w-[240px] max-w-[240px] h-full shrink-0 select-none`)
     - Contains App Branding / Logo (`w-8 h-8`), Navigation Pills with permanent borders to prevent wobble, and System Status / App Version (`v1.1.2`).
   - **Right Content Panel:** Fills the remaining $\mathbf{\sim 520\text{px}}$ (`flex-1 min-w-0 h-full p-4 sm:p-5`)
     - Contains Tab Title & Description Header, Close Button (`X`), Inner Scroll Canvas (`h-[395px]`), and Action Footer.

4. **Frosted Translucent Glassmorphism**
   - Outer Container: `bg-[#060814]/75` with `backdrop-blur-2xl`, `border border-white/20`, `rounded-3xl`, `shadow-[0_30px_90px_rgba(0,0,0,0.85)]`, and `ring-1 ring-white/15`.
   - Backdrop Overlay: Lightweight `bg-black/30 backdrop-blur-sm select-none p-3 sm:p-6 animate-in fade-in duration-200`. The underlying live TV video remains subtly visible and ambient behind the window.

5. **Strict Inner Scroll Boundaries & Zero Jitter Rule**
   - The outer modal and sidebar must never scroll (`overflow-hidden`).
   - Tab buttons have permanent 1px border (`border border-transparent` vs `border-cyan-400/40`) and `transition-colors duration-150` to prevent layout shaking on click.
   - All tab body contents scroll inside the dedicated inner container with stable scrollbar gutter:
     `h-[395px] overflow-y-auto pr-1 flex flex-col justify-start gap-3 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent`.

---

## 2. Dimensional Blueprint (760px × 520px)

```
+====================================================================================+
| Screen Overlay: fixed inset-0 z-50 flex items-center justify-center                |
|                 bg-black/30 backdrop-blur-sm select-none p-3 sm:p-6                |
|                                                                                    |
|  +------------------------------------------------------------------------------+  |
|  | Outer Shell: w-[760px] × h-[520px] | max-w-[95vw] max-h-[92vh]               |  |
|  |              bg-[#060814]/75 backdrop-blur-2xl border border-white/20        |  |
|  |              rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-white/15  |  |
|  |                                                                              |  |
|  |  +-------------------------+  +-------------------------------------------+  |  |
|  |  | Left Sidebar: 240px     |  | Right Content Area: ~520px                |  |  |
|  |  | w-[240px] shrink-0      |  | (flex-1 min-w-0 h-full p-4 sm:p-5)        |  |  |
|  |  | bg-black/40             |  | bg-black/20 backdrop-blur-md              |  |  |
|  |  | border-r border-white/10|  |                                           |  |  |
|  |  | p-3.5 sm:p-4            |  |  +-------------------------------------+  |  |  |
|  |  |                         |  |  | Top Header: Title + Subtitle + (X)   |  |  |  |
|  |  | [Branding / Icon Header]|  |  +-------------------------------------+  |  |  |
|  |  | [Navigation Tab Pills]  |  |  | Scrollable Canvas: h-[395px]        |  |  |  |
|  |  | (zero jitter border)    |  |  | [scrollbar-gutter:stable]              |  |  |
|  |  |                         |  |  | [Spacious Dynamic Cards & Metrics]   |  |  |  |
|  |  | [Version / Status:v1.1.2|  |  +-------------------------------------+  |  |  |
|  |  |                         |  |  | Footer: Active Status + Done Action |  |  |  |
|  |  +-------------------------+  +-------------------------------------------+  |  |
|  +------------------------------------------------------------------------------+  |
+====================================================================================+
```

---

## 3. Tailwind CSS Reference Token Matrix

| Component | Standard CSS Classes | Notes |
| :--- | :--- | :--- |
| **Backdrop Overlay** | `fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm select-none p-3 sm:p-6 animate-in fade-in duration-200` | Center-aligned on any display |
| **Modal Container** | `w-[760px] max-w-[95vw] h-[520px] max-h-[92vh] bg-[#060814]/75 border border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-row overflow-hidden relative backdrop-blur-2xl ring-1 ring-white/15` | Spacious 760px × 520px studio proportion |
| **Left Sidebar** | `w-[240px] min-w-[240px] max-w-[240px] h-full bg-black/40 border-r border-white/10 p-3.5 sm:p-4 flex flex-col justify-between shrink-0 backdrop-blur-xl select-none` | Exactly 240px wide, zero layout shifting |
| **Active Nav Tab** | `border border-cyan-400/40 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white shadow-md shadow-cyan-600/30 transition-colors duration-150` | Gradient highlight with permanent 1px border |
| **Inactive Nav Tab** | `border border-transparent text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors duration-150` | Permanent transparent border prevents 1px jumping |
| **Right Content Pane**| `flex-1 min-w-0 h-full p-4 sm:p-5 flex flex-col justify-between overflow-hidden bg-black/20 backdrop-blur-md` | ~520px remaining width |
| **Tab Header** | `flex items-start justify-between pb-2.5 mb-3 border-b border-white/10` | Standardized header divider |
| **Inner Scroll Canvas**| `h-[395px] overflow-y-auto pr-1 flex flex-col justify-start gap-3 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent` | Stable scrollbar prevents right-to-left layout push |
| **Metric Card** | `p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.1] backdrop-blur-md` | Glass tile token |
| **Toggle Row** | `rounded-2xl p-3 bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3` | Standard switch container |
| **Modal Footer** | `pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-zinc-300` | Footer action bar |

---

## 4. Reusable Copy-Paste Blueprint for Future Modals

All future modals created in MorningTV must be instantiated using this exact template:

```tsx
import React, { useEffect } from 'react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm select-none p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Exact 760px x 520px Dialog Container */}
      <div
        className="w-[760px] max-w-[95vw] h-[520px] max-h-[92vh] bg-[#060814]/75 border border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-row overflow-hidden relative backdrop-blur-2xl ring-1 ring-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Left Sidebar Navigation (Locked to 240px - Zero Jitter) */}
        <div className="w-[240px] min-w-[240px] max-w-[240px] h-full bg-black/40 border-r border-white/10 p-3.5 sm:p-4 flex flex-col justify-between shrink-0 backdrop-blur-xl select-none">
          <div>
            {/* Branding Header */}
            <div className="flex items-center gap-2.5 pb-4 mb-3 border-b border-white/10">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                {/* Icon */}
              </div>
              <div>
                <h2 className="text-xs font-black text-white tracking-wider uppercase">MorningTV</h2>
                <p className="text-[10px] text-zinc-300 font-medium">Modal Title</p>
              </div>
            </div>

            {/* Nav Pills (Overflow hidden + stable borders) */}
            <nav className="flex flex-col gap-1.5 overflow-hidden">
              {/* Button items: border border-transparent vs border-cyan-400/40 */}
            </nav>
          </div>

          {/* Bottom Info */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <span className="text-[10px] text-zinc-400">Status</span>
            <span className="text-[9px] font-mono text-zinc-400 font-bold">v1.1.2</span>
          </div>
        </div>

        {/* 2. Right Content Panel (~520px) */}
        <div className="flex-1 min-w-0 h-full p-4 sm:p-5 flex flex-col justify-between overflow-hidden bg-black/20 backdrop-blur-md">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between pb-2.5 mb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-extrabold text-white tracking-wide">Tab Heading</h3>
                <p className="text-[11px] text-zinc-300 mt-0.5">Tab description and guidance</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Canvas (Spacious 395px height with stable scrollbar) */}
            <div className="h-[395px] overflow-y-auto pr-1 flex flex-col justify-start gap-3 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {/* Body cards */}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-2.5 border-t border-white/10 flex items-center justify-end text-xs text-zinc-300">
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
