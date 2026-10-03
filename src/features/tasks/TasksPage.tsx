// QVAULT — Tasks page. Uses useTasksStore (+ dashboard stats) + shared UI (FINAL-CONTRACT B/C/D).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useTasksStore } from "../../store/useTasksStore";
import type { Task, TaskPayload, TaskStatus } from "../../lib/types";
import { cn, formatDate, parseTags, toDateInput } from "../../lib/utils";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const iconBtnCls =
  "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
};
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const EMPTY_FORM: TaskPayload = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
  tags: [],
  folderId: null,
};

function priorityClass(priority: string): string {
  switch (priority.toLowerCase()) {
    case "high":
      return "border-red-500/30 bg-red-500/15 text-red-300";
    case "low":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
    default:
      return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }
}

const TABS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export default function TasksPage() {
  const toast = useToast();
  const {
    items,
    loading,
    error,
    stats,
    statsLoading,
    load,
    create,
    update,
    remove,
    setStatus,
    loadStats,
  } = useTasksStore();
  const { items: folders, load: loadFolders } = useFoldersStore();

  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskPayload>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadStats();
    void loadFolders();
  }, [load, loadStats, loadFolders]);

  const folderName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of folders) m.set(f.id, f.name);
    return m;
  }, [folders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [items, filter, search]);

  function isOverdue(task: Task): boolean {
    if (task.status === "done" || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setTagsText("");
    setOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority || "medium",
      dueDate: task.dueDate,
      tags: task.tags,
      folderId: task.folderId,
    });
    setTagsText(task.tags.join(", "));
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload: TaskPayload = { ...form, tags: parseTags(tagsText) };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Task updated");
      } else {
        await create(payload);
        toast.success("Task created");
      }
      setOpen(false);
      void loadStats();
    } catch {
      toast.error("Could not save task");
    } finally {
      setSaving(false);
    }
  }

  async function onCycle(task: Task) {
    try {
      await setStatus(task.id, NEXT_STATUS[task.status]);
      void loadStats();
    } catch {
      toast.error("Could not update status");
    }
  }

  async function onDelete(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setBusyId(task.id);
    try {
      await remove(task.id);
      toast.success("Task deleted");
      void loadStats();
    } catch {
      toast.error("Could not delete task");
    } finally {
      setBusyId(null);
    }
  }

  const summary = [
    { label: "Due today", value: stats?.tasksToday ?? 0 },
    { label: "Overdue", value: stats?.tasksOverdue ?? 0 },
    { label: "Completed", value: stats?.tasksDone ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Tasks</h1>
          <p className="text-xs text-muted">
            {filtered.length} of {items.length} task
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void load();
              void loadStats();
            }}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:text-ink"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-3 gap-3 transition",
          statsLoading && "opacity-60",
        )}
      >
        {summary.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-line bg-elevated px-4 py-3"
          >
            <p className="text-lg font-bold text-ink">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-elevated p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                filter === tab.key
                  ? "bg-accent text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="grid place-items-center py-16 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks"
          hint="Add a task to start tracking what needs doing."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((task) => {
            const StatusIcon = STATUS_ICON[task.status];
            const overdue = isOverdue(task);
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => void onCycle(task)}
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition",
                    task.status === "done"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-line text-muted hover:text-ink",
                  )}
                  aria-label="Cycle status"
                  title={`Status: ${STATUS_LABEL[task.status]}`}
                >
                  <StatusIcon className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        task.status === "done"
                          ? "text-muted line-through"
                          : "text-ink",
                      )}
                    >
                      {task.title}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                        priorityClass(task.priority),
                      )}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {task.dueDate && (
                      <span className={cn(overdue && "text-red-400")}>
                        {overdue ? "Overdue · " : "Due "}
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] text-ink"
                      >
                        {tag}
                      </span>
                    ))}
                    {task.folderId && folderName.get(task.folderId) && (
                      <span>· {folderName.get(task.folderId)}</span>
                    )}
                  </div>
                </div>

                <span className="hidden shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-muted sm:inline">
                  {STATUS_LABEL[task.status]}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(task)}
                    className={iconBtnCls}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(task)}
                    className={cn(iconBtnCls, "hover:text-red-400")}
                    aria-label="Delete"
                  >
                    {busyId === task.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit task" : "New task"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
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
                value={toDateInput(form.dueDate)}
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
              {editing ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
