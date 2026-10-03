// QVAULT — vault items store (SPEC.md §5 B2).
// Standard shape: { items, loading, error, load(), create(), update(), remove(), ... }.
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { VaultItem, VaultItemPayload, VaultListParams } from "../lib/types";

interface VaultState {
  items: VaultItem[];
  loading: boolean;
  error: string | null;
  /** List items with optional search / folder / favorite filters. */
  load: (params?: VaultListParams) => Promise<void>;
  create: (payload: VaultItemPayload) => Promise<VaultItem>;
  update: (id: string, payload: VaultItemPayload) => Promise<VaultItem>;
  remove: (id: string) => Promise<void>;
  /** Flip the favorite flag (reloads the list afterwards). */
  toggleFavorite: (id: string) => Promise<void>;
  /** Reveal a stored password (returns plaintext; never cached in state). */
  revealPassword: (id: string) => Promise<string>;
}

export const useVaultStore = create<VaultState>((set) => ({
  items: [],
  loading: false,
  error: null,

  load: async (params) => {
    set({ loading: true, error: null });
    try {
      const items = await api.listVaultItems(params);
      set({ items, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  create: async (payload) => {
    set({ error: null });
    try {
      const item = await api.createVaultItem(payload);
      set((s) => ({ items: [item, ...s.items] }));
      return item;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  update: async (id, payload) => {
    set({ error: null });
    try {
      const item = await api.updateVaultItem(id, payload);
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? item : it)),
      }));
      return item;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteVaultItem(id);
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  toggleFavorite: async (id) => {
    set({ error: null });
    try {
      await api.toggleVaultFavorite(id);
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, favorite: !it.favorite } : it,
        ),
      }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  revealPassword: async (id) => {
    try {
      return await api.revealVaultPassword(id);
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },
}));
