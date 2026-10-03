// QVAULT — Notes page. Uses useNotesStore + shared UI (FINAL-CONTRACT B/C/D).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useNotesStore } from "../../store/useNotesStore";
import type { Note, NotePayload } from "../../lib/types";
import { cn, formatRelative, parseTags, truncate } from "../../lib/utils";
import { renderMarkdown } from "../../lib/markdown";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const iconBtnCls =
  "grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink";

const EMPTY_FORM: NotePayload = {
  title: "",
  content: "",
  tags: [],
  folderId: null,
  favorite: false,
};

export default function NotesPage() {
  const toast = useToast();
  const {
    items,
    loading,
    error,
    load,
    create,
    update,
    remove,
    duplicate,
    toggleFavorite,
  } = useNotesStore();
  const { items: folders, load: loadFolders } = useFoldersStore();

  const [search, setSearch] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState<NotePayload>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Write / Preview toggle di editor (Wave 3).
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  const usableFolders = useMemo(
    () => folders.filter((f) => f.kind === "note" || f.kind === "both"),
    [folders],
  );
  const folderName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of folders) m.set(f.id, f.name);
    return m;
  }, [folders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((n) => {
      if (favoriteOnly && !n.favorite) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, search, favoriteOnly]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setTagsText("");
    setPreview(false);
    setOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setForm({
      title: note.title,
      content: note.content,
      tags: note.tags,
      folderId: note.folderId,
      favorite: note.favorite,
    });
    setTagsText(note.tags.join(", "));
    setPreview(false);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload: NotePayload = { ...form, tags: parseTags(tagsText) };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Note updated");
      } else {
        await create(payload);
        toast.success("Note created");
      }
      setOpen(false);
    } catch {
      toast.error("Could not save note");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleFavorite(note: Note) {
    try {
      await toggleFavorite(note.id);
    } catch {
      toast.error("Could not update favorite");
    }
  }

  async function onDuplicate(note: Note) {
    setBusyId(note.id);
    try {
      await duplicate(note.id);
      toast.success("Note duplicated");
    } catch {
      toast.error("Could not duplicate note");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(note: Note) {
    if (!window.confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    setBusyId(note.id);
    try {
      await remove(note.id);
      toast.success("Note deleted");
    } catch {
      toast.error("Could not delete note");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Notes</h1>
          <p className="text-xs text-muted">
            {filtered.length} of {items.length} note
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <Plus className="h-4 w-4" /> New note
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setFavoriteOnly((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
            favoriteOnly
              ? "border-accent bg-accent-soft text-ink"
              : "border-line text-muted hover:text-ink",
          )}
        >
          <Star className={cn("h-4 w-4", favoriteOnly && "fill-current")} />
          Favorites
        </button>
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
          icon={FileText}
          title="No notes"
          hint="Capture an idea, a snippet, or anything worth remembering."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <article
              key={note.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-elevated p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 text-sm font-semibold text-ink">
                  {note.title}
                </h3>
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(note)}
                  className={iconBtnCls}
                  aria-label="Toggle favorite"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      note.favorite && "fill-current text-amber-400",
                    )}
                  />
                </button>
              </div>

              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
                {truncate(note.content, 200) || "No content"}
              </p>

              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] text-ink"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-muted">
                <span className="truncate">
                  {folderName.get(note.folderId ?? "") ?? "Unfiled"} ·{" "}
                  {formatRelative(note.updatedAt)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(note)}
                    className={iconBtnCls}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDuplicate(note)}
                    className={iconBtnCls}
                    aria-label="Duplicate"
                  >
                    {busyId === note.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(note)}
                    className={cn(iconBtnCls, "hover:text-red-400")}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit note" : "New note"}
        className="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              className={inputCls}
              placeholder="Note title"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={cn(labelCls, "mb-0")}>Content</label>
              <div className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                    !preview ? "bg-accent text-white" : "text-muted hover:text-ink",
                  )}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                    preview ? "bg-accent text-white" : "text-muted hover:text-ink",
                  )}
                >
                  Preview
                </button>
              </div>
            </div>
            {preview ? (
              <div className="min-h-[12rem] rounded-xl border border-line bg-surface px-4 py-3">
                {form.content.trim() ? (
                  renderMarkdown(form.content)
                ) : (
                  <p className="text-sm text-muted">Nothing to preview yet.</p>
                )}
              </div>
            ) : (
              <textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={10}
                className={cn(inputCls, "font-mono leading-relaxed")}
                placeholder="Write anything… Markdown supported."
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Folder</label>
              <select
                value={form.folderId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, folderId: e.target.value || null }))
                }
                className={inputCls}
              >
                <option value="">No folder</option>
                {usableFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tags (comma separated)</label>
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className={inputCls}
                placeholder="ideas, work"
              />
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
              {editing ? "Save changes" : "Create note"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
