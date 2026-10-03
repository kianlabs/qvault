// QVAULT — Generator (route "/generator"). Fully local password generator:
// uses generatePassword()/passwordStrength() from lib/utils. No network.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { useToast } from "../../components/Toast";
import PasswordStrength from "../../components/PasswordStrength";
import { secureCopy } from "../../lib/clipboard";
import { useSettingsStore } from "../../store/useSettingsStore";
import { cn, generatePassword, passwordStrength } from "../../lib/utils";

interface Toggles {
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
}

const TOGGLE_DEFS: { key: keyof Toggles; label: string }[] = [
  { key: "uppercase", label: "Uppercase (A–Z)" },
  { key: "lowercase", label: "Lowercase (a–z)" },
  { key: "digits", label: "Digits (0–9)" },
  { key: "symbols", label: "Symbols (!@#…)" },
];

export default function GeneratorPage() {
  const toast = useToast();
  // Wave 4 — durasi auto-clear clipboard dari settings (fallback 30s).
  const clipboardClearSec =
    useSettingsStore((s) => s.settings?.clipboardClearSec) ?? 30;
  const [length, setLength] = useState(20);
  const [toggles, setToggles] = useState<Toggles>({
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
  });
  const [password, setPassword] = useState("");

  const anyEnabled = Object.values(toggles).some(Boolean);

  const regenerate = useCallback(() => {
    setPassword(generatePassword({ length, ...toggles }));
  }, [length, toggles]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const strength = useMemo(() => passwordStrength(password), [password]);

  function toggle(key: keyof Toggles) {
    setToggles((t) => ({ ...t, [key]: !t[key] }));
  }

  function adjustLength(delta: number) {
    setLength((n) => Math.max(4, Math.min(128, n + delta)));
  }

  async function copy() {
    if (!password) return;
    try {
      await secureCopy(password, clipboardClearSec);
      toast.success(`Password copied · clears in ${clipboardClearSec}s`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Password generator</h1>
        <p className="mt-1 text-sm text-muted">
          Strong random passwords, generated locally on this device.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-elevated p-6">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-4">
          <Wand2 className="h-5 w-5 shrink-0 text-accent" />
          <code className="min-w-0 flex-1 break-all font-mono text-lg text-ink">
            {password || "—"}
          </code>
          <button
            type="button"
            onClick={regenerate}
            aria-label="Regenerate"
            title="Regenerate"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy"
            title="Copy"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <PasswordStrength password={password} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-elevated p-6">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-ink">Length</label>
            <span className="rounded-lg border border-line px-2 py-0.5 text-sm text-muted">
              {length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustLength(-1)}
              aria-label="Decrease length"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={4}
              max={128}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => adjustLength(1)}
              aria-label="Increase length"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {TOGGLE_DEFS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition",
                toggles[key]
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {label}
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-md border",
                  toggles[key]
                    ? "border-accent bg-accent text-white"
                    : "border-line",
                )}
              >
                {toggles[key] && <ShieldCheck className="h-3 w-3" />}
              </span>
            </button>
          ))}
        </div>

        {!anyEnabled && (
          <p className="mt-3 text-xs text-red-400">
            Select at least one character set.
          </p>
        )}

        <button
          type="button"
          onClick={regenerate}
          disabled={!anyEnabled}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Generate
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Estimated strength: {strength.label} ({strength.percent}%). Generated
          with <code>crypto.getRandomValues</code> — nothing is transmitted.
        </p>
      </section>
    </div>
  );
}
