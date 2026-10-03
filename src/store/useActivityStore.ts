// QVAULT — activity store (SPEC.md §5 B2).
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { ActivityEntry } from "../lib/types";

interface ActivityState {
  items: ActivityEntry[];
  loading: boolean;
  error: string | null;
  /** List activity entries, newest first (backend default when limit omitted). */
  load: (limit?: number) => Promise<void>;
  /** Wipe the whole activity log. */
  clear: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set) => ({
  items: [],
  loading: false,
  error: null,

  load: async (limit) => {
    set({ loading: true, error: null });
    try {
      const items = await api.listActivity(limit);
      set({ items, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  clear: async () => {
    set({ error: null });
    try {
      await api.clearActivity();
      set({ items: [] });
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },
}));
