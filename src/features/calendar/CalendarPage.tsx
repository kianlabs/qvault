// QVAULT — Calendar page. Month / Week / Year views over useTasksStore (dueDate) +
// "add task from date" modal (Wave 3, Agent C). Shared UI from FINAL-CONTRACT B/C/D.
// Redesigned to the "Calm Precision" design system (UI-OVERHAUL-CONTRACT) — presentation only.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  PageHeader,
  Tabs,
} from "../../components/ui";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useTasksStore } from "../../store/useTasksStore";
import { exitFullscreen, isFullscreen, toggleFullscreen } from "../../lib/fullscreen";
import { staggerIn, useGsap } from "../../lib/motion";
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

/** Satu warna = satu makna (Calm Precision). */
function statusTone(status: string): "success" | "warn" | "accent" {
  if (status === "done") return "success";
  if (status === "in_progress") return "warn";
  return "accent";
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

  // Entrance motion (presentation only) — one ref per view container.
  const monthGridRef = useRef<HTMLDivElement>(null);
  const weekGridRef = useRef<HTMLDivElement>(null);
  const yearGridRef = useRef<HTMLDivElement>(null);

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

  // Entrance motion (presentation only): cascade the day cells on view change and
  // the month tiles when the year changes. Presentation only — no logic touched.
  useGsap(() => {
    staggerIn(monthGridRef.current, ":scope > div", { y: 6, stagger: 0.008, duration: 0.2 });
  }, [view, cursor]);

  useGsap(() => {
    staggerIn(weekGridRef.current, ":scope > div", { y: 6, stagger: 0.02, duration: 0.2 });
  }, [view, cursor]);

  useGsap(() => {
    staggerIn(yearGridRef.current, ":scope > button", { y: 8, stagger: 0.02 });
  }, [year]);

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
      <PageHeader
        title="Calendar"
        subtitle={`${headerCount} task${headerCount === 1 ? "" : "s"} ${headerUnit}`}
        actions={
          <>
            <IconButton
              icon={fs ? Minimize2 : Maximize2}
              label={fs ? "Exit full screen" : "Full screen"}
              onClick={async () => setFs(await toggleFullscreen())}
            />
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => void load()}
              className={loading ? "animate-spin" : undefined}
            />

            <Tabs
              items={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
                { value: "year", label: "Year" },
              ]}
              value={view}
              onChange={(v) => changeView(v as ViewMode)}
            />

            <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
              <IconButton
                icon={ChevronLeft}
                label={`Previous ${view}`}
                size="sm"
                onClick={() => shift(-1)}
              />
              <span className="min-w-[150px] px-1 text-center text-sm font-medium text-ink">
                {headerLabel}
              </span>
              <IconButton
                icon={ChevronRight}
                label={`Next ${view}`}
                size="sm"
                onClick={() => shift(1)}
              />
            </div>

            <Button variant="secondary" onClick={goToday}>
              Today
            </Button>
          </>
        }
      />

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {view === "month" && (
        <Card padding="none" className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {d}
              </div>
            ))}
          </div>

          <div ref={monthGridRef} className="grid grid-cols-7">
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
                    "min-h-[96px] cursor-pointer border-b border-r border-line p-1.5 transition-colors duration-150 hover:bg-raised",
                    !inMonth && "bg-surface text-muted",
                  )}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-[11px]",
                        isToday
                          ? "bg-accent font-semibold text-ink"
                          : inMonth
                            ? "text-ink"
                            : "text-faint",
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div key={t.id} title={t.title} className="truncate">
                        <Badge tone={statusTone(t.status)} className="w-full">
                          <span className="truncate">{t.title}</span>
                        </Badge>
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
        </Card>
      )}

      {view === "week" && (
        <Card padding="none" className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface">
            {weekDays.map((d) => {
              const key = dayKey(d);
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openCreate(key)}
                  className="flex flex-col items-center gap-0.5 px-2 py-2 transition-colors duration-150 hover:bg-raised"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-[11px]",
                      isToday ? "bg-accent font-semibold text-ink" : "text-ink",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div ref={weekGridRef} className="grid grid-cols-7">
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
                      <div key={t.id} title={t.title} className="truncate">
                        <Badge tone={statusTone(t.status)} className="w-full">
                          <span className="truncate">{t.title}</span>
                        </Badge>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Plus}
                      onClick={() => openCreate(key)}
                      className="w-full border border-dashed border-line"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === "year" && (
        <div ref={yearGridRef} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {MONTHS.map((name, m) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setView("month");
                setCursor(new Date(year, m, 1));
              }}
              className="rounded-2xl border border-line bg-elevated p-4 text-left transition-colors duration-150 hover:border-line-strong hover:bg-raised"
            >
              <p className="text-sm font-semibold text-ink">{name}</p>
              <p className="mt-1 text-xs text-muted">
                {monthCounts[m]} task{monthCounts[m] === 1 ? "" : "s"}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
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
            action={
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => openCreate(todayKey)}
              >
                New task
              </Button>
            }
          />
        )
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Title">
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What needs doing?"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              className="field"
              placeholder="Optional details…"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))
                }
                className="field"
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value }))
                }
                className="field"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={form.dueDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value || null }))
                }
              />
            </Field>
          </div>

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
                {folders.map((f) => (
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
                placeholder="urgent, home"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
