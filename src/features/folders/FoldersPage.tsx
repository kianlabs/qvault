// QVAULT — Folders page. Uses useFoldersStore + shared UI (Calm Precision).
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Folder as FolderIcon,
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
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Menu,
  PageHeader,
  RowActions,
  Tabs,
  Toggle,
} from "../../components/ui";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useVaultStore } from "../../store/useVaultStore";
import { useNotesStore } from "../../store/useNotesStore";
import type { Folder, FolderKind, FolderPayload } from "../../lib/types";
import { cn, formatDate } from "../../lib/utils";
import { staggerIn, useGsap } from "../../lib/motion";

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

  // Entrance motion (presentation only) — cascade folder cards/rows on mount, filter or view change.
  const gridRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useGsap(() => {
    staggerIn(gridRef.current ?? listRef.current, ":scope > *", { y: 8, stagger: 0.03 });
  }, [filtered, view]);

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
      <PageHeader
        title="Folders"
        subtitle={`${filtered.length} of ${items.length} folder${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Tabs
              items={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
              ]}
              value={view}
              onChange={(v) => changeView(v as ViewMode)}
            />
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => void load()}
              className={cn(loading && "[&>svg]:animate-spin")}
            />
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New folder
            </Button>
          </>
        }
      />

      <Tabs
        items={[
          { value: "all", label: "All" },
          { value: "password", label: KIND_LABEL.password },
          { value: "note", label: KIND_LABEL.note },
          { value: "both", label: KIND_LABEL.both },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as "all" | FolderKind)}
      />

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-2 text-xs text-danger">
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
          action={
            <Button variant="secondary" icon={Plus} onClick={openCreate}>
              New folder
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((folder) => {
            const count = itemCount.get(folder.id) ?? 0;
            return (
              <Card key={folder.id} padding="md" className="group flex flex-col gap-3">
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
                      {busyId === folder.id && (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {KIND_LABEL[folder.kind]} · {count} item
                      {count === 1 ? "" : "s"}
                      {folder.parentId && parentName.get(folder.parentId)
                        ? ` · in ${parentName.get(folder.parentId)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      icon={Star}
                      label={
                        folder.favorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      onClick={() => void onToggleFavorite(folder)}
                      className={cn(
                        folder.favorite &&
                          "text-warn hover:bg-warn-soft hover:text-warn [&>svg]:fill-current",
                      )}
                    />
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Edit folder"
                        onClick={() => openEdit(folder)}
                      />
                      <Menu
                        label="More actions"
                        items={[
                          {
                            label: "Delete",
                            icon: Trash2,
                            onClick: () => void onDelete(folder),
                            danger: true,
                            disabled: busyId === folder.id,
                          },
                        ]}
                      />
                    </RowActions>
                  </div>
                </div>

                <div className="mt-auto pt-1 text-xs text-muted">
                  Created {formatDate(folder.createdAt)}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padding="none">
          <ul ref={listRef}>
            {filtered.map((folder) => {
              const count = itemCount.get(folder.id) ?? 0;
              return (
                <li
                  key={folder.id}
                  className="group flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-0 hover:bg-raised"
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
                      <Badge tone="neutral">{KIND_LABEL[folder.kind]}</Badge>
                      {busyId === folder.id && (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {count} item{count === 1 ? "" : "s"}
                      {folder.parentId && parentName.get(folder.parentId)
                        ? ` · in ${parentName.get(folder.parentId)}`
                        : ""}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted sm:block">
                    {formatDate(folder.createdAt)}
                  </span>
                  <RowActions className="shrink-0">
                    <IconButton
                      icon={Star}
                      label={
                        folder.favorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      onClick={() => void onToggleFavorite(folder)}
                      className={cn(
                        folder.favorite &&
                          "text-warn hover:bg-warn-soft hover:text-warn [&>svg]:fill-current",
                      )}
                    />
                    <IconButton
                      icon={Pencil}
                      label="Edit folder"
                      onClick={() => openEdit(folder)}
                    />
                    <Menu
                      label="More actions"
                      items={[
                        {
                          label: "Delete",
                          icon: Trash2,
                          onClick: () => void onDelete(folder),
                          danger: true,
                          disabled: busyId === folder.id,
                        },
                      ]}
                    />
                  </RowActions>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit folder" : "New folder"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Work"
            />
          </Field>

          <Field label="Color">
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
                      : "border-transparent hover:border-line-strong",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={form.color === c}
                />
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value as FolderKind }))
                }
                className="field"
              >
                <option value="both">Both</option>
                <option value="password">Passwords</option>
                <option value="note">Notes</option>
              </select>
            </Field>
            <Field label="Parent folder">
              <select
                value={form.parentId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentId: e.target.value || null }))
                }
                className="field"
              >
                <option value="">None</option>
                {parentOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink">Mark as favorite</span>
            <Toggle
              checked={form.favorite}
              onChange={(v) => setForm((f) => ({ ...f, favorite: v }))}
              label="Mark as favorite"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create folder"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
