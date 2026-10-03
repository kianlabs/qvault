// QVAULT — left navigation (Calm Precision).
// Nav dikelompokkan per domain supaya 12 tautan mudah dipindai, bukan satu
// daftar datar. Item aktif ditandai indikator aksen di kiri.
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    heading: "Vault",
    items: [
      { to: "/vault", label: "Items", icon: KeyRound },
      { to: "/folders", label: "Folders", icon: FolderTree },
      { to: "/favorites", label: "Favorites", icon: Star },
      { to: "/generator", label: "Generator", icon: Wand2 },
    ],
  },
  {
    heading: "Life",
    items: [
      { to: "/notes", label: "Notes", icon: NotebookPen },
      { to: "/tasks", label: "Tasks", icon: ListChecks },
      { to: "/calendar", label: "Calendar", icon: Calendar },
      { to: "/income", label: "Income", icon: TrendingUp },
    ],
  },
  {
    heading: "System",
    items: [
      { to: "/health", label: "Health", icon: HeartPulse },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-white">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-ink">QVAULT</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-faint">
            Life OS
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                      isActive
                        ? "bg-accent-soft font-medium text-ink"
                        : "text-muted hover:bg-raised hover:text-ink",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-accent" : "text-faint group-hover:text-muted",
                        )}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
