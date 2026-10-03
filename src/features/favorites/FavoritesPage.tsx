// QVAULT — Favorites (route "/favorites"). Aggregates favorites across the
// three favoritable stores: vault items, notes and folders.
// UI overhaul: "Calm Precision" design system (presentation only — no logic change).
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FolderTree, KeyRound, NotebookPen, Star } from "lucide-react";
import { useVaultStore } from "../../store/useVaultStore";
import { useNotesStore } from "../../store/useNotesStore";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useToast } from "../../components/Toast";
import { formatRelative } from "../../lib/utils";
import { Card, IconButton, PageHeader, RowActions, Tabs } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import type { LucideIcon } from "lucide-react";

type Tab = "all" | "vault" | "notes" | "folders";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vault", label: "Vault" },
  { id: "notes", label: "Notes" },
  { id: "folders", label: "Folders" },
];

export default function FavoritesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");

  const vaultItems = useVaultStore((s) => s.items);
  const loadVault = useVaultStore((s) => s.load);
  const toggleVaultFav = useVaultStore((s) => s.toggleFavorite);

  const notes = useNotesStore((s) => s.items);
  const loadNotes = useNotesStore((s) => s.load);
  const toggleNoteFav = useNotesStore((s) => s.toggleFavorite);

  const folders = useFoldersStore((s) => s.items);
  const loadFolders = useFoldersStore((s) => s.load);
  const toggleFolderFav = useFoldersStore((s) => s.toggleFavorite);

  useEffect(() => {
    void loadVault({ favoriteOnly: true });
    void loadNotes({ favoriteOnly: true });
    void loadFolders();
  }, [loadVault, loadNotes, loadFolders]);

  const favFolders = folders.filter((f) => f.favorite);
  const favVault = tab === "all" || tab === "vault" ? vaultItems : [];
  const favNotes = tab === "all" || tab === "notes" ? notes : [];
  const showFolders = tab === "all" || tab === "folders";
  const visibleFolders = showFolders ? favFolders : [];

  const total = favVault.length + favNotes.length + visibleFolders.length;

  async function unfavoriteVault(id: string) {
    try {
      await toggleVaultFav(id);
      toast.success("Removed from favorites");
    } catch {
      /* store holds the error */
    }
  }
  async function unfavoriteNote(id: string) {
    try {
      await toggleNoteFav(id);
      toast.success("Removed from favorites");
    } catch {
      /* store holds the error */
    }
  }
  async function unfavoriteFolder(id: string) {
    try {
      await toggleFolderFav(id);
      toast.success("Removed from favorites");
    } catch {
      /* store holds the error */
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Favorites"
        subtitle="Your starred items, notes and folders in one place."
      />

      <Tabs
        items={TABS.map((t) => ({ value: t.id, label: t.label }))}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {total === 0 ? (
        <EmptyState
          icon={Star}
          title="No favorites yet"
          hint="Star a vault item, note or folder to pin it here."
        />
      ) : (
        <div className="space-y-6">
          {favVault.length > 0 && (
            <Section title="Vault items" icon={KeyRound} to="/vault">
              {favVault.map((item) => (
                <Row
                  key={item.id}
                  title={item.title || "(untitled)"}
                  subtitle={item.username || item.url || "—"}
                  when={item.updatedAt}
                  onUnstar={() => unfavoriteVault(item.id)}
                />
              ))}
            </Section>
          )}

          {favNotes.length > 0 && (
            <Section title="Notes" icon={NotebookPen} to="/notes">
              {favNotes.map((note) => (
                <Row
                  key={note.id}
                  title={note.title || "(untitled)"}
                  subtitle={note.content ? `${note.content.length} chars` : "Empty"}
                  when={note.updatedAt}
                  onUnstar={() => unfavoriteNote(note.id)}
                />
              ))}
            </Section>
          )}

          {visibleFolders.length > 0 && (
            <Section title="Folders" icon={FolderTree} to="/folders">
              {visibleFolders.map((folder) => (
                <Row
                  key={folder.id}
                  title={folder.name || "(unnamed)"}
                  subtitle={folder.kind}
                  when={folder.updatedAt}
                  onUnstar={() => unfavoriteFolder(folder.id)}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  to,
  children,
}: {
  title: string;
  icon: LucideIcon;
  to: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="h-4 w-4 text-muted" />
          {title}
        </h2>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
        >
          Open
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <Card padding="none">
        <ul>{children}</ul>
      </Card>
    </section>
  );
}

function Row({
  title,
  subtitle,
  when,
  onUnstar,
}: {
  title: string;
  subtitle: string;
  when: string;
  onUnstar: () => void;
}) {
  return (
    <li className="group flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-raised">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{title}</p>
        <p className="truncate text-xs text-muted">
          {subtitle} · {formatRelative(when)}
        </p>
      </div>
      <RowActions>
        <IconButton
          icon={Star}
          label="Remove from favorites"
          onClick={onUnstar}
          className="text-warn"
        />
      </RowActions>
    </li>
  );
}
