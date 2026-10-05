// QVAULT — Have I Been Pwned "Pwned Passwords" check via k-anonymity.
//
// Kontrak privasi (k-anonymity): password TIDAK PERNAH dikirim. Kita hitung
// SHA-1 secara lokal, kirim HANYA 5 karakter hex pertama ke
// `api.pwnedpasswords.com/range/{prefix}`, lalu cocokkan sisa hash di sisi klien.
// API mengembalikan daftar "suffix:count" untuk semua password berawalan prefix itu.
//
// CSP: `connect-src` di `tauri.conf.json` sudah diizinkan ke host ini.

const RANGE_URL = "https://api.pwnedpasswords.com/range/";

/** Cache respons range (prefix → Map<suffix, count>) agar tidak fetch berulang. */
const rangeCache = new Map<string, Map<string, number>>();

/** SHA-1 heksadesimal huruf besar dari sebuah string (Web Crypto).
 *
 * `crypto.subtle` tersedia karena webview Tauri mendaftarkan skema kustomnya
 * sebagai secure context (wry: `register_uri_scheme_as_secure`). Bila tetap
 * tidak ada (mis. konteks tak aman), kita melempar — pemanggil WAJIB
 * melaporkan item sebagai "gagal dicek", bukan "aman". */
async function sha1HexUpper(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto unavailable — cannot compute SHA-1");
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Ambil (dan cache) satu range HIBP: peta suffix → jumlah kemunculan. */
async function fetchRange(prefix: string): Promise<Map<string, number>> {
  const cached = rangeCache.get(prefix);
  if (cached) return cached;

  const res = await fetch(`${RANGE_URL}${prefix}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!res.ok) {
    throw new Error(`HIBP request failed (${res.status})`);
  }
  const text = await res.text();
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    const [suffix, count] = line.trim().split(":");
    if (!suffix) continue;
    map.set(suffix.toUpperCase(), Number.parseInt(count ?? "0", 10) || 0);
  }
  rangeCache.set(prefix, map);
  return map;
}

/**
 * Berapa kali sebuah password muncul di kebocoran data publik.
 * 0 = tidak ditemukan (aman). Melempar error bila hash/jaringan gagal.
 */
export async function breachCount(password: string): Promise<number> {
  if (!password) return 0;
  const hash = await sha1HexUpper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const range = await fetchRange(prefix);
  return range.get(suffix) ?? 0;
}

/** Hasil cek massal: peta indeks → jumlah kebocoran, plus indeks yang GAGAL. */
export interface BreachScanResult {
  /** indeks password (dalam array input) → jumlah kemunculan (≥0). */
  counts: Map<number, number>;
  /** indeks password yang gagal dicek (jaringan/hash) — BELUM terverifikasi. */
  failed: number[];
}

/**
 * Cek banyak password dengan konkurensi terbatas (ramah ke API).
 *
 * Resilien per-item: satu kegagalan tidak menggagalkan seluruh batch, TAPI
 * kegagalan DILAPORKAN lewat `failed` supaya UI tidak pernah menampilkan
 * "aman" untuk password yang sebenarnya belum terverifikasi.
 */
export async function breachCounts(
  passwords: string[],
  concurrency = 5,
): Promise<BreachScanResult> {
  const counts = new Map<number, number>();
  const failed: number[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < passwords.length) {
      const i = cursor++;
      const pw = passwords[i];
      if (!pw) continue;
      try {
        counts.set(i, await breachCount(pw));
      } catch {
        failed.push(i);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, passwords.length) },
    () => worker(),
  );
  await Promise.all(workers);

  failed.sort((a, b) => a - b);
  return { counts, failed };
}
