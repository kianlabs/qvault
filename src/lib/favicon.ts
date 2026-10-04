// QVAULT — helper favicon & inisial avatar (Wave 3, Agent D).
//
// PRIVASI: QVAULT adalah vault "local-first". Mengambil favicon dari layanan
// pihak ketiga (mis. google.com/s2/favicons) akan membocorkan hostname tiap
// item vault ke jaringan luar. Karena itu `faviconUrl` SELALU mengembalikan
// `null` → avatar otomatis jatuh ke inisial lokal (tanpa permintaan jaringan).
import { initials } from "./utils";

/**
 * URL favicon untuk sebuah URL.
 *
 * Selalu `null` (lihat catatan privasi di atas): tidak ada permintaan jaringan,
 * avatar dirender dari inisial lokal oleh pemanggil.
 */
export function faviconUrl(_url: string | null | undefined): string | null {
  return null;
}

/** Inisial untuk fallback avatar (delegasi ke `initials` di utils). */
export function avatarInitials(name: string): string {
  return initials(name);
}
