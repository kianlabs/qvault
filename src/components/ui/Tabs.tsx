// QVAULT — Tabs (Calm Precision). Segmented control untuk filter status/view.
import { cn } from "../../lib/utils";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              active
                ? "bg-raised text-ink"
                : "text-muted hover:text-ink",
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  active ? "bg-accent-soft text-accent-strong" : "text-faint",
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
