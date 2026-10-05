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
