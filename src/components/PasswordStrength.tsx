// QVAULT — password strength meter (SPEC §5 B4).
import { cn, passwordStrength } from "../lib/utils";

const TONES = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-emerald-500",
];

export default function PasswordStrength({ password }: { password: string }) {
  const { score, label, percent } = passwordStrength(password);
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all", TONES[score])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted">{password ? label : "—"}</p>
    </div>
  );
}
