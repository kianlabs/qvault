// QVAULT — pencocokan logo perusahaan dari hostname item vault.
//
// PRIVASI: seluruh data ikon dibundel lokal (lihat brand-logos-data.ts); fungsi
// ini hanya melakukan pencocokan string di memori — TIDAK ada permintaan
// jaringan, sehingga hostname item tidak pernah bocor ke luar.
import { BRAND_DOMAINS, BRAND_ICONS, type BrandLogo } from "./brand-logos-data";

/** Buang prefix `www.` dan normalisasi ke huruf kecil. */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * Logo brand untuk sebuah hostname (mis. "accounts.google.com" → Google).
 *
 * Pencocokan: domain persis, lalu naik satu label pada satu waktu
 * ("a.b.google.com" → "b.google.com" → "google.com"). Domain brand HARUS
 * berupa sufiks berlabel utuh — "google.com.evil.com" TIDAK cocok.
 */
export function brandForHost(host: string | null | undefined): BrandLogo | null {
  if (!host) return null;
  let candidate = normalizeHost(host);
  if (!candidate) return null;

  while (candidate.includes(".")) {
    const slug = BRAND_DOMAINS[candidate];
    if (slug) {
      const logo = BRAND_ICONS[slug];
      if (logo) return logo;
    }
    candidate = candidate.slice(candidate.indexOf(".") + 1);
  }
  return null;
}
