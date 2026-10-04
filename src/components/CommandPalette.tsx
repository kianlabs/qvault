// QVAULT — command palette (WAVE4-CONTRACT §D.2).
// Ctrl+K / Cmd+K buka, Escape tutup, navigasi keyboard ↑↓ + Enter.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FolderTree,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Search,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { buildIndex, searchIndex, type SearchHit } from "../lib/search";
import { motionOK, popIn, staggerIn } from "../lib/motion";
import { cn } from "../lib/utils";
import { OPEN_PALETTE_EVENT } from "./Topbar";

const MODULE_ICON: Record<SearchHit["module"], LucideIcon> = {
  vault: KeyRound,
  note: NotebookPen,
  task: ListChecks,
  income: TrendingUp,
  folder: FolderTree,
  page: LayoutDashboard,
};

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Rebuild indeks tiap kali dibuka (baca state store saat itu juga).
  const index = useMemo(() => (open ? buildIndex() : []), [open]);

  // Hasil: query kosong → daftar halaman (shortcut); ada query → cari.
  const results = useMemo(() => {
    if (!query.trim()) return index.filter((h) => h.module === "page");
    return searchIndex(index, query, 8);
  }, [index, query]);

  // Reset pilihan tiap kali hasil berubah.
  useEffect(() => {
    setActive(0);
  }, [results]);

  // Shortcut global: Ctrl+K / Cmd+K buka-tutup, Escape tutup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Topbar memicu event ini; ini yang membuat search bar benar-benar bekerja.
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Autofocus + reset query saat dibuka, lalu animasikan panel masuk.
  useEffect(() => {
    if (open) {
      setQuery("");
      // fokus setelah portal ter-render.
      requestAnimationFrame(() => inputRef.current?.focus());
      if (motionOK) {
        popIn(panelRef.current);
        if (listRef.current) {
          staggerIn(listRef.current, ":scope > li", { y: 6, stagger: 0.02, duration: 0.2 });
        }
      }
    }
  }, [open]);

  // Jaga item aktif tetap terlihat.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = useCallback(() => setOpen(false), []);

  const choose = useCallback(
    (hit: SearchHit) => {
      navigate(hit.to);
      setOpen(false);
    },
    [navigate],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) =>
        results.length ? (a - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active];
      if (hit) choose(hit);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
      onMouseDown={close}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input pencarian */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search vault, notes, tasks…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">
            esc
          </kbd>
        </div>

        {/* Hasil */}
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            {query.trim() ? "No results" : "Type to search…"}
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
            {results.map((hit, i) => {
              const Icon = MODULE_ICON[hit.module];
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(hit)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                      i === active ? "bg-accent-soft" : "hover:bg-raised",
                    )}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-raised text-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {hit.title}
                      </span>
                      {hit.subtitle && (
                        <span className="block truncate text-xs text-muted">
                          {hit.subtitle}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                      {hit.module}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">
          ↑↓ navigate · ↵ open · esc close
        </div>
      </div>
    </div>,
    document.body,
  );
}
