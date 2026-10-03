// QVAULT — Dashboard (route "/"). Read-only overview built from Wave-1 stores:
// useTasksStore (dashboard_stats), useIncomeStore (income_summary), useActivityStore.
// Wave 3 (Agent C): World clock, Vault protection, Recent credentials.
// UI overhaul: "Calm Precision" design system (presentation only — no logic change).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  FolderTree,
  KeyRound,
  Lock,
  Maximize2,
  Minimize2,
  NotebookPen,
  Settings as SettingsIcon,
  ShieldCheck,
  TrendingUp,
  Unlock,
} from "lucide-react";
import { useTasksStore } from "../../store/useTasksStore";
import { useIncomeStore } from "../../store/useIncomeStore";
import { useActivityStore } from "../../store/useActivityStore";
import { useVaultStore } from "../../store/useVaultStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelative,
  initials,
} from "../../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  IconButton,
  PageHeader,
  StatCard,
  type Tone,
} from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import WorldClock from "../../components/WorldClock";
import { exitFullscreen, isFullscreen, toggleFullscreen } from "../../lib/fullscreen";
import type { LucideIcon } from "lucide-react";

interface Tile {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  to: string;
}

/** Checklist keamanan vault (statis — sifat arsitektur, bukan state). */
const PROTECTION: { label: string }[] = [
  { label: "Argon2id" },
  { label: "AES-256-GCM" },
  { label: "Offline" },
];

/** Ikon per modul untuk feed aktivitas (satu arti = satu ikon). */
const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  security: ShieldCheck,
  vault: KeyRound,
  notes: NotebookPen,
  tasks: CalendarClock,
  income: TrendingUp,
  folders: FolderTree,
  settings: SettingsIcon,
};

/** Tone badge untuk status tugas. */
function taskTone(status: string): Tone {
  if (status === "done") return "success";
  if (status === "in_progress") return "info";
  return "neutral";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const stats = useTasksStore((s) => s.stats);
  const statsLoading = useTasksStore((s) => s.statsLoading);
  const loadStats = useTasksStore((s) => s.loadStats);
  const summary = useIncomeStore((s) => s.summary);
  const loadSummary = useIncomeStore((s) => s.loadSummary);
  const activity = useActivityStore((s) => s.items);
  const loadActivity = useActivityStore((s) => s.load);
  const vaultItems = useVaultStore((s) => s.items);
  const loadVault = useVaultStore((s) => s.load);
  const initialized = useAuthStore((s) => s.initialized);
  const locked = useAuthStore((s) => s.locked);

  // Full screen mode (WAVE5 §F.2): state lokal + sinkron saat mount.
  const [fs, setFs] = useState(false);
  useEffect(() => {
    void isFullscreen().then(setFs);
  }, []);

  // Escape keluar dari fullscreen — cuma dipasang saat fullscreen aktif.
  useEffect(() => {
    if (!fs) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void exitFullscreen().then(() => setFs(false));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fs]);

  useEffect(() => {
    void loadStats();
    void loadSummary();
    void loadActivity(8);
    void loadVault();
  }, [loadStats, loadSummary, loadActivity, loadVault]);

  const tiles: Tile[] = [
    {
      label: "Vault items",
      value: String(stats?.totalItems ?? 0),
      icon: KeyRound,
      tone: "accent",
      to: "/vault",
    },
    {
      label: "Notes",
      value: String(stats?.totalNotes ?? 0),
      icon: NotebookPen,
      tone: "info",
      to: "/notes",
    },
    {
      label: "Overdue",
      value: String(stats?.tasksOverdue ?? 0),
      icon: AlertTriangle,
      tone: "danger",
      to: "/tasks",
    },
    {
      label: "Due today",
      value: String(stats?.tasksToday ?? 0),
      icon: CalendarClock,
      tone: "warn",
      to: "/tasks",
    },
    {
      label: "Tasks done",
      value: String(stats?.tasksDone ?? 0),
      icon: CheckCircle2,
      tone: "success",
      to: "/tasks",
    },
    {
      label: "Income this month",
      value: formatCurrency(stats?.incomeThisMonth ?? summary?.thisMonth ?? 0),
      icon: TrendingUp,
      tone: "success",
      to: "/income",
    },
  ];

  const upcoming = stats?.upcomingTasks ?? [];

  // 5 credential terbaru (urut createdAt desc).
  const recentCredentials = useMemo(
    () =>
      [...vaultItems]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5),
    [vaultItems],
  );

  const statusLabel = !initialized ? "Not set up" : locked ? "Locked" : "Unlocked";
  const statusTone: Tone = !initialized ? "neutral" : locked ? "warn" : "success";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Everything at a glance — vault, notes, tasks and income."
        actions={
          <>
            <IconButton
              icon={fs ? Minimize2 : Maximize2}
              label={fs ? "Exit full screen" : "Full screen"}
              onClick={async () => setFs(await toggleFullscreen())}
            />
            <Button
              variant="primary"
              icon={ArrowRight}
              onClick={() => navigate("/generator")}
            >
              Generate password
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(({ label, value, icon, tone, to }) => (
          <StatCard
            key={label}
            label={label}
            value={statsLoading && !stats ? "…" : value}
            icon={icon}
            tone={tone}
            onClick={() => navigate(to)}
          />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader
            icon={ShieldCheck}
            title="Vault protection"
            action={<Badge tone={statusTone}>{statusLabel}</Badge>}
          />
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl",
                locked ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent",
              )}
            >
              {locked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {locked ? "Vault is locked" : "Vault is unlocked"}
              </p>
              <p className="text-xs text-muted">Encrypted at rest, decrypted in memory only.</p>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5">
            {PROTECTION.map((p) => (
              <li key={p.label} className="flex items-center gap-2 text-xs text-muted">
                <Check className="h-3.5 w-3.5 text-success" />
                {p.label}
              </li>
            ))}
          </ul>
        </Card>

        <WorldClock />
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-muted" />
            Recent credentials
          </h2>
          <Link
            to="/vault"
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            View all
          </Link>
        </div>
        {recentCredentials.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={KeyRound}
              title="No credentials yet"
              hint="Items you save will show up here."
            />
          </div>
        ) : (
          <ul>
            {recentCredentials.map((item) => (
              <li key={item.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => navigate("/vault")}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-strong">
                    {initials(item.title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{item.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {item.username || "—"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-muted" />
              Upcoming tasks
            </h2>
            <Link
              to="/tasks"
              className="text-xs text-muted transition-colors hover:text-ink"
            >
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={CalendarClock}
                title="No upcoming tasks"
                hint="Tasks with a due date will appear here."
              />
            </div>
          ) : (
            <ul>
              {upcoming.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{task.title}</p>
                    <p className="text-xs text-muted">
                      {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                    </p>
                  </div>
                  <Badge tone={taskTone(task.status)}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ActivityIcon className="h-4 w-4 text-muted" />
              Recent activity
            </h2>
            <Link
              to="/activity"
              className="text-xs text-muted transition-colors hover:text-ink"
            >
              View all
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ActivityIcon}
                title="Nothing yet"
                hint="Your recent changes will show up here."
              />
            </div>
          ) : (
            <ul>
              {activity.map((entry) => {
                const Icon = ACTIVITY_ICONS[entry.module] ?? ActivityIcon;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">
                          {entry.itemName || entry.module}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {entry.module} · {entry.action}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatRelative(entry.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
