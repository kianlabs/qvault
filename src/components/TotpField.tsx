// QVAULT — TotpField (WAVE4-CONTRACT.md §A.3).
// Dipakai di modal detail item vault. Kalau item sudah punya 2FA: tampilkan
// kode 6 digit + countdown dan auto-refresh. Kalau belum: form untuk menambah
// secret base32.
import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import { secureCopy } from "../lib/clipboard";
import { useToast } from "./Toast";
import { cn, errorMessage } from "../lib/utils";

interface Props {
  itemId: string;
  hasTotp: boolean;
  onChanged: () => void;
}

export default function TotpField({ itemId, hasTotp, onChanged }: Props) {
  const toast = useToast();

  // Salinan lokal dari prop: berubah segera setelah Add/Remove sukses tanpa
  // perlu menutup modal. Disinkronkan lagi bila prop berubah.
  const [enabled, setEnabled] = useState(hasTotp);
  useEffect(() => {
    setEnabled(hasTotp);
  }, [hasTotp]);

  // --- state untuk item yang SUDAH punya 2FA ---
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [period, setPeriod] = useState(30);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // --- state untuk item yang BELUM punya 2FA ---
  const [secret, setSecret] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  /** Ambil kode TOTP terbaru dari backend. */
  const fetchCode = useCallback(async () => {
    try {
      const res = await api.getTotpCode(itemId);
      setCode(res.code);
      setSeconds(res.secondsRemaining);
      setPeriod(res.period || 30);
      setCodeError(null);
    } catch (err) {
      setCodeError(errorMessage(err));
    }
  }, [itemId]);

  useEffect(() => {
    if (!enabled) return;
    void fetchCode();

    // Countdown lokal tiap 1s; saat mencapai 0 → ambil kode baru.
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          void fetchCode();
          return period;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [enabled, fetchCode, period]);

  async function onCopy() {
    if (!code) return;
    try {
      await secureCopy(code, 20);
      toast.success("Code copied · clears in 20s");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  async function onRemove() {
    setRemoving(true);
    try {
      await api.clearTotpSecret(itemId);
      toast.success("2FA removed");
      setEnabled(false);
      setCode("");
      setCodeError(null);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  async function onAdd() {
    const value = secret.trim();
    if (!value) {
      setAddError("Enter a 2FA secret first");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await api.setTotpSecret(itemId, value);
      toast.success("2FA enabled");
      setSecret("");
      setEnabled(true);
      onChanged();
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  // -------------------------------------------------------------------------
  // Item sudah punya 2FA
  // -------------------------------------------------------------------------
  if (enabled) {
    const pct = period > 0 ? (seconds / period) * 100 : 0;
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          Two-factor code
        </div>

        {codeError ? (
          <p className="text-xs text-red-300">{codeError}</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl tracking-widest text-ink">
                {code ? code.replace(/(\d{3})(\d{3})/, "$1 $2") : "••• •••"}
              </span>
              <span className="text-xs text-muted">{seconds}s</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  aria-label="Copy code"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void onRemove()}
                  disabled={removing}
                  aria-label="Remove 2FA"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                >
                  {removing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Progress bar countdown. */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-linear",
                  pct > 30 ? "bg-accent" : "bg-amber-400",
                )}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Item belum punya 2FA
  // -------------------------------------------------------------------------
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-accent" />
        Two-factor authentication
      </div>
      <div className="flex gap-2">
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Paste 2FA secret (base32)"
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={adding}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {adding && <Loader2 className="h-4 w-4 animate-spin" />}
          Add 2FA
        </button>
      </div>
      {addError && <p className="mt-2 text-xs text-red-300">{addError}</p>}
    </div>
  );
}
