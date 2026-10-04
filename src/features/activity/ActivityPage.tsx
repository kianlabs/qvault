// QVAULT — Activity (route "/activity"). Timeline from useActivityStore with
// module filtering and a confirm-gated clear.
// UI overhaul: "Calm Precision" design system (presentation only — no logic change).
import { useEffect, useMemo, useRef, useState } from "react";
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
  TrendingUp,
} from "lucide-react";
import { useActivityStore } from "../../store/useActivityStore";
import { useToast } from "../../components/Toast";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { cn, formatDateTime, formatRelative } from "../../lib/utils";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Tabs,
  type Tone,
} from "../../components/ui";
import type { ActivityEntry } from "../../lib/types";
import type { LucideIcon } from "lucide-react";
import { staggerIn, useGsap } from "../../lib/motion";

const MODULE_ICONS: Record<string, LucideIcon> = {
  security: ShieldCheck,
  vault: KeyRound,
  notes: NotebookPen,
  tasks: ListChecks,
  income: TrendingUp,
  folders: FolderTree,
  settings: SettingsIcon,
};

/** Satu aksi = satu makna warna (Calm Precision). */
const ACTION_TONES: Record<string, Tone> = {
  create: "success",
  update: "info",
  delete: "danger",
  init: "accent",
  unlock: "accent",
  lock: "warn",
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

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of items) map.set(e.module, (map.get(e.module) ?? 0) + 1);
    return map;
  }, [items]);

  const filtered = useMemo(
    () => (module === "all" ? items : items.filter((e) => e.module === module)),
    [items, module],
  );

  // Entrance motion (presentation only) — cascade timeline rows on mount/filter change.
  const listRef = useRef<HTMLUListElement>(null);
  useGsap(() => {
    staggerIn(listRef.current, ":scope > *", { y: 8, stagger: 0.03 });
  }, [filtered]);

  const tabs = useMemo(
    () => [
      { value: "all", label: "All", count: items.length },
      ...modules.map((m) => ({ value: m, label: m, count: counts.get(m) ?? 0 })),
    ],
    [modules, counts, items.length],
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
      <PageHeader
        title="Activity"
        subtitle="A local audit trail of everything that changes in your vault."
        actions={
          <>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => void load(200)}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="danger"
              icon={ActivityIcon}
              onClick={() => setConfirming(true)}
              disabled={items.length === 0}
            >
              Clear
            </Button>
          </>
        }
      />

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Tabs items={tabs} value={module} onChange={setModule} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity"
          hint="Actions like creating or editing items will be logged here."
        />
      ) : (
        <Card padding="none">
          <ul ref={listRef}>
            {filtered.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </Card>
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
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onClear}>
            Clear log
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function TimelineRow({ entry }: { entry: ActivityEntry }) {
  const Icon = MODULE_ICONS[entry.module] ?? CheckCircle2;
  const tone = ACTION_TONES[entry.action] ?? "neutral";
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-raised">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-raised text-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">
          {entry.itemName || entry.module}
        </p>
        <p className="truncate text-xs capitalize text-muted">{entry.module}</p>
      </div>
      <Badge tone={tone}>{entry.action}</Badge>
      <span
        className={cn("shrink-0 text-[11px] text-muted")}
        title={formatDateTime(entry.createdAt)}
      >
        {formatRelative(entry.createdAt)}
      </span>
    </li>
  );
}
