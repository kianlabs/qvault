// QVAULT — top bar (Calm Precision).
// Search sebelumnya adalah input mati (state tak pernah dipakai). Sekarang ia
// adalah tombol yang membuka Command Palette sungguhan via event global.
// Tombol tema menukar terang/gelap seketika.
import { useNavigate } from "react-router-dom";
import { Lock, Moon, Search, Sun } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { isDarkTheme, useThemeStore } from "../store/useThemeStore";
import { IconButton } from "./ui";

/** Nama event global untuk membuka Command Palette dari mana saja. */
export const OPEN_PALETTE_EVENT = "qvault:open-palette";

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

export default function Topbar() {
  const navigate = useNavigate();
  const lock = useAuthStore((s) => s.lock);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const dark = isDarkTheme(theme);

  async function handleLock() {
    try {
      await lock();
    } finally {
      navigate("/unlock", { replace: true });
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
        className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-line bg-elevated px-3 text-sm text-faint transition-colors duration-150 hover:border-line-strong hover:text-muted"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search vault, notes, tasks…</span>
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-faint">
          {isMac() ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <IconButton
          icon={dark ? Sun : Moon}
          label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        />
        <button
          type="button"
          onClick={handleLock}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3 text-sm text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
        >
          <Lock className="h-4 w-4" />
          Lock
        </button>
      </div>
    </header>
  );
}
