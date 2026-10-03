// QVAULT — folders store (SPEC.md §5 B2).
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { Folder, FolderKind, FolderPayload } from "../lib/types";

interface FoldersState {
  items: Folder[];
  loading: boolean;
  error: string | null;
  /** List folders, optionally filtered by kind ('password'|'note'|'both'). */
  load: (kind?: FolderKind) => Promise<void>;
  create: (payload: FolderPayload) => Promise<Folder>;
  update: (id: string, payload: FolderPayload) => Promise<Folder>;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

export const useFoldersStore = create<FoldersState>((set) => ({
  items: [],
  loading: false,
  error: null,

  load: async (kind) => {
    set({ loading: true, error: null });
    try {
      const items = await api.listFolders(kind);
      set({ items, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  create: async (payload) => {
    set({ error: null });
    try {
      const folder = await api.createFolder(payload);
      set((s) => ({ items: [folder, ...s.items] }));
      return folder;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  update: async (id, payload) => {
    set({ error: null });
    try {
      const folder = await api.updateFolder(id, payload);
      set((s) => ({ items: s.items.map((it) => (it.id === id ? folder : it)) }));
      return folder;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteFolder(id);
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  toggleFavorite: async (id) => {
    set({ error: null });
    try {
      await api.toggleFolderFavorite(id);
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
}));
