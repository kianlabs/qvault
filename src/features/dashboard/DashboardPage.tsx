// QVAULT — Dashboard (route "/"). Overview shell mengikuti referensi KeepR:
// sapaan + tiga kartu ringkas + banner peringatan + kartu Income Activity
// (area chart) + rail widget kanan (World Clocks, Upcoming Tasks, Vault
// Protection). Presentasi saja — seluruh data tetap dari store Wave-1/Wave-3.
import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity as ActivityIcon,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  KeyRound,
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
import { useSettingsStore } from "../../store/useSettingsStore";
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelative,
  initials,
} from "../../lib/utils";
import { AreaChart, Badge, Card } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import WorldClock from "../../components/WorldClock";
import { staggerIn, useGsap } from "../../lib/motion";
import type { LucideIcon } from "lucide-react";

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
};

/** `2026-08` → `Aug`. */
function shortMonth(month: string): string {
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-GB", { month: "short" });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const stats = useTasksStore((s) => s.stats);
  const loadStats = useTasksStore((s) => s.loadStats);
  const summary = useIncomeStore((s) => s.summary);
  const loadSummary = useIncomeStore((s) => s.loadSummary);
  const activity = useActivityStore((s) => s.items);
  const loadActivity = useActivityStore((s) => s.load);
  const vaultItems = useVaultStore((s) => s.items);
  const loadVault = useVaultStore((s) => s.load);
  const initialized = useAuthStore((s) => s.initialized);
  const locked = useAuthStore((s) => s.locked);
  const displayName = useSettingsStore((s) => s.settings?.displayName ?? "");

  const credentialsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    void loadStats();
    void loadSummary();
    void loadActivity(6);
    void loadVault();
  }, [loadStats, loadSummary, loadActivity, loadVault]);

  const chartData = useMemo(
    () =>
      (summary?.byMonth ?? []).map((m) => ({
        label: shortMonth(m.month),
        value: m.total,
      })),
    [summary],
  );

  const recentCredentials = useMemo(
    () =>
      [...vaultItems]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5),
    [vaultItems],
  );

  const upcoming = stats?.upcomingTasks ?? [];
  const overdue = stats?.tasksOverdue ?? 0;

  useGsap(() => {
    staggerIn(credentialsRef.current, ":scope > *", { y: 8, stagger: 0.035 });
  }, [recentCredentials]);

  const statusLabel = !initialized ? "Not set up" : locked ? "Locked" : "Ready";

  return (
    <div className="space-y-6">
      {/* Sapaan — foto profil anime + teks sambutan. */}
      <header className="flex items-center gap-4">
        <img
          src="/avatar-anime.jpg"
          alt={displayName || "Profile"}
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-line"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {greeting()}, {displayName || "there"}.
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here's everything across your Life OS.
          </p>
        </div>
      </header>

      {/* Kartu ringkas */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <SummaryCard
          icon={KeyRound}
          label="Credentials"
          value={stats?.totalItems ?? vaultItems.length}
          tone="accent"
          onClick={() => navigate("/vault")}
        />
        <SummaryCard
          icon={NotebookPen}
          label="Notes"
          value={stats?.totalNotes ?? 0}
          tone="info"
          onClick={() => navigate("/notes")}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Tasks"
          value={stats?.tasksToday ?? 0}
          tone="success"
          onClick={() => navigate("/tasks")}
        />
      </section>

      {/* Banner peringatan */}
      {overdue > 0 && (
        <button
          type="button"
          onClick={() => navigate("/tasks")}
          className="flex w-full items-center gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-2.5 text-left text-xs text-warn transition-colors hover:border-warn/50"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          <span className="font-medium">
            {overdue} task{overdue === 1 ? "" : "s"} overdue
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium">
            View tasks <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      )}

      {/* Dua kolom: konten utama + rail widget */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Income Activity */}
          <Card padding="lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <TrendingUp className="h-4 w-4 text-muted" />
                Income Activity
              </h2>
              <Badge tone="success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Active
              </Badge>
            </div>

            <div className="mb-4 flex gap-8">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
                  This month
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                  {formatCurrency(summary?.thisMonth ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
                  All-time
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-success">
                  {formatCurrency(summary?.allTime ?? 0)}
                </p>
              </div>
            </div>

            {chartData.length > 0 ? (
              <AreaChart data={chartData} height={170} />
            ) : (
              <p className="py-10 text-center text-xs text-muted">
                No income recorded yet.
              </p>
            )}
          </Card>

          {/* Recent credentials */}
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
              <ul ref={credentialsRef}>
                {recentCredentials.map((item) => (
                  <li key={item.id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => navigate("/vault")}
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
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
                      <ChevronRight className="h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Rail widget */}
        <aside className="space-y-6">
          <WorldClock />

          {/* Upcoming tasks */}
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
              <p className="px-4 py-6 text-center text-xs text-muted">
                No upcoming tasks.
              </p>
            ) : (
              <ul>
                {upcoming.slice(0, 4).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-0"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        task.status === "done" ? "bg-success" : "bg-warn",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-ink">{task.title}</p>
                      <p className="text-[11px] text-muted">
                        {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Vault protection */}
          <Card padding="lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-muted" />
                Vault protection
              </h2>
              <Badge tone={locked ? "warn" : "success"}>{statusLabel}</Badge>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-xl",
                  locked ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent",
                )}
              >
                {locked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {locked ? "Vault is locked" : "Vault is unlocked"}
                </p>
                <p className="text-xs text-muted">
                  Encrypted at rest, decrypted in memory only.
                </p>
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
        </aside>
      </div>

      {/* Recent activity */}
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
            {activity.slice(0, 6).map((entry) => {
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
  );
}

/** Kartu ringkas (ikon + label + angka) untuk baris atas dashboard. */
function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "accent" | "info" | "success";
  onClick: () => void;
}) {
  const toneCls = {
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-line bg-elevated p-4 text-left transition-colors duration-150 hover:border-line-strong hover:bg-raised"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", toneCls)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted">{label}</span>
        <span className="block text-2xl font-semibold tracking-tight tabular-nums text-ink">
          {value}
        </span>
      </span>
    </button>
  );
}
