/**
 * Keputusan status banner/tab cek kebocoran — dipisah dari komponen agar
 * bisa diuji dan agar aturan "jujur" terkunci di satu tempat.
 *
 * - `breached` — ada password ditemukan di kebocoran (paling penting).
 * - `failed`   — tak ada temuan, TAPI sebagian password belum terverifikasi
 *                (jaringan/hash gagal). JANGAN pernah disebut "aman".
 * - `empty`    — tak satu pun password dicek (mis. semua item tanpa password).
 *                Ini BUKAN hasil bersih.
 * - `clean`    — semua password yang dicek benar-benar bersih.
 */
export type BreachStatus = "breached" | "failed" | "empty" | "clean";

export function breachStatus(input: {
  breached: number;
  failed: number;
  scanned: number;
}): BreachStatus {
  if (input.breached > 0) return "breached";
  if (input.failed > 0) return "failed";
  if (input.scanned === 0) return "empty";
  return "clean";
}
