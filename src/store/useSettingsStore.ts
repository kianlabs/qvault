// QVAULT — settings store (SPEC.md §5 B2).
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { Settings, SettingsPayload } from "../lib/types";

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  /** Fetch current settings (`get_settings`). */
  load: () => Promise<void>;
  /** Persist a partial update (`update_settings`), merging into local state. */
  update: (payload: SettingsPayload) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await api.getSettings();
      set({ settings, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  update: async (payload) => {
    set({ error: null });
    try {
      await api.updateSettings(payload);
      set((s) => ({
        settings: s.settings ? { ...s.settings, ...payload } : s.settings,
      }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },
}));
