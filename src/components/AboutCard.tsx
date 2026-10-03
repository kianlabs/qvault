// QVAULT — About card (WAVE3-CONTRACT.md §B). Kartu identitas app yang
// ditampilkan di Settings → About. Murni presentasional, tanpa side-effect.
import { Sparkles } from "lucide-react";

const VERSION = "0.1.0";

export default function AboutCard() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink">QVAULT</p>
          <p className="text-xs text-muted">v{VERSION}</p>
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
    </div>
  );
}
