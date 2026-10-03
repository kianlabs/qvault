// QVAULT — IconButton (Calm Precision). Tombol ikon persegi untuk aksi baris.
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Label aksesibilitas (wajib) + tooltip. */
  label: string;
  tone?: "default" | "danger";
  size?: "sm" | "md";
}

export default function IconButton({
  icon: Icon,
  label,
  tone = "default",
  size = "md",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-lg transition-colors duration-150",
        dim,
        tone === "danger"
          ? "text-muted hover:bg-danger-soft hover:text-danger"
          : "text-muted hover:bg-raised hover:text-ink",
        className,
      )}
      {...rest}
    >
      <Icon className={icon} />
    </button>
  );
}
