// QVAULT — RowActions (Calm Precision). Aksi baris yang muncul saat hover.
// Menghilangkan "icon soup": daftar bersih saat diam, kontrol saat disentuh.
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Bungkus baris dengan grup `group`. Anak ber-class `row-action` hanya tampil
 * saat baris di-hover atau salah satu kontrolnya fokus (aksesibilitas keyboard).
 */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "row-action flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
