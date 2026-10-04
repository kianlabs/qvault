// QVAULT — Vault (passwords) page. Uses useVaultStore + Calm Precision UI.
// Lapisan tampilan saja: seluruh state/handler/store dipertahankan identik.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";

import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import PasswordStrength from "../../components/PasswordStrength";
import TotpField from "../../components/TotpField";
import { useToast } from "../../components/Toast";
import {
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
  type MenuItem,
} from "../../components/ui";
import { secureCopy } from "../../lib/clipboard";
import { staggerIn, useGsap } from "../../lib/motion";
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
  const src = !showIcons || broken ? null : item.icon || faviconUrl(item.url);
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

  // Entrance motion (presentation only): the vault grid/list items cascade in.
  // Grid: cards are direct children. List: rows sit inside the Card wrapper.
  // Re-runs when the visible set or view mode changes; no state is touched.
  const listRef = useRef<HTMLDivElement>(null);
  useGsap(() => {
    const selector = view === "grid" ? ":scope > *" : ":scope > * > *";
    staggerIn(listRef.current, selector, { y: 8, stagger: 0.03 });
  }, [filtered, view]);

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

  /** Aksi sekunder per baris (ikon soup dipindah ke menu "⋯"). */
  function rowMenu(item: VaultItem, shown: string | undefined): MenuItem[] {
    const base: MenuItem[] = [
      {
        label: shown ? "Hide password" : "Reveal password",
        icon: shown ? EyeOff : Eye,
        onClick: () => void onReveal(item),
      },
    ];
    if (item.username) {
      base.push({
        label: "Copy username",
        icon: Copy,
        onClick: () => void onCopyUsername(item),
      });
    }
    base.push(
      {
        label: item.favorite ? "Remove from favorites" : "Add to favorites",
        icon: Star,
        onClick: () => void onToggleFavorite(item),
      },
      { label: "Edit", icon: Pencil, onClick: () => openEdit(item) },
      {
        label: "Delete",
        icon: busyId === item.id ? Loader2 : Trash2,
        onClick: () => void onDelete(item),
        danger: true,
        disabled: busyId === item.id,
      },
    );
    return base;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vault"
        subtitle={`${filtered.length} of ${items.length} item${
          items.length === 1 ? "" : "s"
        }`}
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => void load()}
              disabled={loading}
            />
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New item
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vault…"
          />
        </div>
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="field w-auto"
          aria-label="Filter by folder"
        >
          <option value="">All folders</option>
          {usableFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <Button
          variant={favoriteOnly ? "primary" : "secondary"}
          icon={Star}
          onClick={() => setFavoriteOnly((v) => !v)}
        >
          Favorites
        </Button>
        <Tabs
          items={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
          ]}
          value={view}
          onChange={(v) => changeView(v as ViewMode)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-xs text-danger">
          {error}
        </div>
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
          action={
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New item
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div
          ref={listRef}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map((item) => {
            const shown = revealed[item.id];
            return (
              <Card
                key={item.id}
                padding="md"
                className="group flex flex-col gap-3"
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
                        <Star
                          className="h-3.5 w-3.5 shrink-0 fill-current text-warn"
                          aria-hidden
                        />
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
                  <RowActions>
                    <IconButton
                      icon={KeyRound}
                      label="Copy password"
                      onClick={() => void onCopyPassword(item)}
                    />
                    <Menu items={rowMenu(item, shown)} label="Item actions" />
                  </RowActions>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div ref={listRef}>
          <Card padding="none" className="overflow-hidden">
            {filtered.map((item) => {
              const shown = revealed[item.id];
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-0 hover:bg-raised"
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
                        <Star
                          className="h-3.5 w-3.5 shrink-0 fill-current text-warn"
                          aria-hidden
                        />
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
                    <p className="text-xs text-muted">
                      {formatDate(item.updatedAt)}
                    </p>
                    <p className="font-mono text-xs text-ink">
                      {shown ? shown : "••••••••"}
                    </p>
                  </div>

                  <RowActions>
                    <IconButton
                      icon={KeyRound}
                      label="Copy password"
                      onClick={() => void onCopyPassword(item)}
                    />
                    <Menu items={rowMenu(item, shown)} label="Item actions" />
                  </RowActions>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit item" : "New item"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. GitHub"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Username">
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder="you@example.com"
              />
            </Field>
            <Field label="URL">
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://…"
              />
            </Field>
          </div>

          <Field label="Password">
            <div className="flex gap-2">
              <Input
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="flex-1 font-mono"
                placeholder="••••••••"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    password: generatePassword({ length: 20 }),
                  }))
                }
              >
                Generate
              </Button>
            </div>
          </Field>
          <PasswordStrength password={form.password} />

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
                placeholder="work, personal"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              className="field"
              placeholder="Optional notes…"
            />
          </Field>

          {/* 2FA hanya tampil untuk item yang sudah tersimpan (punya id). */}
          {editing && (
            <TotpField
              itemId={editing.id}
              hasTotp={editing.hasTotp}
              onChanged={() => void load()}
            />
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">Mark as favorite</span>
            <Toggle
              checked={form.favorite}
              onChange={(v) => setForm((f) => ({ ...f, favorite: v }))}
              label="Mark as favorite"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              icon={saving ? Loader2 : undefined}
            >
              {editing ? "Save changes" : "Add item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
