/**
 * Posisi menu dropdown (popover) dalam koordinat viewport.
 *
 * Menu dirender lewat portal ke <body>, jadi posisinya dihitung dari rect
 * tombol pemicu (trigger) + ukuran menu. Dipakai `Menu.tsx` agar dropdown
 * TIDAK terpotong oleh ancestor `overflow-hidden` (mis. Card daftar item).
 *
 * Aturan:
 * - default: di BAWAH trigger, dengan jeda kecil.
 * - flip ke ATAS bila tidak cukup ruang di bawah (tapi cukup di atas).
 * - selalu dijepit agar seluruh menu berada di dalam viewport.
 */
export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  top: number;
  left: number;
}

/** Jeda antara trigger dan menu (px). */
export const MENU_GAP = 4;
/** Margin minimum dari tepi viewport (px). */
export const MENU_MARGIN = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function menuPosition(
  trigger: Rect,
  menu: Size,
  viewport: Size,
  align: "left" | "right" = "right",
): Point {
  // Vertikal: bawah secara default, flip ke atas bila tak muat.
  let top = trigger.bottom + MENU_GAP;
  if (top + menu.height > viewport.height) {
    const above = trigger.top - MENU_GAP - menu.height;
    top = above >= MENU_MARGIN ? above : viewport.height - menu.height - MENU_MARGIN;
  }

  // Horizontal: sejajarkan ke tepi trigger, lalu jepit ke dalam viewport.
  let left = align === "right" ? trigger.right - menu.width : trigger.left;
  left = clamp(left, MENU_MARGIN, viewport.width - menu.width - MENU_MARGIN);

  // Jepit vertikal juga (mis. viewport lebih pendek dari menu).
  top = clamp(top, MENU_MARGIN, viewport.height - menu.height - MENU_MARGIN);

  return { top, left };
}
