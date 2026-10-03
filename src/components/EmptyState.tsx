// QVAULT — empty state placeholder (Calm Precision).
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** Tombol aksi opsional (mis. "Tambah item"). */
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-raised text-faint">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {hint && <p className="mx-auto max-w-sm text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
