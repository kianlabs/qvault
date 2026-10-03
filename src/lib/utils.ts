// QVAULT — shared utilities (SPEC.md §5 B1): cn(), formatters, password strength.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conditional support (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Date / time formatters
// ---------------------------------------------------------------------------

/** Parse an RFC3339 timestamp defensively; returns null when invalid. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `12 Oct 2025` — falls back to "—" on invalid input. */
export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** `12 Oct 2025, 14:30` local time. */
export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short relative time: "just now", "5m ago", "3h ago", "2d ago". */
export function formatRelative(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(value);
}

/** ISO `yyyy-mm-dd` for `<input type="date">`; empty string on invalid. */
export function toDateInput(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Number / currency formatters
// ---------------------------------------------------------------------------

/** `1,234.50` with 2 decimals. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Currency-aware amount, e.g. `Rp1,234.50` / `$1,234.50`. */
export function formatCurrency(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(value);
  } catch {
    // Unknown/invalid ISO code — fall back to plain number + code.
    return `${currency} ${formatNumber(value)}`;
  }
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Truncate to `n` characters, appending an ellipsis when clipped. */
export function truncate(text: string, n = 80): string {
  if (text.length <= n) return text;
  return `${text.slice(0, Math.max(0, n - 1))}…`;
}

/** Parse a comma-separated tag string into a trimmed, de-duped array. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

/** First grapheme of a title, uppercased — used for list avatars. */
export function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

/** Best-effort hostname from a URL for display (falls back to raw string). */
export function hostnameFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Password generator + strength
// ---------------------------------------------------------------------------

export interface PasswordStrength {
  /** 0..4 score (0 = empty/very weak, 4 = strong). */
  score: number;
  /** Human label for the score. */
  label: string;
  /** 0..100 percentage for meters. */
  percent: number;
}

/** Estimate password strength from length + character-class diversity. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "Empty", percent: 0 };
  }
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (classes >= 3) score++;
  if (password.length >= 16 && classes >= 4) score++;

  // Penalise trivially short secrets.
  if (password.length < 6) score = Math.min(score, 1);

  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const safeScore = Math.max(0, Math.min(4, score));
  return {
    score: safeScore,
    label: labels[safeScore],
    percent: safeScore * 25,
  };
}

export interface GenerateOptions {
  length?: number;
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
}

/** Generate a random password locally (no network). */
export function generatePassword(options: GenerateOptions = {}): string {
  const {
    length = 20,
    lowercase = true,
    uppercase = true,
    digits = true,
    symbols = true,
  } = options;

  const sets: string[] = [];
  if (lowercase) sets.push("abcdefghijklmnopqrstuvwxyz");
  if (uppercase) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (digits) sets.push("0123456789");
  if (symbols) sets.push("!@#$%^&*()-_=+[]{};:,.<>?");
  const pool = sets.join("");
  if (!pool) return "";

  const len = Math.max(4, Math.min(128, Math.floor(length)));
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += pool[bytes[i] % pool.length];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Extract a human message from an unknown thrown value (Tauri AppError). */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Unexpected error";
}
