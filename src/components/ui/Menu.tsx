// QVAULT — Menu (Calm Precision). Overflow menu "⋯" untuk aksi sekunder.
//
// Dirender lewat PORTAL ke <body> dengan posisi `fixed` yang dihitung dari rect
// pemicu (lihat lib/menu-position). Ini mencegah dropdown terpotong oleh
// ancestor ber-`overflow-hidden` (mis. Card daftar item vault). Menutup saat
// klik luar / Escape / scroll / resize.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { menuPosition, type Point } from "../../lib/menu-position";
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
}

export default function Menu({
  items,
  align = "right",
  label = "More actions",
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Point | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ukur ukuran menu yang sebenarnya, lalu hitung posisi. useLayoutEffect
  // berjalan sebelum paint sehingga tidak ada kedipan.
  useLayoutEffect(() => {
    if (!open) return;
    const t = triggerRef.current?.getBoundingClientRect();
    const m = menuRef.current?.getBoundingClientRect();
    if (!t || !m) return;
    setPos(
      menuPosition(
        t,
        { width: m.width, height: m.height },
        { width: window.innerWidth, height: window.innerHeight },
        align,
      ),
    );
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    // Scroll/resize menggeser pemicu → posisi lama salah; tutup saja.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative">
      <IconButton
        icon={MoreHorizontal}
        label={label}
        onClick={() => setOpen((v) => !v)}
      />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
            className="qv-pop z-50 min-w-[160px] overflow-hidden rounded-xl border border-line bg-raised p-1 shadow-xl"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
