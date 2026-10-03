// QVAULT — left navigation (SPEC §5 B4).
import { NavLink } from "react-router-dom";
import {
  Activity,
  Calendar,
  FolderTree,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Settings,
  Star,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { cn } from "../lib/utils";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/vault", label: "Vault", icon: KeyRound },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/folders", label: "Folders", icon: FolderTree },
  { to: "/favorites", label: "Favorites", icon: Star },
  { to: "/generator", label: "Generator", icon: Wand2 },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-elevated/40">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide text-ink">QVAULT</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Life OS
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {LINKS.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={"end" in rest ? rest.end : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                isActive
                  ? "bg-accent-soft font-medium text-ink"
                  : "text-muted hover:bg-white/5 hover:text-ink",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
          Q = Ky
        </p>
      </div>
    </aside>
  );
}
