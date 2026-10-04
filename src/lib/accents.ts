// QVAULT — accent system (KeepR parity).
//
// KeepR tidak memakai satu warna aksen tetap. Ia menawarkan enam aksen
// bernama (Sage, Clay, Slate, Moss, Stone, Dusk) yang punya dua varian: satu
// lebih gelap untuk mode terang, satu lebih terang untuk mode gelap. Nilai
// aksen disimpan sebagai string di settings — bisa id bernama ("slate") atau
// hex bebas ("#8fb6cb") bila pengguna memilih warna kustom.

export interface AccentDef {
  id: string;
  label: string;
  /** Varian untuk mode terang (lebih gelap agar kontras teks putih). */
  light: string;
  /** Varian untuk mode gelap (lebih terang agar terbaca di kanvas gelap). */
  dark: string;
}

export const ACCENTS: AccentDef[] = [
  { id: "sage", label: "Sage", light: "#43755b", dark: "#86c9a4" },
  { id: "clay", label: "Clay", light: "#9a5341", dark: "#e0a08c" },
  { id: "slate", label: "Slate", light: "#486a7c", dark: "#8fb6cb" },
  { id: "moss", label: "Moss", light: "#427551", dark: "#85c293" },
  { id: "stone", label: "Stone", light: "#6e6553", dark: "#c7bba3" },
  { id: "dusk", label: "Dusk", light: "#7f5b84", dark: "#c09cc6" },
];

/** Aksen bawaan = Slate (persis KeepR). */
export const DEFAULT_ACCENT = "slate";

/** Terima "#rgb" / "#rrggbb" → [r,g,b]; fallback ke slate bila tak valid. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [78, 115, 135];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Luminance relatif (0..1) untuk memilih warna teks di atas aksen. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Warna teks yang kontras di atas latar aksen (putih atau tinta gelap). */
export function accentForeground(hex: string): string {
  return luminance(hex) > 0.55 ? "#0b0e13" : "#ffffff";
}

/** Ubah hex → rgba() dengan alpha tertentu (untuk latar soft). */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Rasio kontras WCAG antara dua hex (1..21). */
function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** hex → [h(0..360), s(0..1), l(0..1)]. */
function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r0: h = (g0 - b0) / d + (g0 < b0 ? 6 : 0); break;
      case g0: h = (b0 - r0) / d + 2; break;
      default: h = (r0 - g0) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

/** [h(0..360), s(0..1), l(0..1)] → hex. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Pastikan warna aksen kustom punya kontras cukup terhadap permukaan tema.
 *
 * Warna hex kustom (mis. `#241f31`) tidak punya varian terang/gelap, jadi bisa
 * tenggelam: di kanvas gelap ia nyaris hitam (ikon aktif `text-accent` jadi tak
 * terlihat), di kanvas terang ia terlalu pucat. Fungsi ini menggeser lightness
 * (mempertahankan hue & saturasi) sampai rasio kontras ≥ target (default 4.5),
 * tanpa mengubah warna untuk kasus yang sudah aman.
 */
export function ensureAccentContrast(hex: string, surfaceHex: string, target = 4.5): string {
  if (contrastRatio(hex, surfaceHex) >= target) return hex;
  const surfaceLum = luminance(surfaceHex);
  const lighten = surfaceLum < 0.5; // kanvas gelap → terangkan aksen
  let [h, s, l] = hexToHsl(hex);
  for (let i = 0; i < 100; i++) {
    l += lighten ? 0.02 : -0.02;
    if (l <= 0 || l >= 1) break;
    const cand = hslToHex(h, s, l);
    if (contrastRatio(cand, surfaceHex) >= target) return cand;
  }
  return hslToHex(h, s, lighten ? 0.72 : 0.32);
}

/** Resolusi nilai aksen tersimpan → hex konkret untuk mode saat ini. */
export function accentBase(accent: string, isDark: boolean): string {
  const def = ACCENTS.find((a) => a.id === accent);
  if (def) return isDark ? def.dark : def.light;
  // Warna kustom (hex). Terangkan sedikit di mode gelap agar tetap terbaca.
  if (/^#?[0-9a-fA-F]{3,6}$/.test(accent.trim())) return accent.trim();
  return isDark ? "#8fb6cb" : "#4e7387";
}

/**
 * Terapkan aksen ke <html> sebagai CSS variable. Semua primitif UI membaca
 * `--accent`, `--accent-soft`, `--accent-strong`, dan `--accent-fg`, jadi satu
 * panggilan ini mewarnai ulang seluruh aplikasi.
 */
export function applyAccent(
  root: HTMLElement,
  accent: string,
  isDark: boolean,
): void {
  // Permukaan tema saat ini dipakai untuk auto-koreksi kontras aksen kustom.
  const surface =
    getComputedStyle(root).getPropertyValue("--surface").trim() || (isDark ? "#181a1f" : "#ffffff");
  const base = ensureAccentContrast(accentBase(accent, isDark), surface);
  root.style.setProperty("--accent", base);
  root.style.setProperty("--accent-soft", rgba(base, isDark ? 0.18 : 0.12));
  root.style.setProperty("--accent-strong", base);
  root.style.setProperty("--accent-fg", accentForeground(base));
}
