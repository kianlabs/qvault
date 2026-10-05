/**
 * Bisakah sekelompok item duplikat digabung tanpa kehilangan secret 2FA?
 *
 * Saat merge, hanya TOTP milik item PRIMARY (elemen pertama) yang bertahan
 * (payload update tak memuat `totp` → backend mempertahankan milik primary).
 * Karena itu, bila ada anggota non-primary yang punya TOTP, merge DIBLOKIR
 * agar secret-nya tidak hilang diam-diam.
 */
export function mergeBlocksTotp(group: { hasTotp: boolean }[]): boolean {
  return group.slice(1).some((it) => it.hasTotp);
}

/**
 * Gabungkan catatan beberapa item duplikat menjadi satu nilai.
 *
 * Catatan bersifat multi-nilai: saat merge, item non-primary dihapus, jadi
 * menyimpan hanya catatan pertama akan menghancurkan catatan lain. Gabungkan
 * semua yang unik (setelah trim) dan non-kosong, dipisah baris kosong.
 */
export function mergeNotes(group: { notes: string }[]): string {
  return [...new Set(group.map((it) => it.notes.trim()))]
    .filter(Boolean)
    .join("\n\n");
}
