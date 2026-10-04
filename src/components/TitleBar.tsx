// QVAULT — application title bar (custom window chrome).
//
// Strip gelap full-width yang menjadi identitas shell (paritas KeepR):
// wordmark di kiri, pintu masuk pencarian global (Command Palette) di tengah,
// dan kontrol jendela di kanan. Menggantikan dekorasi native
// (tauri.conf.json → decorations:false) sehingga chrome gelap menyatu dengan
// area kerja terang di bawahnya.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { KeyRound, Minus, Search, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { OPEN_PALETTE_EVENT } from "../lib/events";

/** Ambil window Tauri; null saat berjalan di browser (mis. `bun run dev`). */
function currentWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

function isMac() {
  return (
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
  );
}

export default function TitleBar() {
  const openPalette = () =>
    window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));

  const onMinimize = () => void currentWindow()?.minimize().catch(() => {});
  const onMaximize = () => void currentWindow()?.toggleMaximize().catch(() => {});
  const onClose = () => void currentWindow()?.close().catch(() => {});

  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 select-none items-center gap-3 border-b border-black/50 bg-[#131519] px-3"
    >
      {/* Wordmark — area drag untuk memindahkan jendela. */}
      <div data-tauri-drag-region className="flex items-center gap-2 pl-1">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent">
          <KeyRound className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-white">
          QVAULT
        </span>
      </div>

      {/* Pencarian global → membuka Command Palette. */}
      <button
        type="button"
        onClick={openPalette}
        className="mx-auto flex h-7 w-full max-w-md items-center gap-2 rounded-full bg-white/5 px-3 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
          {isMac() ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      {/* Kontrol jendela. */}
      <div className="flex items-center gap-0.5">
        <WinButton label="Minimize" onClick={onMinimize}>
          <Minus className="h-3.5 w-3.5" />
        </WinButton>
        <WinButton label="Maximize" onClick={onMaximize}>
          <Square className="h-3 w-3" />
        </WinButton>
        <WinButton label="Close" danger onClick={onClose}>
          <X className="h-4 w-4" />
        </WinButton>
      </div>
    </header>
  );
}

function WinButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-8 w-9 place-items-center rounded-md text-white/55 transition-colors",
        danger
          ? "hover:bg-danger hover:text-white"
          : "hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
