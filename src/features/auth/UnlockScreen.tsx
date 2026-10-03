// QVAULT — master-password gate (Calm Precision).
// Create the vault on first run, unlock it afterwards.
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { useToast } from "../../components/Toast";
import { Button, Field } from "../../components/ui";

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
    <div className="flex h-full w-full items-center justify-center bg-bg px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-line bg-elevated p-7"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              QVAULT
            </h1>
            <p className="mt-1 text-xs text-muted">
              {creating
                ? "Create a master password to secure your vault."
                : "Enter your master password to unlock."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Master password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="field"
              placeholder="••••••••"
            />
          </Field>

          {creating && (
            <Field label="Confirm password">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field"
                placeholder="••••••••"
              />
            </Field>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={busy || loading}
          className="mt-5 w-full"
        >
          {(busy || loading) && <Loader2 className="h-4 w-4 animate-spin" />}
          {creating ? "Create vault" : "Unlock"}
        </Button>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
          Local-first · Argon2id + AES-256-GCM · never leaves this device.
        </p>
      </form>
    </div>
  );
}
