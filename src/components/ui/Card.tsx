// QVAULT — Card/Panel (Calm Precision). Wadah standar untuk semua konten.
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Padding internal: none = kelola sendiri (mis. list baris). */
  padding?: "none" | "sm" | "md" | "lg";
  /** Efek hover (untuk kartu yang bisa diklik). */
  interactive?: boolean;
}

const PAD = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export default function Card({
  children,
  className,
  padding = "md",
  interactive = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-elevated",
        PAD[padding],
        interactive &&
          "cursor-pointer transition-colors duration-150 hover:border-line-strong hover:bg-raised",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Judul section di dalam kartu (ikon + label). */
export function CardHeader({
  icon: Icon,
  title,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted" />}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {action}
    </div>
  );
}
