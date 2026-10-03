// QVAULT — Generator (route "/generator"). Fully local password generator:
// uses generatePassword()/passwordStrength() from lib/utils. No network.
// UI overhaul: "Calm Precision" design system (presentation only — no logic change).
import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Minus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";
import { useToast } from "../../components/Toast";
import PasswordStrength from "../../components/PasswordStrength";
import { secureCopy } from "../../lib/clipboard";
import { useSettingsStore } from "../../store/useSettingsStore";
import { generatePassword } from "../../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  IconButton,
  PageHeader,
  Toggle,
} from "../../components/ui";

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
      <PageHeader
        title="Password generator"
        subtitle="Strong random passwords, generated locally on this device."
      />

      <Card padding="lg">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-4">
          <Wand2 className="h-5 w-5 shrink-0 text-accent" />
          <code className="min-w-0 flex-1 break-all font-mono text-lg text-ink">
            {password || "—"}
          </code>
          <IconButton icon={RefreshCw} label="Regenerate" onClick={regenerate} />
          <IconButton icon={Copy} label="Copy password" onClick={copy} />
        </div>

        <div className="mt-4">
          <PasswordStrength password={password} />
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader icon={SlidersHorizontal} title="Options" />

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="gen-length" className="text-sm font-medium text-ink">
              Length
            </label>
            <Badge tone="neutral">{length}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <IconButton
              icon={Minus}
              label="Decrease length"
              onClick={() => adjustLength(-1)}
              className="border border-line"
            />
            <input
              id="gen-length"
              type="range"
              min={4}
              max={128}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[var(--accent)]"
            />
            <IconButton
              icon={Plus}
              label="Increase length"
              onClick={() => adjustLength(1)}
              className="border border-line"
            />
          </div>
        </div>

        <ul className="divide-y divide-line border-t border-line">
          {TOGGLE_DEFS.map(({ key, label }) => (
            <li key={key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-ink">{label}</span>
              <Toggle checked={toggles[key]} onChange={() => toggle(key)} label={label} />
            </li>
          ))}
        </ul>

        {!anyEnabled && (
          <p className="mt-3 text-xs text-danger">Select at least one character set.</p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={regenerate}
            disabled={!anyEnabled}
          >
            Generate
          </Button>
          <p className="text-[11px] leading-relaxed text-muted">
            Generated locally with <code>crypto.getRandomValues</code> — nothing is
            transmitted.
          </p>
        </div>
      </Card>
    </div>
  );
}
