// QVAULT — Folders page. Uses useFoldersStore + shared UI (FINAL-CONTRACT B/C/D).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Folder as FolderIcon,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";

import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useVaultStore } from "../../store/useVaultStore";
import { useNotesStore } from "../../store/useNotesStore";
import type { Folder, FolderKind, FolderPayload } from "../../lib/types";
import { cn, formatDate } from "../../lib/utils";

const VIEW_KEY = "qvault.foldersView";
type ViewMode = "grid" | "list";

/** Baca preferensi tampilan dari localStorage (default "grid"). */
function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const iconBtnCls =
  "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink";

const COLORS = [
  "#7c5cff",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
];

const KIND_LABEL: Record<FolderKind, string> = {
  password: "Passwords",
  note: "Notes",
  both: "Both",
};

const EMPTY_FORM: FolderPayload = {
  name: "",
  color: COLORS[0],
  kind: "both",
  parentId: null,
  favorite: false,
};

export default function FoldersPage() {
  const toast = useToast();
  const { items, loading, error, load, create, update, remove, toggleFavorite } =
    useFoldersStore();
  // Untuk menghitung "jumlah" item per folder di tampilan List.
  const { items: vaultItems, load: loadVault } = useVaultStore();
  const { items: noteItems, load: loadNotes } = useNotesStore();

  const [filter, setFilter] = useState<"all" | FolderKind>("all");
  // Grid/List toggle (Wave 3) — persist di localStorage.
  const [view, setView] = useState<ViewMode>(readView);

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // localStorage tidak tersedia — abaikan.
    }
  }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Folder | null>(null);
  const [form, setForm] = useState<FolderPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadVault();
    void loadNotes();
  }, [load, loadVault, loadNotes]);

  /** Jumlah item (vault + notes) yang berada di sebuah folder. */
  const itemCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of vaultItems) {
      if (it.folderId) m.set(it.folderId, (m.get(it.folderId) ?? 0) + 1);
    }
    for (const n of noteItems) {
      if (n.folderId) m.set(n.folderId, (m.get(n.folderId) ?? 0) + 1);
    }
    return m;
  }, [vaultItems, noteItems]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((f) => f.kind === filter)),
    [items, filter],
  );

  const parentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of items) m.set(f.id, f.name);
    return m;
  }, [items]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(folder: Folder) {
    setEditing(folder);
    setForm({
      name: folder.name,
      color: folder.color || COLORS[0],
      kind: folder.kind,
      parentId: folder.parentId,
      favorite: folder.favorite,
    });
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const payload: FolderPayload = { ...form };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Folder updated");
      } else {
        await create(payload);
        toast.success("Folder created");
      }
      setOpen(false);
    } catch {
      toast.error("Could not save folder");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleFavorite(folder: Folder) {
    try {
      await toggleFavorite(folder.id);
    } catch {
      toast.error("Could not update favorite");
    }
  }

  async function onDelete(folder: Folder) {
    if (!window.confirm(`Delete "${folder.name}"? This cannot be undone.`)) return;
    setBusyId(folder.id);
    try {
      await remove(folder.id);
      toast.success("Folder deleted");
    } catch {
      toast.error("Could not delete folder");
    } finally {
      setBusyId(null);
    }
  }

  const parentOptions = items.filter((f) => f.id !== editing?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Folders</h1>
          <p className="text-xs text-muted">
            {filtered.length} of {items.length} folder
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => changeView("grid")}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg transition",
                view === "grid" ? "bg-accent text-white" : "text-muted hover:text-ink",
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView("list")}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg transition",
                view === "list" ? "bg-accent text-white" : "text-muted hover:text-ink",
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:text-ink"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New folder
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-elevated p-1">
        {(["all", "password", "note", "both"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              filter === k
                ? "bg-accent text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {k === "all" ? "All" : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="grid place-items-center py-16 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title="No folders"
          hint="Create folders to group your passwords and notes."
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((folder) => (
            <article
              key={folder.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-elevated p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                  style={{ backgroundColor: folder.color || COLORS[0] }}
                >
                  <FolderIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {folder.name}
                    </h3>
                    {folder.favorite && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {KIND_LABEL[folder.kind]} · {itemCount.get(folder.id) ?? 0} item
                    {(itemCount.get(folder.id) ?? 0) === 1 ? "" : "s"}
                    {folder.parentId && parentName.get(folder.parentId)
                      ? ` · in ${parentName.get(folder.parentId)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(folder)}
                  className={iconBtnCls}
                  aria-label="Toggle favorite"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      folder.favorite && "fill-current text-amber-400",
                    )}
                  />
                </button>
              </div>

              <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-muted">
                <span>Created {formatDate(folder.createdAt)}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(folder)}
                    className={iconBtnCls}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(folder)}
                    className={cn(iconBtnCls, "hover:text-red-400")}
                    aria-label="Delete"
                  >
                    {busyId === folder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((folder) => {
            const count = itemCount.get(folder.id) ?? 0;
            return (
              <li
                key={folder.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-elevated px-4 py-3"
              >
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                  style={{ backgroundColor: folder.color || COLORS[0] }}
                >
                  <FolderIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {folder.name}
                    </p>
                    {folder.favorite && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-400" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {KIND_LABEL[folder.kind]} · {count} item
                    {count === 1 ? "" : "s"}
                    {folder.parentId && parentName.get(folder.parentId)
                      ? ` · in ${parentName.get(folder.parentId)}`
                      : ""}
                  </p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted sm:block">
                  {formatDate(folder.createdAt)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void onToggleFavorite(folder)}
                    className={iconBtnCls}
                    aria-label="Toggle favorite"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        folder.favorite && "fill-current text-amber-400",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(folder)}
                    className={iconBtnCls}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(folder)}
                    className={cn(iconBtnCls, "hover:text-red-400")}
                    aria-label="Delete"
                  >
                    {busyId === folder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit folder" : "New folder"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Name</label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className={inputCls}
              placeholder="e.g. Work"
            />
          </div>

          <div>
            <label className={labelCls}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn(
                    "h-8 w-8 rounded-lg border-2 transition",
                    form.color === c
                      ? "border-ink"
                      : "border-transparent hover:border-line",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kind</label>
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value as FolderKind }))
                }
                className={inputCls}
              >
                <option value="both">Both</option>
                <option value="password">Passwords</option>
                <option value="note">Notes</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Parent folder</label>
              <select
                value={form.parentId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentId: e.target.value || null }))
                }
                className={inputCls}
              >
                <option value="">None</option>
                {parentOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(e) =>
                setForm((f) => ({ ...f, favorite: e.target.checked }))
              }
            />
            Mark as favorite
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create folder"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
