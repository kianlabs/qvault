// QVAULT — Favorites (route "/favorites"). Aggregates favorites across the
// three favoritable stores: vault items, notes and folders.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FolderTree, KeyRound, NotebookPen, Star } from "lucide-react";
import { useVaultStore } from "../../store/useVaultStore";
import { useNotesStore } from "../../store/useNotesStore";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useToast } from "../../components/Toast";
import { cn, formatRelative } from "../../lib/utils";
import EmptyState from "../../components/EmptyState";

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Favorites</h1>
          <p className="mt-1 text-sm text-muted">
            Your starred items, notes and folders in one place.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm text-muted">
          <Star className="h-4 w-4 text-amber-400" />
          {total} starred
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-sm transition",
              tab === t.id
                ? "border-accent bg-accent-soft text-ink"
                : "border-line text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Star}
          title="No favorites yet"
          hint="Star a vault item, note or folder to pin it here."
        />
      ) : (
        <div className="space-y-8">
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
  icon: typeof KeyRound;
  to: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="h-4 w-4 text-accent" />
          {title}
        </h2>
        <Link to={to} className="text-xs text-muted transition hover:text-ink">
          Open
        </Link>
      </div>
      <ul className="space-y-2">{children}</ul>
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
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-elevated px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{title}</p>
        <p className="truncate text-xs text-muted">
          {subtitle} · {formatRelative(when)}
        </p>
      </div>
      <button
        type="button"
        onClick={onUnstar}
        aria-label="Remove from favorites"
        title="Remove from favorites"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-amber-400 transition hover:bg-white/5"
      >
        <Star className="h-4 w-4 fill-current" />
      </button>
    </li>
  );
}
