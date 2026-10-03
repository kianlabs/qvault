import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { ToastProvider } from "./components/Toast";
import UnlockScreen from "./features/auth/UnlockScreen";
import DashboardPage from "./features/dashboard/DashboardPage";
import VaultPage from "./features/vault/VaultPage";
import NotesPage from "./features/notes/NotesPage";
import TasksPage from "./features/tasks/TasksPage";
import CalendarPage from "./features/calendar/CalendarPage";
import IncomePage from "./features/income/IncomePage";
import FoldersPage from "./features/folders/FoldersPage";
import FavoritesPage from "./features/favorites/FavoritesPage";
import GeneratorPage from "./features/generator/GeneratorPage";
import ActivityPage from "./features/activity/ActivityPage";
import SettingsPage from "./features/settings/SettingsPage";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";

function Shell() {
  const location = useLocation();
  const { locked, refreshStatus } = useAuthStore();
  const { settings, load: loadSettings } = useSettingsStore();

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!locked) void loadSettings();
  }, [locked, loadSettings]);

  const theme = settings?.theme ?? "dark";
  const fontSize = settings?.fontSize ?? 16;
  const accent = settings?.accent ?? "#7c5cff";

  // apply theme + font size to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme !== "light");
    root.style.fontSize = `${fontSize}px`;
    root.style.setProperty("--accent", accent);
  }, [theme, fontSize, accent]);

  if (location.pathname === "/unlock") {
    return <UnlockScreen />;
  }
  if (locked) {
    return <Navigate to="/unlock" replace />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/vault" element={<VaultPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/folders" element={<FoldersPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/generator" element={<GeneratorPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ToastProvider>
  );
}
