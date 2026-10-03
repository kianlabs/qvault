// QVAULT — command palette search index (WAVE4-CONTRACT §D.1).
// Bangun indeks dari state zustand saat ini. Pakai `.getState()` (bukan hook)
// supaya aman dipanggil dari event handler / luar render.
import { useVaultStore } from "../store/useVaultStore";
import { useNotesStore } from "../store/useNotesStore";
import { useTasksStore } from "../store/useTasksStore";
import { useIncomeStore } from "../store/useIncomeStore";
import { useFoldersStore } from "../store/useFoldersStore";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  module: "vault" | "note" | "task" | "income" | "folder" | "page";
  to: string; // route tujuan, mis. "/vault"
}

/** Entri statis untuk tiap halaman — muncul saat query kosong (shortcut). */
const PAGE_ENTRIES: SearchHit[] = [
  { id: "page:dashboard", title: "Dashboard", subtitle: "Page", module: "page", to: "/" },
  { id: "page:vault", title: "Vault", subtitle: "Page", module: "page", to: "/vault" },
  { id: "page:notes", title: "Notes", subtitle: "Page", module: "page", to: "/notes" },
  { id: "page:tasks", title: "Tasks", subtitle: "Page", module: "page", to: "/tasks" },
  { id: "page:calendar", title: "Calendar", subtitle: "Page", module: "page", to: "/calendar" },
  { id: "page:income", title: "Income", subtitle: "Page", module: "page", to: "/income" },
  { id: "page:folders", title: "Folders", subtitle: "Page", module: "page", to: "/folders" },
  { id: "page:favorites", title: "Favorites", subtitle: "Page", module: "page", to: "/favorites" },
  { id: "page:generator", title: "Generator", subtitle: "Page", module: "page", to: "/generator" },
  { id: "page:health", title: "Health", subtitle: "Page", module: "page", to: "/health" },
  { id: "page:activity", title: "Activity", subtitle: "Page", module: "page", to: "/activity" },
  { id: "page:settings", title: "Settings", subtitle: "Page", module: "page", to: "/settings" },
];

/** Bangun indeks dari store; pencarian substring case-insensitive atas title/subtitle. */
export function buildIndex(): SearchHit[] {
  const hits: SearchHit[] = [...PAGE_ENTRIES];

  // Vault items — subtitle = username · url.
  for (const it of useVaultStore.getState().items) {
    hits.push({
      id: `vault:${it.id}`,
      title: it.title,
      subtitle: [it.username, it.url].filter(Boolean).join(" · ") || "Vault item",
      module: "vault",
      to: "/vault",
    });
  }

  // Notes — subtitle = potongan konten (biar ada konteks).
  for (const n of useNotesStore.getState().items) {
    hits.push({
      id: `note:${n.id}`,
      title: n.title,
      subtitle: n.content.replace(/\s+/g, " ").trim().slice(0, 80) || "Note",
      module: "note",
      to: "/notes",
    });
  }

  // Tasks — subtitle = status.
  for (const t of useTasksStore.getState().items) {
    hits.push({
      id: `task:${t.id}`,
      title: t.title,
      subtitle: t.status.replace("_", " "),
      module: "task",
      to: "/tasks",
    });
  }

  // Income — subtitle = amount + currency.
  for (const inc of useIncomeStore.getState().items) {
    hits.push({
      id: `income:${inc.id}`,
      title: inc.source,
      subtitle: `${inc.currency} ${inc.amount}`,
      module: "income",
      to: "/income",
    });
  }

  // Folders — subtitle = kind.
  for (const f of useFoldersStore.getState().items) {
    hits.push({
      id: `folder:${f.id}`,
      title: f.name,
      subtitle: f.kind,
      module: "folder",
      to: "/folders",
    });
  }

  return hits;
}

/**
 * Cari di indeks. Skor: prefix title > contains title > contains subtitle.
 * Urut menurun, batasi `limit` (default 8).
 */
export function searchIndex(index: SearchHit[], q: string, limit = 8): SearchHit[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of index) {
    const title = hit.title.toLowerCase();
    const subtitle = hit.subtitle.toLowerCase();

    let score = 0;
    if (title.startsWith(query)) score = 3;
    else if (title.includes(query)) score = 2;
    else if (subtitle.includes(query)) score = 1;

    if (score > 0) scored.push({ hit, score });
  }

  // Sort stabil (V8 modern): skor menurun, lalu urutan asli dipertahankan.
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.hit);
}
