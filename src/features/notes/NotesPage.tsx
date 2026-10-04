// QVAULT — Notes page. Uses useNotesStore + shared UI (Calm Precision).
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  FileText,
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
  SearchInput,
  Tabs,
  Toggle,
} from "../../components/ui";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useNotesStore } from "../../store/useNotesStore";
import type { Note, NotePayload } from "../../lib/types";
import { cn, formatRelative, parseTags, truncate } from "../../lib/utils";
import { renderMarkdown } from "../../lib/markdown";
import { staggerIn, useGsap } from "../../lib/motion";

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

  // Entrance motion (presentation only) — cascade the note cards on mount/filter change.
  const listRef = useRef<HTMLDivElement>(null);
  useGsap(() => {
    staggerIn(listRef.current, ":scope > *", { y: 8, stagger: 0.03 });
  }, [filtered]);

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
      <PageHeader
        title="Notes"
        subtitle={`${filtered.length} of ${items.length} note${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => void load()}
              className={cn(loading && "[&>svg]:animate-spin")}
            />
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New note
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
          />
        </div>
        <Tabs
          items={[
            { value: "all", label: "All" },
            { value: "favorites", label: "Favorites" },
          ]}
          value={favoriteOnly ? "favorites" : "all"}
          onChange={(v) => setFavoriteOnly(v === "favorites")}
        />
      </div>

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
          icon={FileText}
          title="No notes"
          hint="Capture an idea, a snippet, or anything worth remembering."
          action={
            <Button variant="secondary" icon={Plus} onClick={openCreate}>
              New note
            </Button>
          }
        />
      ) : (
        <div ref={listRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((note) => (
            <Card key={note.id} padding="md" className="group flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="line-clamp-1 text-sm font-semibold text-ink">
                    {note.title}
                  </h3>
                  {busyId === note.id && (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    icon={Star}
                    label={
                      note.favorite ? "Remove from favorites" : "Add to favorites"
                    }
                    onClick={() => void onToggleFavorite(note)}
                    className={cn(
                      note.favorite &&
                        "text-warn hover:bg-warn-soft hover:text-warn [&>svg]:fill-current",
                    )}
                  />
                  <RowActions>
                    <IconButton
                      icon={Pencil}
                      label="Edit note"
                      onClick={() => openEdit(note)}
                    />
                    <Menu
                      label="More actions"
                      items={[
                        {
                          label: "Duplicate",
                          icon: Copy,
                          onClick: () => void onDuplicate(note),
                          disabled: busyId === note.id,
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          onClick: () => void onDelete(note),
                          danger: true,
                          disabled: busyId === note.id,
                        },
                      ]}
                    />
                  </RowActions>
                </div>
              </div>

              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
                {truncate(note.content, 200) || "No content"}
              </p>

              {note.tags.filter((t) => t.toLowerCase() !== "note").length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags
                    .filter((t) => t.toLowerCase() !== "note")
                    .map((t) => (
                      <Badge key={t} tone="accent">
                        {t}
                      </Badge>
                    ))}
                </div>
              )}

              <div className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted">
                <span className="truncate">
                  {folderName.get(note.folderId ?? "") ?? "Unfiled"} ·{" "}
                  {formatRelative(note.updatedAt)}
                </span>
              </div>
            </Card>
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
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Note title"
            />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Content</span>
              <Tabs
                items={[
                  { value: "write", label: "Write" },
                  { value: "preview", label: "Preview" },
                ]}
                value={preview ? "preview" : "write"}
                onChange={(v) => setPreview(v === "preview")}
              />
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
                className="field font-mono leading-relaxed"
                placeholder="Write anything… Markdown supported."
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Folder">
              <select
                value={form.folderId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, folderId: e.target.value || null }))
                }
                className="field"
              >
                <option value="">No folder</option>
                {usableFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags (comma separated)">
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="ideas, work"
              />
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
              {editing ? "Save changes" : "Create note"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
