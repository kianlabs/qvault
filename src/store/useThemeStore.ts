// QVAULT — theme store (Calm Precision).
//
// Sumber kebenaran tunggal untuk tema aktif di sisi UI. Nilai di-persist ke
// backend lewat settings API, tapi state lokal di sini membuat toggle terasa
// instan (optimistic) dan tetap benar walau settings belum selesai dimuat.
import { create } from "zustand";

import { api } from "../lib/api";
import type { Theme } from "../lib/types";

/** Tema keluarga gelap — dipakai untuk varian `dark` Tailwind & ikon toggle. */
const DARK_THEMES: Theme[] = ["dark", "slate", "nord"];

export function isDarkTheme(theme: Theme): boolean {
  return DARK_THEMES.includes(theme);
}

interface ThemeState {
  theme: Theme;
  /** Terapkan tema (optimistic) lalu simpan ke backend. */
  setTheme: (theme: Theme) => void;
  /** Tukar terang ⇄ gelap. Bila sedang di preset, kembali ke `dark`/`light`. */
  toggle: () => void;
  /** Sinkronkan dari settings yang dimuat backend (tanpa menulis balik). */
  sync: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",

  setTheme: (theme) => {
    set({ theme });
    void api.updateSettings({ theme }).catch(() => {
      /* diamkan: UI tetap responsif; settings akan tersinkron lagi */
    });
  },

  toggle: () => {
    const next: Theme = isDarkTheme(get().theme) ? "light" : "dark";
    get().setTheme(next);
  },

  sync: (theme) => set({ theme }),
}));
