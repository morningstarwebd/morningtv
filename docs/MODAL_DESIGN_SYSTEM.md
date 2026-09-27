# MorningTV Modal & Dialog Design System Standard

This document establishes the official visual design standard, dimensional ratio, and architectural rules for all present and future modal windows, popovers, and settings dialogs across MorningTV.

---

## 1. Core Principles

1. **Rock-Solid Fixed Dimensions (Zero Jitter)**
   - All standard studio modals must maintain a fixed size of **`760px` width × `510px` height** (approx. 5 inches on standard 1080p desktop displays).
   - The outer shell size must **NEVER** dynamically shrink, grow, jump, or stretch when the user switches tabs or navigates views.

2. **Frosted Translucent Glassmorphism**
   - Translucent background (`#060814` at ~55% opacity) combined with `backdrop-blur-2xl`.
   - The background video must remain visible and legible behind the dialog.
   - Screen backdrop overlay must use lightweight `bg-black/25 backdrop-blur-sm`, avoiding heavy opaque blackouts.

3. **Zero Accidental Overflow / No Unwanted Scrollbars**
   - Diagnostics, metrics, and static views must fit 100% inside the viewport (`overflow-hidden`).
   - For variable-length data lists (such as playlists with thousands of channels), scrolling is strictly confined to the inner body area (`h-[350px] overflow-y-auto pr-1 scrollbar-thin`) without expanding the outer dialog.

---

## 2. Dimensional Blueprint & Token Architecture

```
+------------------------------------------------------------------------------------+
| Overlay: fixed inset-0 z-50 flex items-center justify-center                       |
|          bg-black/25 backdrop-blur-sm select-none p-3 sm:p-6                       |
|                                                                                    |
|  +------------------------------------------------------------------------------+  |
|  | Shell: w-[760px] max-w-[95vw] h-[510px] bg-[#060814]/55                     |  |
|  |        backdrop-blur-2xl border border-white/20 rounded-3xl                  |  |
|  |        shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-1 ring-white/15           |  |
|  |        flex flex-col md:flex-row overflow-hidden relative                    |  |
|  |                                                                              |  |
|  |  +-------------------------+  +-------------------------------------------+  |  |
|  |  | Left Sidebar            |  | Right Main Panel                          |  |  |
|  |  | w-full md:w-60 h-full   |  | flex-1 h-full p-4 sm:p-5 flex flex-col   |  |  |
|  |  | bg-black/40             |  | justify-between overflow-hidden           |  |  |
|  |  | border-r border-white/10|  | bg-black/20 backdrop-blur-md              |  |  |
|  |  | p-4 flex flex-col       |  |                                           |  |  |
|  |  | justify-between         |  |  +-------------------------------------+  |  |  |
|  |  |                         |  |  | Header: Title + Subtitle + Close (X) |  |  |  |
|  |  | [Branding Header]       |  |  +-------------------------------------+  |  |  |
|  |  | [Navigation Tabs]       |  |  | Body: h-[350px]                     |  |  |  |
|  |  |                         |  |  | (overflow-hidden or scrollbar-thin) |  |  |  |
|  |  | [Status Pill Footer]    |  |  +-------------------------------------+  |  |  |
|  |  |                         |  |  | Footer: Status + Done Action Button |  |  |  |
|  |  +-------------------------+  +-------------------------------------------+  |  |
|  +------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------+
```

---

## 3. Class Reference Guide

### A. Backdrop Overlay
```html
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm select-none p-3 sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
```

### B. Dialog Container Shell
```html
<div
  className="w-[760px] max-w-[95vw] h-[510px] bg-[#060814]/55 border border-white/20 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col md:flex-row overflow-hidden relative backdrop-blur-2xl ring-1 ring-white/15"
  onClick={(e) => e.stopPropagation()}
>
```

### C. Left Sidebar
```html
<div className="w-full md:w-60 h-full bg-black/40 border-b md:border-b-0 md:border-r border-white/10 p-4 flex flex-col justify-between shrink-0 backdrop-blur-xl">
  <div>
    <!-- Branding Header -->
    <div className="flex items-center gap-2.5 pb-4 mb-3 border-b border-white/10">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/40 border border-cyan-400/40 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
        <Icon className="w-4 h-4 text-cyan-300" />
      </div>
      <div>
        <h2 className="text-xs font-black text-white tracking-wider uppercase">Title</h2>
        <p className="text-[10px] text-zinc-300 font-medium">Subtitle</p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
      <!-- Active Item -->
      <button className="group flex items-center justify-between w-full p-2.5 rounded-xl text-left bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white shadow-md shadow-cyan-600/30 border border-cyan-400/30 cursor-pointer shrink-0">
        ...
      </button>
      <!-- Inactive Item -->
      <button className="group flex items-center justify-between w-full p-2.5 rounded-xl text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer shrink-0">
        ...
      </button>
    </nav>
  </div>

  <!-- Bottom System Status -->
  <div className="hidden md:flex items-center justify-between pt-3 border-t border-white/10">
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
      <span className="text-[10px] font-medium text-zinc-300">Live Status</span>
    </div>
    <span className="text-[9px] font-mono text-zinc-400 font-bold">v1.0.0</span>
  </div>
</div>
```

### D. Right Main Content Area
```html
<div className="flex-1 h-full p-4 sm:p-5 flex flex-col justify-between overflow-hidden bg-black/20 backdrop-blur-md">
  <div>
    <!-- Top Header -->
    <div className="flex items-start justify-between pb-2.5 mb-3 border-b border-white/10">
      <div>
        <h3 className="text-sm font-extrabold text-white tracking-wide">Section Header</h3>
        <p className="text-[11px] text-zinc-300 mt-0.5">Section description</p>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-full text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    <!-- Inner Content (Fixed 350px height) -->
    <div className="h-[350px] overflow-hidden">
      <!-- Or "h-[350px] overflow-y-auto pr-1 scrollbar-thin" if list requires scrolling -->
      ...
    </div>
  </div>

  <!-- Bottom Action Footer -->
  <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-zinc-300">
    <div>Left status or channel badge</div>
    <button
      type="button"
      onClick={onClose}
      className="px-4 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-all cursor-pointer border border-white/10 active:scale-95"
    >
      Done
    </button>
  </div>
</div>
```

---

## 4. Telemetry & Speed Calculations Standard

For any speed or network data display:
- **Mobile Byte Standard**: Always report speed in **`MB/s`** and **`KB/s`** (Megabytes / Kilobytes per second).
- **Bits to Bytes Formula**:
  $$\text{Speed (Bytes/s)} = \frac{\text{Bits/s}}{8}$$
- **Zero Placeholder Defense**: Live streams must never show `0 KB/s` when actively playing; fallback to the manifest nominal bitrate if fragment event latency is pending.

---

## 5. Implementations Reference
- [SettingsDialog.tsx](file:///d:/morningtv/src/components/SettingsDialog.tsx)
- [StreamQualityPopover.tsx](file:///d:/morningtv/src/components/StreamQualityPopover.tsx)
