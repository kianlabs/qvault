// QVAULT — Auto-update (Tauri updater plugin).
// Cek rilis baru dari endpoint yang dikonfigurasi di tauri.conf.json, lalu
// (opsional) unduh + pasang. Hanya aktif di lingkungan Tauri; di browser
// biasa fungsi check() mengembalikan null supaya UI tetap aman.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  /** Versi yang tersedia di server. */
  version: string;
  /** Versi aplikasi yang sedang berjalan. */
  currentVersion: string;
  /** Tanggal rilis (RFC 3339) bila disediakan. */
  date?: string;
  /** Catatan rilis bila disediakan. */
  body?: string;
}

/** Deteksi apakah kode berjalan di dalam Tauri (bukan browser biasa). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Cek ketersediaan update.
 * @returns info update, atau null bila sudah versi terbaru / bukan di Tauri.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  const update = await check();
  if (!update) return null;
  // Resource ini dipegang Rust; tutup karena kita hanya membaca metadata.
  const info: UpdateInfo = {
    version: update.version,
    currentVersion: update.currentVersion,
    date: update.date,
    body: update.body,
  };
  await update.close();
  return info;
}

/**
 * Unduh + pasang update, lalu minta aplikasi dijalankan ulang.
 * @param onProgress persentase 0-100 (bila content-length diketahui).
 */
export async function installUpdate(
  onProgress?: (percent: number) => void,
): Promise<void> {
  const update: Update | null = await check();
  if (!update) throw new Error("Tidak ada update untuk dipasang.");

  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      received += event.data.chunkLength;
      if (total > 0 && onProgress) {
        onProgress(Math.min(100, Math.round((received / total) * 100)));
      }
    }
  });
  await update.close();
  await relaunch();
}
