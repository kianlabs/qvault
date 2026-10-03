// QVAULT — Dashboard (route "/"). Read-only overview built from Wave-1 stores:
// useTasksStore (dashboard_stats), useIncomeStore (income_summary), useActivityStore.
// Wave 3 (Agent C): World clock, Vault protection, Recent credentials.
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  KeyRound,
  ListChecks,
  Lock,
  NotebookPen,
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
import EmptyState from "../../components/EmptyState";
import WorldClock from "../../components/WorldClock";
import type { LucideIcon } from "lucide-react";

interface Tile {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  to: string;
}

/** Checklist keamanan vault (statis — sifat arsitektur, bukan state). */
const PROTECTION: { label: string }[] = [
  { label: "Argon2id" },
  { label: "AES-256-GCM" },
  { label: "Offline" },
];

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
      tone: "text-accent",
      to: "/vault",
    },
    {
      label: "Notes",
      value: String(stats?.totalNotes ?? 0),
      icon: NotebookPen,
      tone: "text-sky-400",
      to: "/notes",
    },
    {
      label: "Overdue",
      value: String(stats?.tasksOverdue ?? 0),
      icon: AlertTriangle,
      tone: "text-red-400",
      to: "/tasks",
    },
    {
      label: "Due today",
      value: String(stats?.tasksToday ?? 0),
      icon: CalendarClock,
      tone: "text-amber-400",
      to: "/tasks",
    },
    {
      label: "Tasks done",
      value: String(stats?.tasksDone ?? 0),
      icon: CheckCircle2,
      tone: "text-emerald-400",
      to: "/tasks",
    },
    {
      label: "Income this month",
      value: formatCurrency(stats?.incomeThisMonth ?? summary?.thisMonth ?? 0),
      icon: TrendingUp,
      tone: "text-emerald-400",
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

  const vaultCount = stats?.totalItems ?? vaultItems.length;

  const statusLabel = !initialized ? "Not set up" : locked ? "Locked" : "Unlocked";
  const statusTone = !initialized
    ? "border-line text-muted"
    : locked
      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Everything at a glance — vault, notes, tasks and income.
          </p>
        </div>
        <Link
          to="/generator"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Generate password
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {tiles.map(({ label, value, icon: Icon, tone, to }) => (
          <Link
            key={label}
            to={to}
            className="rounded-2xl border border-line bg-elevated p-5 transition hover:border-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted">
                {label}
              </span>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {statsLoading && !stats ? "…" : value}
            </p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Vault protection
            </h2>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                statusTone,
              )}
            >
              {statusLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl",
                locked
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-accent-soft text-accent",
              )}
            >
              {locked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{vaultCount}</p>
              <p className="text-xs text-muted">items in vault</p>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5">
            {PROTECTION.map((p) => (
              <li key={p.label} className="flex items-center gap-2 text-xs text-muted">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {p.label}
              </li>
            ))}
          </ul>
        </section>

        <WorldClock />
      </div>

      <section className="rounded-2xl border border-line bg-elevated p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-accent" />
            Recent credentials
          </h2>
          <Link to="/vault" className="text-xs text-muted transition hover:text-ink">
            View all
          </Link>
        </div>
        {recentCredentials.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No credentials yet"
            hint="Items you save will show up here."
          />
        ) : (
          <ul className="space-y-2">
            {recentCredentials.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate("/vault")}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-left transition hover:border-accent/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-ink">
                    {initials(item.title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {item.username || "—"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-accent" />
              Upcoming tasks
            </h2>
            <Link
              to="/tasks"
              className="text-xs text-muted transition hover:text-ink"
            >
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No upcoming tasks"
              hint="Tasks with a due date will appear here."
            />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{task.title}</p>
                    <p className="text-xs text-muted">
                      {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                    {task.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ListChecks className="h-4 w-4 text-accent" />
              Recent activity
            </h2>
            <Link
              to="/activity"
              className="text-xs text-muted transition hover:text-ink"
            >
              View all
            </Link>
          </div>
          {activity.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nothing yet"
              hint="Your recent changes will show up here."
            />
          ) : (
            <ul className="space-y-2">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {entry.itemName || entry.module}
                    </p>
                    <p className="text-xs text-muted">
                      {entry.module} · {entry.action}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">
                    {formatRelative(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
