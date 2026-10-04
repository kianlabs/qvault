// QVAULT — state dialog update.
//
// Satu sumber kebenaran untuk info rilis yang ditemukan, supaya pengecekan
// otomatis saat app dibuka dan tombol "Cek update" manual di Settings bisa
// membuka dialog yang sama.
import { create } from "zustand";
import type { UpdateInfo } from "../lib/updater";

interface UpdaterState {
  info: UpdateInfo | null;
  open: boolean;
  /** Tampilkan dialog untuk info rilis tertentu. */
  show: (info: UpdateInfo) => void;
  /** Tutup dialog (info tetap tersimpan sampai rilis lain ditemukan). */
  dismiss: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  info: null,
  open: false,
  show: (info) => set({ info, open: true }),
  dismiss: () => set({ open: false }),
}));
