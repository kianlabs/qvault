// QVAULT — auth store (SPEC.md §5 B2).
// Exposes { initialized, locked, unlock(pw), init(pw), lock(), refreshStatus() }.
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";

interface AuthState {
  initialized: boolean;
  locked: boolean;
  loading: boolean;
  error: string | null;
  /** Pesan bila backend berjalan dengan DB in-memory sementara (data tidak persisten). */
  degraded: string | null;
  /** Derive key + decrypt DEK into backend memory. */
  unlock: (password: string) => Promise<void>;
  /** Create DEK + verifier on a fresh vault, then leave it unlocked. */
  init: (password: string) => Promise<void>;
  /** Clear the in-memory key. */
  lock: () => Promise<void>;
  /** Re-read `vault_status` from the backend. */
  refreshStatus: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  locked: true,
  loading: false,
  error: null,
  degraded: null,

  unlock: async (password) => {
    set({ loading: true, error: null });
    try {
      await api.unlockVault(password);
      set({ locked: false, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
      throw err;
    }
  },

  init: async (password) => {
    set({ loading: true, error: null });
    try {
      await api.initVault(password);
      set({ initialized: true, locked: false, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
      throw err;
    }
  },

  lock: async () => {
    set({ loading: true, error: null });
    try {
      await api.lockVault();
      set({ locked: true, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
      throw err;
    }
  },

  refreshStatus: async () => {
    try {
      const status = await api.vaultStatus();
      set({
        initialized: status.initialized,
        locked: status.locked,
        degraded: status.degraded ?? null,
      });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },
}));
