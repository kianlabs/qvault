// QVAULT — tasks store (SPEC.md §5 B2).
// Also owns `dashboard_stats` (tasks.rs), surfaced as stats/loadStats.
import { create } from "zustand";

import { api } from "../lib/api";
import { errorMessage } from "../lib/utils";
import type { DashboardStats, Task, TaskListParams, TaskPayload } from "../lib/types";

interface TasksState {
  items: Task[];
  loading: boolean;
  error: string | null;
  stats: DashboardStats | null;
  statsLoading: boolean;
  load: (params?: TaskListParams) => Promise<void>;
  create: (payload: TaskPayload) => Promise<Task>;
  update: (id: string, payload: TaskPayload) => Promise<Task>;
  remove: (id: string) => Promise<void>;
  /** Set the status column directly (todo | in_progress | done). */
  setStatus: (id: string, status: string) => Promise<Task>;
  /** Fetch the dashboard aggregate from `dashboard_stats`. */
  loadStats: () => Promise<void>;
}

export const useTasksStore = create<TasksState>((set) => ({
  items: [],
  loading: false,
  error: null,
  stats: null,
  statsLoading: false,

  load: async (params) => {
    set({ loading: true, error: null });
    try {
      const items = await api.listTasks(params);
      set({ items, loading: false });
    } catch (err) {
      set({ error: errorMessage(err), loading: false });
    }
  },

  create: async (payload) => {
    set({ error: null });
    try {
      const task = await api.createTask(payload);
      set((s) => ({ items: [task, ...s.items] }));
      return task;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  update: async (id, payload) => {
    set({ error: null });
    try {
      const task = await api.updateTask(id, payload);
      set((s) => ({ items: s.items.map((it) => (it.id === id ? task : it)) }));
      return task;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteTask(id);
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  setStatus: async (id, status) => {
    set({ error: null });
    try {
      const task = await api.setTaskStatus(id, status);
      set((s) => ({ items: s.items.map((it) => (it.id === id ? task : it)) }));
      return task;
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  loadStats: async () => {
    set({ statsLoading: true, error: null });
    try {
      const stats = await api.dashboardStats();
      set({ stats, statsLoading: false });
    } catch (err) {
      set({ error: errorMessage(err), statsLoading: false });
    }
  },
}));
