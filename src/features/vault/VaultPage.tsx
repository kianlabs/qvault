// QVAULT — Vault (passwords) page. Uses useVaultStore + shared UI (FINAL-CONTRACT B/C/D).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  List,
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
import PasswordStrength from "../../components/PasswordStrength";
import TotpField from "../../components/TotpField";
import { useToast } from "../../components/Toast";
import { secureCopy } from "../../lib/clipboard";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useVaultStore } from "../../store/useVaultStore";
import type { VaultItem, VaultItemPayload } from "../../lib/types";
import {
  cn,
  formatDate,
  generatePassword,
  hostnameFromUrl,
  initials,
  parseTags,
} from "../../lib/utils";
import { faviconUrl } from "../../lib/favicon";

const VIEW_KEY = "qvault.vaultView";
type ViewMode = "grid" | "list";

/** Baca preferensi tampilan dari localStorage (default "list"). */
function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const iconBtnCls =
  "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink";

const EMPTY_FORM: VaultItemPayload = {
  title: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: [],
  folderId: null,
  favorite: false,
  icon: null,
  totp: null,
};

/**
 * Avatar item vault: pakai `icon` bila ada, lalu favicon situs, lalu inisial.
 * `onIconError` dipanggil saat <img> gagal → parent menandai URL rusak.
 * Wave 5 — saat `showIcons` false, lewati ikon/favicon: langsung inisial.
 */
function VaultAvatar({
  item,
  size = "md",
  broken = false,
  showIcons = true,
  onIconError,
}: {
  item: VaultItem;
  size?: "md" | "lg";
  broken?: boolean;
  showIcons?: boolean;
  onIconError?: () => void;
}) {
  const src =
    !showIcons || broken ? null : item.icon || faviconUrl(item.url);
  const box = size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  if (src) {
    return (
      <div
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden bg-accent-soft",
          box,
        )}
      >
        <img
          src={src}
          alt=""
          className="h-6 w-6 object-contain"
          onError={onIconError}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center bg-accent-soft font-semibold text-ink",
        box,
        size === "lg" ? "text-base" : "text-sm",
      )}
    >
      {initials(item.title)}
    </div>
  );
}

export default function VaultPage() {
  const toast = useToast();
  const {
    items,
    loading,
    error,
    load,
    create,
    update,
    remove,
    toggleFavorite,
    revealPassword,
  } = useVaultStore();
  const { items: folders, load: loadFolders } = useFoldersStore();
  // Wave 4 — durasi auto-clear clipboard dari settings (fallback 30s).
  const clipboardClearSec =
    useSettingsStore((s) => s.settings?.clipboardClearSec) ?? 30;
  // Wave 5 — tampilkan favicon situs di avatar daftar (fallback true).
  const showIcons = useSettingsStore((s) => s.settings?.showIcons ?? true);

  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [form, setForm] = useState<VaultItemPayload>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Grid/List toggle (Wave 3) — persist di localStorage.
  const [view, setView] = useState<ViewMode>(readView);
  // URL favicon yang gagal dimuat → fallback ke inisial.
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // localStorage tidak tersedia — abaikan, tetap pakai state in-memory.
    }
  }

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  const usableFolders = useMemo(
    () => folders.filter((f) => f.kind === "password" || f.kind === "both"),
    [folders],
  );
  const folderName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of folders) m.set(f.id, f.name);
    return m;
  }, [folders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (favoriteOnly && !it.favorite) return false;
      if (folderId && it.folderId !== folderId) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.username.toLowerCase().includes(q) ||
        it.url.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, search, favoriteOnly, folderId]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setTagsText("");
    setOpen(true);
  }

  function openEdit(item: VaultItem) {
    setEditing(item);
    setForm({
      title: item.title,
      username: item.username,
      password: item.password,
      url: item.url,
      notes: item.notes,
      tags: item.tags,
      folderId: item.folderId,
      favorite: item.favorite,
      icon: item.icon,
      // 2FA tidak di-preload (secret tidak pernah dikirim ke frontend).
      totp: null,
    });
    setTagsText(item.tags.join(", "));
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload: VaultItemPayload = { ...form, tags: parseTags(tagsText) };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Item updated");
      } else {
        await create(payload);
        toast.success("Item added");
      }
      setOpen(false);
    } catch {
      toast.error("Could not save item");
    } finally {
      setSaving(false);
    }
  }

  async function onReveal(item: VaultItem) {
    if (revealed[item.id]) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[item.id];
        return next;
      });
      return;
    }
    try {
      const pw = await revealPassword(item.id);
      setRevealed((r) => ({ ...r, [item.id]: pw }));
    } catch {
      toast.error("Could not reveal password");
    }
  }

  async function onCopyPassword(item: VaultItem) {
    try {
      const pw = revealed[item.id] ?? (await revealPassword(item.id));
      await secureCopy(pw, clipboardClearSec);
      toast.success(`Password copied · clears in ${clipboardClearSec}s`);
    } catch {
      toast.error("Could not copy password");
    }
  }

  async function onCopyUsername(item: VaultItem) {
    try {
      await secureCopy(item.username, clipboardClearSec);
      toast.success(`Username copied · clears in ${clipboardClearSec}s`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  async function onToggleFavorite(item: VaultItem) {
    try {
      await toggleFavorite(item.id);
    } catch {
      toast.error("Could not update favorite");
    }
  }

  async function onDelete(item: VaultItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      await remove(item.id);
      toast.success("Item deleted");
    } catch {
      toast.error("Could not delete item");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Vault</h1>
          <p className="text-xs text-muted">
            {filtered.length} of {items.length} item
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={iconBtnCls}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vault…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
        >
          <option value="">All folders</option>
          {usableFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
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
          icon={KeyRound}
          title="No vault items"
          hint="Add a password to start securing your credentials."
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const shown = revealed[item.id];
            return (
              <article
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-elevated p-4"
              >
                <div className="flex items-start gap-3">
                  <VaultAvatar
                    item={item}
                    size="lg"
                    showIcons={showIcons}
                    broken={brokenIcons[item.id]}
                    onIconError={() =>
                      setBrokenIcons((b) => ({ ...b, [item.id]: true }))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-ink">
                        {item.title}
                      </h3>
                      {item.favorite && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-400" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {item.username || "—"}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {item.url ? hostnameFromUrl(item.url) : "no url"}
                      {item.folderId && folderName.get(item.folderId)
                        ? ` · ${folderName.get(item.folderId)}`
                        : ""}
                    </p>
                  </div>
                </div>

                <p className="font-mono text-xs text-ink">
                  {shown ? shown : "••••••••"}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-line pt-2">
                  <span className="text-[11px] text-muted">
                    {formatDate(item.updatedAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void onReveal(item)}
                      className={iconBtnCls}
                      aria-label={shown ? "Hide password" : "Reveal password"}
                    >
                      {shown ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCopyPassword(item)}
                      className={iconBtnCls}
                      aria-label="Copy password"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleFavorite(item)}
                      className={iconBtnCls}
                      aria-label="Toggle favorite"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          item.favorite && "fill-current text-amber-400",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className={iconBtnCls}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(item)}
                      className={cn(iconBtnCls, "hover:text-red-400")}
                      aria-label="Delete"
                    >
                      {busyId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const shown = revealed[item.id];
            return (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-elevated px-4 py-3"
              >
                <VaultAvatar
                  item={item}
                  showIcons={showIcons}
                  broken={brokenIcons[item.id]}
                  onIconError={() =>
                    setBrokenIcons((b) => ({ ...b, [item.id]: true }))
                  }
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {item.title}
                    </p>
                    {item.favorite && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-400" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {item.username || "—"}
                    {item.url ? ` · ${hostnameFromUrl(item.url)}` : ""}
                    {item.folderId && folderName.get(item.folderId)
                      ? ` · ${folderName.get(item.folderId)}`
                      : ""}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right md:block">
                  <p className="text-xs text-muted">{formatDate(item.updatedAt)}</p>
                  <p className="font-mono text-xs text-ink">
                    {shown ? shown : "••••••••"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void onReveal(item)}
                    className={iconBtnCls}
                    aria-label={shown ? "Hide password" : "Reveal password"}
                  >
                    {shown ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  {item.username && (
                    <button
                      type="button"
                      onClick={() => void onCopyUsername(item)}
                      className={iconBtnCls}
                      aria-label="Copy username"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onCopyPassword(item)}
                    className={iconBtnCls}
                    aria-label="Copy password"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onToggleFavorite(item)}
                    className={iconBtnCls}
                    aria-label="Toggle favorite"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        item.favorite && "fill-current text-amber-400",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className={iconBtnCls}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(item)}
                    className={cn(iconBtnCls, "hover:text-red-400")}
                    aria-label="Delete"
                  >
                    {busyId === item.id ? (
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
        title={editing ? "Edit item" : "New item"}
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
              placeholder="e.g. GitHub"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Username</label>
              <input
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className={labelCls}>URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className={inputCls}
                placeholder="https://…"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className={cn(inputCls, "flex-1 font-mono")}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    password: generatePassword({ length: 20 }),
                  }))
                }
                className="rounded-xl border border-line px-3 text-xs text-muted transition hover:text-ink"
              >
                Generate
              </button>
            </div>
            <div className="mt-2">
              <PasswordStrength password={form.password} />
            </div>
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
                placeholder="work, personal"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              className={inputCls}
              placeholder="Optional notes…"
            />
          </div>

          {/* 2FA hanya tampil untuk item yang sudah tersimpan (punya id). */}
          {editing && (
            <TotpField
              itemId={editing.id}
              hasTotp={editing.hasTotp}
              onChanged={() => void load()}
            />
          )}

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
              {editing ? "Save changes" : "Add item"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
