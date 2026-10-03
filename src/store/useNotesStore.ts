// QVAULT — notes store (SPEC.md §5 B2).
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { Note, NoteListParams, NotePayload } from "../lib/types";

interface NotesState {
  items: Note[];
  loading: boolean;
  error: string | null;
  load: (params?: NoteListParams) => Promise<void>;
  create: (payload: NotePayload) => Promise<Note>;
  update: (id: string, payload: NotePayload) => Promise<Note>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<Note>;
  toggleFavorite: (id: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set) => ({
  items: [],
  loading: false,
  error: null,

  load: async (params) => {
    set({ loading: true, error: null });
    try {
      const items = await api.listNotes(params);
      set({ items, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  create: async (payload) => {
    set({ error: null });
    try {
      const note = await api.createNote(payload);
      set((s) => ({ items: [note, ...s.items] }));
      return note;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  update: async (id, payload) => {
    set({ error: null });
    try {
      const note = await api.updateNote(id, payload);
      set((s) => ({ items: s.items.map((it) => (it.id === id ? note : it)) }));
      return note;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteNote(id);
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  duplicate: async (id) => {
    set({ error: null });
    try {
      const note = await api.duplicateNote(id);
      set((s) => ({ items: [note, ...s.items] }));
      return note;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  toggleFavorite: async (id) => {
    set({ error: null });
    try {
      await api.toggleNoteFavorite(id);
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
