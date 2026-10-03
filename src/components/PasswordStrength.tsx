// QVAULT — password strength meter (Calm Precision). Warna semantik tunggal.
import { cn, passwordStrength } from "../lib/utils";

const TONES = [
  "bg-danger",
  "bg-danger",
  "bg-warn",
  "bg-info",
  "bg-success",
];

export default function PasswordStrength({ password }: { password: string }) {
  const { score, label, percent } = passwordStrength(password);
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
        <div
          className={cn("h-full rounded-full transition-all", TONES[score])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted">{password ? label : "—"}</p>
    </div>
  );
}
