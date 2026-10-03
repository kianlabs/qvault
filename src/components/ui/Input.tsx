// QVAULT — Input/Field (Calm Precision). Input teks + search standar.
import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

export default function Input({ icon: Icon, className, ...rest }: InputProps) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      )}
      <input
        className={cn("field", Icon && "pl-9", className)}
        {...rest}
      />
    </div>
  );
}

/** Input pencarian siap pakai (ikon Search). */
export function SearchInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <Input icon={Search} type="search" className={className} {...rest} />;
}

/** Label + kontrol form bertumpuk. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
