// QVAULT — Menu (Calm Precision). Overflow menu "⋯" untuk aksi sekunder.
// Menutup saat klik luar / Escape. Render daftar item via portal-less absolute.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import IconButton from "./IconButton";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  align?: "left" | "right";
  label?: string;
  trigger?: ReactNode;
}

export default function Menu({ items, align = "right", label = "More actions" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton icon={MoreHorizontal} label={label} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div
          role="menu"
          className={cn(
            "qv-pop absolute z-30 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-line bg-raised p-1 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150 disabled:opacity-40",
                it.danger
                  ? "text-danger hover:bg-danger-soft"
                  : "text-ink hover:bg-raised",
              )}
            >
              {it.icon && <it.icon className="h-3.5 w-3.5" />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
