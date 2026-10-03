// QVAULT — StatCard (Calm Precision). Kartu metrik dengan warna semantik tunggal.
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Tone } from "./Badge";

const ICON_TONE: Record<Tone, string> = {
  neutral: "text-muted",
  accent: "text-accent",
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: Tone;
  /** Catatan kecil di bawah nilai (mis. "+12% vs bulan lalu"). */
  hint?: string;
  onClick?: () => void;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-line bg-elevated p-4 transition-colors duration-150",
        onClick && "cursor-pointer hover:border-line-strong hover:bg-raised",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", ICON_TONE[tone])} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}
