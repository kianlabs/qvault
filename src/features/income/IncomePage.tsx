// QVAULT — Income page. Uses useIncomeStore (+ income_summary) + shared UI (FINAL-CONTRACT B/C/D).
// Redesigned to the "Calm Precision" design system (UI-OVERHAUL-CONTRACT) — presentation only.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Coins,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
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
} from "../../components/ui";
import { useIncomeStore } from "../../store/useIncomeStore";
import { staggerIn, useGsap } from "../../lib/motion";
import type { Income, IncomePayload } from "../../lib/types";
import { cn, formatCurrency, formatDate, toDateInput } from "../../lib/utils";

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

  // Entrance motion (presentation only) — refs for the stat grid and the list.
  const statsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  // Entrance motion (presentation only): stat cards cascade once on mount; the
  // list re-cascades when the filtered set changes (load / search). No logic touched.
  useGsap(() => {
    staggerIn(statsRef.current, ":scope > *", { y: 8, stagger: 0.05 });
  }, []);

  useGsap(() => {
    staggerIn(listRef.current, ":scope > li", { y: 6, stagger: 0.02, duration: 0.2 });
  }, [filtered]);

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

  const searching = search.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        subtitle={
          searching
            ? `${filtered.length} of ${items.length} entr${items.length === 1 ? "y" : "ies"}`
            : `${items.length} entr${items.length === 1 ? "y" : "ies"} logged`
        }
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => {
                void load();
                void loadSummary();
              }}
              className={loading ? "animate-spin" : undefined}
            />
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Add income
            </Button>
          </>
        }
      />

      <div
        ref={statsRef}
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          summaryLoading && "opacity-60 transition-opacity",
        )}
      >
        <StatCard
          label="This month"
          value={summary ? formatCurrency(summary.thisMonth, "USD") : "—"}
          icon={Coins}
          tone="accent"
        />
        <StatCard
          label="All time"
          value={summary ? formatCurrency(summary.allTime, "USD") : "—"}
          icon={TrendingUp}
          tone="success"
        />
      </div>

      {summary && summary.byMonth.length > 0 && (
        <IncomeChart byMonth={summary.byMonth} max={maxMonth} />
      )}

      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search income…"
      />

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
          icon={Coins}
          title="No income recorded"
          hint="Log your earnings to track totals over time."
          action={
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Add income
            </Button>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul ref={listRef}>
            {filtered.map((entry) => (
              <li
                key={entry.id}
                className="group flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors duration-150 last:border-0 hover:bg-raised"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Coins className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {entry.source}
                  </p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted">
                    <span className="shrink-0">{formatDate(entry.date)}</span>
                    <Badge tone="neutral">{entry.category}</Badge>
                    {entry.notes && (
                      <span className="truncate">{entry.notes}</span>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-success">
                  +{formatCurrency(entry.amount, entry.currency || "USD")}
                </span>

                <RowActions>
                  {busyId === entry.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  ) : (
                    <>
                      <IconButton
                        icon={Pencil}
                        label="Edit"
                        onClick={() => openEdit(entry)}
                      />
                      <Menu
                        items={[
                          {
                            label: "Delete",
                            icon: Trash2,
                            danger: true,
                            onClick: () => void onDelete(entry),
                          },
                        ]}
                      />
                    </>
                  )}
                </RowActions>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit income" : "Add income"}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Source">
            <Input
              value={form.source}
              onChange={(e) =>
                setForm((f) => ({ ...f, source: e.target.value }))
              }
              placeholder="e.g. Monthly salary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Currency">
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                className="field"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <Input
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
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className="field"
              placeholder="Optional notes…"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add income"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** `2026-05` → `May 2026`. Fallback ke string asli bila format tak dikenal. */
function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * Chart batang "Last 6 months" dengan sumbu Y berlabel, garis dasar, dan
 * tooltip hover yang menampilkan nominal persis. Sumbu Y dibulatkan ke angka
 * "cantik" (1/2/5 × 10ⁿ) supaya label mudah dibaca.
 */
function IncomeChart({
  byMonth,
  max,
}: {
  byMonth: { month: string; total: number }[];
  max: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const niceMax = useMemo(() => {
    if (max <= 0) return 100;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const norm = max / pow;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * pow;
  }, [max]);

  const ticks = [niceMax, niceMax * 0.5, 0];

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-ink">Last 6 months</h2>
      <div className="flex gap-3">
        {/* Sumbu Y */}
        <div className="flex h-40 flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-faint">
          {ticks.map((t, i) => (
            <span key={i}>{formatCurrency(t, "USD")}</span>
          ))}
        </div>

        {/* Area plot */}
        <div className="relative min-w-0 flex-1">
          {/* Gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
            {ticks.map((_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-line"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          <div className="flex h-40 items-end gap-2">
            {byMonth.map((m, i) => {
              const pct = niceMax > 0 ? (m.total / niceMax) * 100 : 0;
              const active = hover === i;
              return (
                <div
                  key={m.month}
                  className="group/bar relative flex h-full flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {active && (
                    <div className="qv-pop absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs shadow-xl">
                      <p className="font-medium text-ink">
                        {formatCurrency(m.total, "USD")}
                      </p>
                      <p className="text-[10px] text-muted">
                        {monthLabel(m.month)}
                      </p>
                    </div>
                  )}
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all duration-200",
                      active ? "bg-accent-strong" : "bg-accent",
                    )}
                    style={{ height: `${Math.max(pct, 1.5)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Sumbu X */}
          <div className="mt-1.5 flex gap-2">
            {byMonth.map((m) => (
              <span
                key={m.month}
                className="flex-1 text-center text-[10px] text-muted"
              >
                {monthLabel(m.month)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
