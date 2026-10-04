// QVAULT — clipboard helper dengan auto-clear (WAVE4-CONTRACT.md §A.1).
// Copy teks ke clipboard lalu jadwalkan pengosongan OTOMATIS setelah N detik.
// Kalau isi clipboard sudah berubah (user copy hal lain), JANGAN dikosongkan.

/**
 * Timer id disimpan di Map level-modul. Setiap copy mendapat key unik sehingga
 * copy berikutnya TIDAK membatalkan jadwal copy sebelumnya. cancelClipboardClear
 * membatalkan SEMUA timer aktif.
 */
const timers = new Map<string, number>();

/** Counter untuk membuat key unik per copy. */
let nextTimerId = 0;

/** Batas minimum auto-clear (detik) supaya teks tidak keburu hilang. */
const MIN_CLEAR_SEC = 5;
/**
 * Copy `text` ke clipboard lalu OTOMATIS hapus setelah `clearAfterSec` detik.
 * Pengosongan hanya dilakukan bila clipboard masih berisi `text` yang sama
 * (dibaca via `readText()` di dalam try/catch — kalau gagal karena izin,
 * tetap dikosongkan; tidak melempar).
 */
export async function secureCopy(
  text: string,
  clearAfterSec: number,
): Promise<void> {
  await navigator.clipboard.writeText(text);

  const seconds = Math.max(
    MIN_CLEAR_SEC,
    Math.floor(Number(clearAfterSec)) || MIN_CLEAR_SEC,
  );

  const key = `timer-${nextTimerId++}`;
  const id = window.setTimeout(() => {
    timers.delete(key);
    void clearIfUnchanged(text);
  }, seconds * 1000);

  timers.set(key, id);
}

/** Batalkan SEMUA jadwal auto-clear yang masih aktif. */
export function cancelClipboardClear(): void {
  for (const id of timers.values()) {
    window.clearTimeout(id);
  }
  timers.clear();
}

/**
 * Kosongkan clipboard hanya bila isinya masih sama dengan `expected`.
 * Kalau `readText()` gagal (izin), tetap coba kosongkan; tidak pernah melempar.
 */
async function clearIfUnchanged(expected: string): Promise<void> {
  try {
    const current = await navigator.clipboard.readText();
    if (current !== expected) return; // user sudah copy hal lain — biarkan.
    await navigator.clipboard.writeText("");
  } catch {
    // Baca gagal karena izin → tetap coba kosongkan (best-effort).
    try {
      await navigator.clipboard.writeText("");
    } catch {
      // Clipboard benar-benar tidak tersedia — abaikan.
    }
  }
}
