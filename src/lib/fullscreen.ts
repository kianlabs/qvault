// QVAULT — full screen helper (WAVE5-CONTRACT.md §F.1).
// Tipis di atas @tauri-apps/api/window. Semua dibungkus try/catch supaya app
// tidak crash saat dijalankan di luar Tauri (mis. `bun run dev` di browser),
// di mana API window bisa throw / tidak tersedia.
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Apakah window sedang fullscreen. */
export async function isFullscreen(): Promise<boolean> {
  try {
    const w = getCurrentWindow();
    return await w.isFullscreen();
  } catch {
    // Di luar Tauri (browser) → anggap tidak fullscreen.
    return false;
  }
}

/** Toggle fullscreen; kembalikan state baru. */
export async function toggleFullscreen(): Promise<boolean> {
  try {
    const w = getCurrentWindow();
    const next = !(await w.isFullscreen());
    await w.setFullscreen(next);
    return next;
  } catch {
    // Gagal / API tidak ada → tetap kembalikan false biar app aman.
    return false;
  }
}

/** Keluar dari fullscreen (diam-diam gagal bila API tidak ada). */
export async function exitFullscreen(): Promise<void> {
  try {
    const w = getCurrentWindow();
    await w.setFullscreen(false);
  } catch {
    // Best-effort: tidak ada yang bisa dilakukan kalau API tidak tersedia.
  }
}
