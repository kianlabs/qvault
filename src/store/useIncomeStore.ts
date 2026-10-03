// QVAULT — income store (SPEC.md §5 B2).
// Also owns `income_summary`, surfaced as summary/loadSummary.
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type {
  Income,
  IncomeListParams,
  IncomePayload,
  IncomeSummary,
} from "../lib/types";

interface IncomeState {
  items: Income[];
  loading: boolean;
  error: string | null;
  summary: IncomeSummary | null;
  summaryLoading: boolean;
  load: (params?: IncomeListParams) => Promise<void>;
  create: (payload: IncomePayload) => Promise<Income>;
  update: (id: string, payload: IncomePayload) => Promise<Income>;
  remove: (id: string) => Promise<void>;
  /** Fetch thisMonth / allTime / byMonth aggregate. */
  loadSummary: () => Promise<void>;
}

export const useIncomeStore = create<IncomeState>((set) => ({
  items: [],
  loading: false,
  error: null,
  summary: null,
  summaryLoading: false,

  load: async (params) => {
    set({ loading: true, error: null });
    try {
      const items = await api.listIncome(params);
      set({ items, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  create: async (payload) => {
    set({ error: null });
    try {
      const entry = await api.createIncome(payload);
      set((s) => ({ items: [entry, ...s.items] }));
      return entry;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  update: async (id, payload) => {
    set({ error: null });
    try {
      const entry = await api.updateIncome(id, payload);
      set((s) => ({ items: s.items.map((it) => (it.id === id ? entry : it)) }));
      return entry;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteIncome(id);
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  loadSummary: async () => {
    set({ summaryLoading: true, error: null });
    try {
      const summary = await api.incomeSummary();
      set({ summary, summaryLoading: false });
    } catch (err) {
      set({ error: errorMessage(err), summaryLoading: false });
    }
  },
}));
