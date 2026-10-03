// QVAULT — Income page. Uses useIncomeStore (+ income_summary) + shared UI (FINAL-CONTRACT B/C/D).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Coins,
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
import { useIncomeStore } from "../../store/useIncomeStore";
import type { Income, IncomePayload } from "../../lib/types";
import { cn, formatCurrency, formatDate, toDateInput } from "../../lib/utils";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const iconBtnCls =
  "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink";

const CURRENCIES = ["USD", "EUR", "GBP", "IDR", "JPY", "AUD", "CAD", "SGD"];

const CATEGORIES = [
  "salary",
  "freelance",
  "investment",
  "business",
  "gift",
  "other",
];

function todayIso(): string {
  return new Date().toISOString();
}

const EMPTY_FORM: IncomePayload = {
  source: "",
  amount: 0,
  currency: "USD",
  category: "salary",
  date: todayIso(),
  notes: "",
};

export default function IncomePage() {
  const toast = useToast();
  const {
    items,
    loading,
    error,
    summary,
    summaryLoading,
    load,
    create,
    update,
    remove,
    loadSummary,
  } = useIncomeStore();

  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState<IncomePayload>(EMPTY_FORM);
  const [amountText, setAmountText] = useState("0");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.source.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.notes.toLowerCase().includes(q),
    );
  }, [items, search]);

  const maxMonth = useMemo(() => {
    if (!summary || summary.byMonth.length === 0) return 0;
    return Math.max(...summary.byMonth.map((m) => m.total), 0);
  }, [summary]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: todayIso() });
    setAmountText("0");
    setOpen(true);
  }

  function openEdit(entry: Income) {
    setEditing(entry);
    setForm({
      source: entry.source,
      amount: entry.amount,
      currency: entry.currency || "USD",
      category: entry.category,
      date: entry.date,
      notes: entry.notes,
    });
    setAmountText(String(entry.amount));
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.source.trim()) {
      toast.error("Source is required");
      return;
    }
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    const payload: IncomePayload = { ...form, amount };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Entry updated");
      } else {
        await create(payload);
        toast.success("Income added");
      }
      setOpen(false);
      void loadSummary();
    } catch {
      toast.error("Could not save entry");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(entry: Income) {
    if (!window.confirm(`Delete "${entry.source}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(entry.id);
    try {
      await remove(entry.id);
      toast.success("Entry deleted");
      void loadSummary();
    } catch {
      toast.error("Could not delete entry");
    } finally {
      setBusyId(null);
    }
  }

  const summaryCards = [
    {
      label: "This month",
      value: summary ? formatCurrency(summary.thisMonth, "USD") : "—",
    },
    {
      label: "All time",
      value: summary ? formatCurrency(summary.allTime, "USD") : "—",
    },
    { label: "Entries", value: String(items.length) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Income</h1>
          <p className="text-xs text-muted">
            {filtered.length} of {items.length} entr
            {items.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void load();
              void loadSummary();
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
            <Plus className="h-4 w-4" /> Add income
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-3 gap-3 transition",
          summaryLoading && "opacity-60",
        )}
      >
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-line bg-elevated px-4 py-3"
          >
            <p className="truncate text-lg font-bold text-ink">{c.value}</p>
            <p className="text-xs text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      {summary && summary.byMonth.length > 0 && (
        <div className="rounded-2xl border border-line bg-elevated p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Last 6 months
          </h2>
          <div className="flex items-end gap-3">
            {summary.byMonth.map((m) => {
              const pct = maxMonth > 0 ? (m.total / maxMonth) * 100 : 0;
              return (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div className="flex h-28 w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-accent/70 transition-all"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={`${m.month}: ${formatCurrency(m.total, "USD")}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search income…"
          className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent"
        />
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
          icon={Coins}
          title="No income recorded"
          hint="Log your earnings to track totals over time."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-4 rounded-2xl border border-line bg-elevated px-4 py-3"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-muted">
                <Coins className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {entry.source}
                </p>
                <p className="truncate text-xs text-muted">
                  {formatDate(entry.date)} · {entry.category}
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </p>
              </div>

              <span className="shrink-0 text-sm font-semibold text-emerald-400">
                +{formatCurrency(entry.amount, entry.currency || "USD")}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(entry)}
                  className={iconBtnCls}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(entry)}
                  className={cn(iconBtnCls, "hover:text-red-400")}
                  aria-label="Delete"
                >
                  {busyId === entry.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit income" : "Add income"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Source</label>
            <input
              value={form.source}
              onChange={(e) =>
                setForm((f) => ({ ...f, source: e.target.value }))
              }
              className={inputCls}
              placeholder="e.g. Monthly salary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                className={inputCls}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                value={toDateInput(form.date)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    date: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : todayIso(),
                  }))
                }
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className={inputCls}
              placeholder="Optional notes…"
            />
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
              {editing ? "Save changes" : "Add income"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
