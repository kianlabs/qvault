// QVAULT — Badge (Calm Precision). Satu warna = satu makna.
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type Tone = "neutral" | "accent" | "success" | "warn" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-raised text-muted",
  accent: "border-accent/30 bg-accent-soft text-accent-strong",
  success: "border-success/30 bg-success-soft text-success",
  warn: "border-warn/30 bg-warn-soft text-warn",
  danger: "border-danger/30 bg-danger-soft text-danger",
  info: "border-info/30 bg-info-soft text-info",
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export default function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
