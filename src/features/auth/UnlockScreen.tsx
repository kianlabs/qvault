// QVAULT — master-password gate (SPEC §5 B4).
// Create the vault on first run, unlock it afterwards.
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { useToast } from "../../components/Toast";

export default function UnlockScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { initialized, loading, error, init, unlock, refreshStatus } =
    useAuthStore();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const creating = !initialized;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (creating && password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Master password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      if (creating) {
        await init(password);
        toast.success("Vault created");
      } else {
        await unlock(password);
        toast.success("Vault unlocked");
      }
      navigate("/", { replace: true });
    } catch {
      // store already holds the error message
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-line bg-elevated p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-ink">QVAULT</h1>
            <p className="mt-1 text-xs text-muted">
              {creating
                ? "Create a master password to secure your vault."
                : "Enter your master password to unlock."}
            </p>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-muted">
          Master password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="mb-3 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
          placeholder="••••••••"
        />

        {creating && (
          <>
            <label className="mb-1 block text-xs font-medium text-muted">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mb-3 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
              placeholder="••••••••"
            />
          </>
        )}

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {(busy || loading) && <Loader2 className="h-4 w-4 animate-spin" />}
          {creating ? "Create vault" : "Unlock"}
        </button>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
          Local-first. Your data is encrypted with Argon2id + AES-256-GCM and
          never leaves this device.
        </p>
      </form>
    </div>
  );
}
