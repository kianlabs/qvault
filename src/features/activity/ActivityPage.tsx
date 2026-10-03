// QVAULT — Activity (route "/activity"). Timeline from useActivityStore with
// module filtering and a confirm-gated clear.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  FolderTree,
  KeyRound,
  ListChecks,
  NotebookPen,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useActivityStore } from "../../store/useActivityStore";
import { useToast } from "../../components/Toast";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { cn, formatDateTime, formatRelative } from "../../lib/utils";
import type { ActivityEntry } from "../../lib/types";
import type { LucideIcon } from "lucide-react";

const MODULE_ICONS: Record<string, LucideIcon> = {
  security: ShieldCheck,
  vault: KeyRound,
  notes: NotebookPen,
  tasks: ListChecks,
  income: TrendingUp,
  folders: FolderTree,
  settings: SettingsIcon,
};

const TONES: Record<string, string> = {
  create: "text-emerald-400",
  update: "text-sky-400",
  delete: "text-red-400",
  init: "text-accent",
  unlock: "text-accent",
  lock: "text-amber-400",
};

export default function ActivityPage() {
  const toast = useToast();
  const items = useActivityStore((s) => s.items);
  const loading = useActivityStore((s) => s.loading);
  const error = useActivityStore((s) => s.error);
  const load = useActivityStore((s) => s.load);
  const clear = useActivityStore((s) => s.clear);

  const [module, setModule] = useState<string>("all");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void load(200);
  }, [load]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    for (const e of items) set.add(e.module);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (module === "all" ? items : items.filter((e) => e.module === module)),
    [items, module],
  );

  async function onClear() {
    try {
      await clear();
      toast.success("Activity log cleared");
    } catch {
      toast.error("Could not clear the activity log");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Activity</h1>
          <p className="mt-1 text-sm text-muted">
            A local audit trail of everything that changes in your vault.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load(200)}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:text-ink"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={items.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={module === "all"} onClick={() => setModule("all")}>
          All
        </FilterChip>
        {modules.map((m) => (
          <FilterChip key={m} active={module === m} onClick={() => setModule(m)}>
            {m}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity"
          hint="Actions like creating or editing items will be logged here."
        />
      ) : (
        <ol className="relative space-y-2 border-l border-line pl-6">
          {filtered.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Clear activity log?"
      >
        <p className="text-sm text-muted">
          This permanently removes all {items.length} activity entries. It cannot
          be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Clear log
          </button>
        </div>
      </Modal>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-sm capitalize transition",
        active
          ? "border-accent bg-accent-soft text-ink"
          : "border-line text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function TimelineRow({ entry }: { entry: ActivityEntry }) {
  const Icon = MODULE_ICONS[entry.module] ?? CheckCircle2;
  const tone = TONES[entry.action] ?? "text-muted";
  return (
    <li className="relative rounded-xl border border-line bg-elevated px-4 py-3">
      <span className="absolute -left-[31px] top-4 grid h-5 w-5 place-items-center rounded-full border border-line bg-surface">
        <Icon className={cn("h-3 w-3", tone)} />
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink">
          <span className="font-medium">{entry.action}</span>
          {entry.itemName && (
            <span className="text-muted"> · {entry.itemName}</span>
          )}
        </p>
        <span
          className="text-xs text-muted"
          title={formatDateTime(entry.createdAt)}
        >
          {formatRelative(entry.createdAt)}
        </span>
      </div>
      <p className="mt-0.5 text-xs capitalize text-muted">{entry.module}</p>
    </li>
  );
}
