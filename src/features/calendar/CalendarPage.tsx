// QVAULT — Calendar page. Month / Week / Year views over useTasksStore (dueDate) +
// "add task from date" modal (Wave 3, Agent C). Shared UI from FINAL-CONTRACT B/C/D.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
} from "lucide-react";

import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useTasksStore } from "../../store/useTasksStore";
import { exitFullscreen, isFullscreen, toggleFullscreen } from "../../lib/fullscreen";
import type { Task, TaskPayload, TaskStatus } from "../../lib/types";
import { cn, parseTags } from "../../lib/utils";

type ViewMode = "month" | "week" | "year";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";

const EMPTY_FORM: TaskPayload = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
  tags: [],
  folderId: null,
};

/** 6×7 grid of dates (Monday-first) covering the given month. */
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Salin + geser `n` hari (tanpa mutasi input). */
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Senin sebagai awal minggu untuk tanggal apa pun. */
function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - offset);
  return date;
}

/**
 * Kunci hari `yyyy-mm-dd` berbasis waktu LOKAL.
 * String date-only (`yyyy-mm-dd`) diparse sebagai tanggal lokal supaya tidak
 * bergeser satu hari di zona waktu non-UTC.
 */
function dayKey(value: Date | string): string {
  let d: Date;
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(value);
  } else {
    d = value;
  }
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Label rentang minggu, mis. "6 Jan – 12 Jan 2025". */
function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  const s = `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`;
  const e = `${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  return `${s} – ${e}`;
}

function statusClass(status: string): string {
  switch (status) {
    case "done":
      return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300";
    case "in_progress":
      return "border-amber-500/40 bg-amber-500/20 text-amber-300";
    default:
      return "border-accent/40 bg-accent-soft text-ink";
  }
}

export default function CalendarPage() {
  const { items, loading, error, load, create } = useTasksStore();
  const { items: folders, load: loadFolders } = useFoldersStore();
  const toast = useToast();

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskPayload>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState("");

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of items) {
      if (!t.dueDate) continue;
      const key = dayKey(t.dueDate);
      if (!key) continue;
      const list = m.get(key) ?? [];
      list.push(t);
      m.set(key, list);
    }
    return m;
  }, [items]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const todayKey = dayKey(new Date());

  const monthCount = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    let n = 0;
    for (const [key, list] of tasksByDay)
      if (key.startsWith(prefix)) n += list.length;
    return n;
  }, [tasksByDay, year, month]);

  const weekCount = useMemo(() => {
    let n = 0;
    for (const d of weekDays) n += tasksByDay.get(dayKey(d))?.length ?? 0;
    return n;
  }, [weekDays, tasksByDay]);

  const yearCount = useMemo(() => {
    const prefix = `${year}-`;
    let n = 0;
    for (const [key, list] of tasksByDay)
      if (key.startsWith(prefix)) n += list.length;
    return n;
  }, [tasksByDay, year]);

  const monthCounts = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => 0);
    const prefix = `${year}-`;
    for (const [key, list] of tasksByDay) {
      if (!key.startsWith(prefix)) continue;
      const idx = Number(key.slice(5, 7)) - 1;
      if (idx >= 0 && idx < 12) arr[idx] += list.length;
    }
    return arr;
  }, [tasksByDay, year]);

  const headerCount =
    view === "month" ? monthCount : view === "week" ? weekCount : yearCount;
  const headerUnit =
    view === "month"
      ? "due this month"
      : view === "week"
        ? "due this week"
        : "due this year";
  const headerLabel =
    view === "month"
      ? `${MONTHS[month]} ${year}`
      : view === "week"
        ? weekLabel(weekStart)
        : String(year);

  function shift(delta: number) {
    setCursor((c) => {
      if (view === "week") return addDays(c, delta * 7);
      if (view === "year") return new Date(c.getFullYear() + delta, 0, 1);
      return new Date(c.getFullYear(), c.getMonth() + delta, 1);
    });
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  function changeView(next: ViewMode) {
    setView(next);
    setCursor((c) => {
      if (next === "week") return startOfWeek(c);
      if (next === "year") return new Date(c.getFullYear(), 0, 1);
      return new Date(c.getFullYear(), c.getMonth(), 1);
    });
  }

  function openCreate(dueKey: string) {
    setForm({ ...EMPTY_FORM, dueDate: dueKey });
    setTagsText("");
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await create({ ...form, tags: parseTags(tagsText) });
      toast.success("Task created");
      setOpen(false);
      void load();
    } catch {
      toast.error("Could not save task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Calendar</h1>
          <p className="text-xs text-muted">
            {headerCount} task{headerCount === 1 ? "" : "s"} {headerUnit}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => setFs(await toggleFullscreen())}
            title={fs ? "Exit full screen" : "Full screen"}
            aria-label={fs ? "Exit full screen" : "Full screen"}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
          >
            {fs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:text-ink"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-line bg-elevated p-1">
            {(["month", "week", "year"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeView(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                  view === m ? "bg-accent text-white" : "text-muted hover:text-ink",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-line bg-elevated p-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:text-ink"
              aria-label={`Previous ${view}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-medium text-ink">
              {headerLabel}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:text-ink"
              aria-label={`Next ${view}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={goToday}
            className="rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:text-ink"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {view === "month" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
          <div className="grid grid-cols-7 border-b border-line bg-white/5">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((date, i) => {
              const key = dayKey(date);
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = date.getMonth() === month;
              const isToday = key === todayKey;
              return (
                <div
                  key={i}
                  onClick={() => openCreate(key)}
                  className={cn(
                    "min-h-[96px] cursor-pointer border-b border-r border-line p-1.5 transition hover:bg-white/[0.03]",
                    !inMonth && "bg-white/[0.02] text-muted",
                  )}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-[11px]",
                        isToday
                          ? "bg-accent font-semibold text-white"
                          : inMonth
                            ? "text-ink"
                            : "text-muted",
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        title={t.title}
                        className={cn(
                          "truncate rounded-md border px-1.5 py-0.5 text-[10px]",
                          statusClass(t.status),
                        )}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="px-1.5 text-[10px] text-muted">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
          <div className="grid grid-cols-7 border-b border-line bg-white/5">
            {weekDays.map((d) => {
              const key = dayKey(d);
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openCreate(key)}
                  className="flex flex-col items-center gap-0.5 px-2 py-2 transition hover:bg-white/5"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-[11px]",
                      isToday ? "bg-accent font-semibold text-white" : "text-ink",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-7">
            {weekDays.map((d) => {
              const key = dayKey(d);
              const dayTasks = tasksByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className="min-h-[220px] border-r border-line p-2 last:border-r-0"
                >
                  <div className="space-y-1">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        title={t.title}
                        className={cn(
                          "truncate rounded-md border px-1.5 py-0.5 text-[10px]",
                          statusClass(t.status),
                        )}
                      >
                        {t.title}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => openCreate(key)}
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-line py-1.5 text-[10px] text-muted transition hover:border-accent/40 hover:text-ink"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "year" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MONTHS.map((name, m) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setView("month");
                setCursor(new Date(year, m, 1));
              }}
              className="rounded-2xl border border-line bg-elevated p-4 text-left transition hover:border-accent/40"
            >
              <p className="text-sm font-medium text-ink">{name}</p>
              <p className="mt-1 text-xs text-muted">
                {monthCounts[m]} task{monthCounts[m] === 1 ? "" : "s"}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, monthCounts[m] * 12)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid place-items-center py-8 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        headerCount === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            hint={
              view === "year"
                ? "Tasks with a due date this year will appear here."
                : view === "week"
                  ? "Tasks with a due date this week will appear here."
                  : "Tasks with a due date in this month will appear here."
            }
          />
        )
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputCls}
              placeholder="What needs doing?"
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              className={inputCls}
              placeholder="Optional details…"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))
                }
                className={inputCls}
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value }))
                }
                className={inputCls}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input
                type="date"
                value={form.dueDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value || null }))
                }
                className={inputCls}
              />
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
                {folders.map((f) => (
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
                placeholder="urgent, home"
              />
            </div>
          </div>

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
              Create task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
