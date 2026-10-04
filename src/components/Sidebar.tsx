// QVAULT — left navigation (paritas KeepR).
//
// Struktur mengikuti KeepR: header profil (avatar + nama + toggle tema),
// lalu dua grup bernama (MODULES, TOOLS), dan blok utilitas di kaki sidebar
// (Activity Log, Settings, Lock). Item aktif ditandai pil aksen lembut.
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Calendar,
  FolderTree,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Lock,
  Moon,
  NotebookPen,
  Settings,
  Star,
  Sun,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/useAuthStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { isDarkTheme, useThemeStore } from "../store/useThemeStore";
import { useTasksStore } from "../store/useTasksStore";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Tampilkan badge jumlah (mis. task terbuka). */
  badge?: number;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

export default function Sidebar() {
  const displayName = useSettingsStore((s) => s.settings?.displayName ?? "");
  const avatar = useSettingsStore((s) => s.settings?.avatar ?? "");
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const lock = useAuthStore((s) => s.lock);

  // Badge jumlah task terbuka (paritas KeepR). Dimuat sekali bila belum ada.
  const tasks = useTasksStore((s) => s.items);
  const loadTasks = useTasksStore((s) => s.load);
  useEffect(() => {
    if (tasks.length === 0) void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openTasks = tasks.filter((t) => t.status !== "done").length;

  const dark = isDarkTheme(theme);
  const initials = (displayName.trim() || "Q").slice(0, 1).toUpperCase();

  const MODULES: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/vault", label: "Vault", icon: KeyRound },
    { to: "/notes", label: "Notes", icon: NotebookPen },
    { to: "/tasks", label: "Tasks", icon: ListChecks, badge: openTasks },
    { to: "/calendar", label: "Calendar", icon: Calendar },
    { to: "/income", label: "Income", icon: TrendingUp },
  ];

  const TOOLS: NavItem[] = [
    { to: "/folders", label: "Folders", icon: FolderTree },
    { to: "/favorites", label: "Favorites", icon: Star },
    { to: "/generator", label: "Generate Password", icon: Wand2 },
    { to: "/health", label: "Health", icon: HeartPulse },
  ];

  const GROUPS: NavGroup[] = [
    { heading: "Modules", items: MODULES },
    { heading: "Tools", items: TOOLS },
  ];

  const FOOTER: NavItem[] = [
    { to: "/activity", label: "Activity Log", icon: Activity },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface">
      {/* Profile header — avatar, nama, toggle tema (paritas KeepR). */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight text-ink">
            {displayName || "QVAULT"}
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.16em] text-faint">
            Life OS
          </p>
        </div>
        <button
          type="button"
          data-theme-toggle
          onClick={toggleTheme}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItemLink key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer utility — Activity Log, Settings, Lock. */}
      <div className="border-t border-line px-3 py-3">
        <div className="space-y-0.5">
          {FOOTER.map((item) => (
            <NavItemLink key={item.to} {...item} />
          ))}
          <button
            type="button"
            onClick={() => void lock()}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <Lock className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-muted" />
            Lock
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItemLink({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
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
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge != null && badge > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-raised px-1.5 text-[11px] font-semibold text-muted">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
