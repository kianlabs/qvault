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
  { id: "sage", label: "Sage", light: "#4f8a6b", dark: "#86c9a4" },
  { id: "clay", label: "Clay", light: "#b5624c", dark: "#e0a08c" },
  { id: "slate", label: "Slate", light: "#4e7387", dark: "#8fb6cb" },
  { id: "moss", label: "Moss", light: "#4e8a5f", dark: "#85c293" },
  { id: "stone", label: "Stone", light: "#8a7e68", dark: "#c7bba3" },
  { id: "dusk", label: "Dusk", light: "#8a6390", dark: "#c09cc6" },
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
  const base = accentBase(accent, isDark);
  root.style.setProperty("--accent", base);
  root.style.setProperty("--accent-soft", rgba(base, isDark ? 0.18 : 0.12));
  root.style.setProperty("--accent-strong", base);
  root.style.setProperty("--accent-fg", accentForeground(base));
}
