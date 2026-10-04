// QVAULT — About card (WAVE3-CONTRACT.md §B). Kartu identitas app yang
// ditampilkan di Settings → About. Menampilkan versi nyata dari bundle dan
// menyediakan tombol cek update manual.
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import Button from "./ui/Button";
import { useToast } from "./Toast";
import { useUpdaterStore } from "../store/useUpdaterStore";
import { checkForUpdate, isTauri } from "../lib/updater";

export default function AboutCard() {
  const toast = useToast();
  const showUpdate = useUpdaterStore((s) => s.show);
  const [version, setVersion] = useState<string>("0.1.3");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled && v) setVersion(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheck() {
    setChecking(true);
    try {
      const info = await checkForUpdate();
      if (info) {
        showUpdate(info);
        toast.info(`Update ${info.version} tersedia.`);
      } else {
        toast.success("Kamu sudah memakai versi terbaru.");
      }
    } catch (err) {
      toast.error(`Gagal memeriksa update: ${String(err)}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink">QVAULT</p>
          <p className="text-xs text-muted">v{version}</p>
        </div>
      </div>

      <p className="text-sm text-muted">
        Local-First Password Vault &amp; Life OS
      </p>

      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-sm font-semibold text-ink">Q = Ky</p>
        <p className="mt-0.5 text-xs text-muted">Q melambangkan Kyan</p>
      </div>

      <div className="space-y-1 text-xs text-muted">
        <p>100% offline · tanpa cloud · tanpa telemetri</p>
        <p className="font-mono">Argon2id · AES-256-GCM · SQLite</p>
      </div>

      <Button size="sm" onClick={handleCheck} disabled={checking}>
        <RefreshCw className={checking ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {checking ? "Memeriksa…" : "Cek update"}
      </Button>
    </div>
  );
}
