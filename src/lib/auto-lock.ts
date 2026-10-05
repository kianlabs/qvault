/**
 * Jeda auto-lock saat dialog native (file picker / konfirmasi) terbuka.
 *
 * Masalah: auto-lock mengunci vault SEGERA saat window `blur`. Dialog native
 * membuat window kehilangan fokus, sehingga vault terkunci di tengah pemilihan
 * file — impor/ekspor selalu gagal.
 *
 * Solusi: saat dialog dibuka, tahan auto-lock; lepas lagi setelah dialog
 * selesai. Penghitung bersarang (nested) agar dialog bertumpuk tetap aman.
 */
let pauseCount = 0;

/** Tahan auto-lock (panggil sebelum membuka dialog native). */
export function pauseAutoLock(): void {
  pauseCount += 1;
}

/** Lepas tahanan auto-lock (panggil setelah dialog native selesai). */
export function resumeAutoLock(): void {
  if (pauseCount > 0) pauseCount -= 1;
}

/** Apakah auto-lock sedang ditahan. */
export function isAutoLockPaused(): boolean {
  return pauseCount > 0;
}

/**
 * Jalankan operasi (biasanya membuka dialog native) dengan auto-lock ditahan,
 * lalu lepas kembali apa pun hasilnya (sukses, batal, atau error).
 */
export async function withAutoLockPaused<T>(fn: () => Promise<T>): Promise<T> {
  pauseAutoLock();
  try {
    return await fn();
  } finally {
    resumeAutoLock();
  }
}
