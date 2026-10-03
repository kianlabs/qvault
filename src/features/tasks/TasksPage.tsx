// QVAULT — Tasks page. Uses useTasksStore (+ dashboard stats) + shared UI (Calm Precision).
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
  Trash2,
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
  Menu,
  PageHeader,
  RowActions,
  SearchInput,
  StatCard,
  Tabs,
  type Tone,
} from "../../components/ui";
import { useFoldersStore } from "../../store/useFoldersStore";
import { useTasksStore } from "../../store/useTasksStore";
import type { Task, TaskPayload, TaskStatus } from "../../lib/types";
import { cn, formatDate, parseTags, toDateInput } from "../../lib/utils";

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

/** Priority → semantic tone (satu warna = satu makna). */
function priorityTone(priority: string): Tone {
  switch (priority.toLowerCase()) {
    case "high":
      return "danger";
    case "low":
      return "success";
    default:
      return "warn";
  }
}

const EMPTY_FORM: TaskPayload = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
  tags: [],
  folderId: null,
};

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle={`${filtered.length} of ${items.length} task${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => {
                void load();
                void loadStats();
              }}
              className={cn(loading && "[&>svg]:animate-spin")}
            />
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New task
            </Button>
          </>
        }
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-3 transition-opacity",
          statsLoading && "opacity-60",
        )}
      >
        <StatCard
          label="Due today"
          value={stats?.tasksToday ?? 0}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Overdue"
          value={stats?.tasksOverdue ?? 0}
          icon={Circle}
          tone="danger"
        />
        <StatCard
          label="Completed"
          value={stats?.tasksDone ?? 0}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          items={[
            { value: "all", label: "All" },
            { value: "todo", label: "To do" },
            { value: "in_progress", label: "In progress" },
            { value: "done", label: "Done" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as "all" | TaskStatus)}
        />
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-2 text-xs text-danger">
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
          action={
            <Button variant="secondary" icon={Plus} onClick={openCreate}>
              New task
            </Button>
          }
        />
      ) : (
        <Card padding="none">
          <ul>
            {filtered.map((task) => {
              const StatusIcon = STATUS_ICON[task.status];
              const overdue = isOverdue(task);
              const done = task.status === "done";
              return (
                <li
                  key={task.id}
                  className="group flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-0 hover:bg-raised"
                >
                  <button
                    type="button"
                    onClick={() => void onCycle(task)}
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
                      done
                        ? "border-success/40 bg-success-soft text-success"
                        : "border-line text-muted hover:border-line-strong hover:text-ink",
                    )}
                    aria-label={`Status: ${STATUS_LABEL[task.status]}. Change status`}
                    title={`Status: ${STATUS_LABEL[task.status]}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          done ? "text-muted line-through" : "text-ink",
                        )}
                      >
                        {task.title}
                      </p>
                      <Badge tone={priorityTone(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {task.dueDate && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            overdue && "text-danger",
                          )}
                        >
                          {overdue ? "Overdue · " : "Due "}
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.tags
                        .filter((tag) => tag.toLowerCase() !== "task")
                        .map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      {task.folderId && folderName.get(task.folderId) && (
                        <span>· {folderName.get(task.folderId)}</span>
                      )}
                    </div>
                  </div>

                  {busyId === task.id && (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />
                  )}

                  <RowActions className="shrink-0">
                    <IconButton
                      icon={Pencil}
                      label="Edit task"
                      onClick={() => openEdit(task)}
                    />
                    <Menu
                      label="More actions"
                      items={[
                        {
                          label: "Delete",
                          icon: Trash2,
                          onClick: () => void onDelete(task),
                          danger: true,
                          disabled: busyId === task.id,
                        },
                      ]}
                    />
                  </RowActions>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit task" : "New task"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Title">
            <Input
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
              <input
                type="date"
                value={toDateInput(form.dueDate)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value || null }))
                }
                className="field"
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
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
