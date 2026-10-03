// QVAULT — data store (WAVE3-CONTRACT.md §B). Mengelola template note/task
// yang dipakai di Settings → Data. Pola zustand sama dengan store lain.
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { Template, TemplatePayload } from "../lib/types";

interface DataState {
  templates: Template[];
  loading: boolean;
  error: string | null;
  /** Muat semua template (`list_templates`). */
  loadTemplates: () => Promise<void>;
  /** Simpan template baru (`save_template`). */
  saveTemplate: (p: TemplatePayload) => Promise<void>;
  /** Hapus template by id (`delete_template`). */
  removeTemplate: (id: string) => Promise<void>;
}

export const useDataStore = create<DataState>((set) => ({
  templates: [],
  loading: false,
  error: null,

  loadTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await api.listTemplates();
      set({ templates, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  saveTemplate: async (p) => {
    set({ error: null });
    try {
      const template = await api.saveTemplate(p);
      set((s) => ({ templates: [template, ...s.templates] }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  removeTemplate: async (id) => {
    set({ error: null });
    try {
      await api.deleteTemplate(id);
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },
}));
