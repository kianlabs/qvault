import { useCallback, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import CommandPalette from "./components/CommandPalette";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
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
import HealthPage from "./features/health/HealthPage";
import ActivityPage from "./features/activity/ActivityPage";
import SettingsPage from "./features/settings/SettingsPage";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { isDarkTheme, useThemeStore } from "./store/useThemeStore";
import { pageEnter, swapTheme } from "./lib/motion";
import { DEFAULT_ACCENT, applyAccent } from "./lib/accents";

/**
 * Auto-lock idle timer (Wave 4).
 * Sebelumnya setting `autoLockMin` hanya disimpan tapi TIDAK pernah dipakai —
 * vault tak pernah terkunci otomatis. Hook ini menutup celah itu: setiap
 * interaksi pengguna me-reset timer; saat idle melewati batas, vault dikunci.
 */
function useAutoLock(enabled: boolean, minutes: number) {
  const lock = useAuthStore((s) => s.lock);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || minutes <= 0) return;

    const arm = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void lock(), minutes * 60_000);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();

    return () => {
      events.forEach((e) => window.removeEventListener(e, arm));
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled, minutes, lock]);
}

function Shell() {
  const location = useLocation();
  const { locked, degraded, refreshStatus } = useAuthStore();
  const { settings, load: loadSettings } = useSettingsStore();
  const pageRef = useRef<HTMLDivElement>(null);
  /** Tema yang terakhir diterapkan — untuk tahu kapan harus animasi. */
  const appliedThemeRef = useRef<string | null>(null);

  // Transisi halaman: konten masuk halus setiap rute berubah.
  useEffect(() => {
    pageEnter(pageRef.current);
  }, [location.pathname]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!locked) void loadSettings();
  }, [locked, loadSettings]);

  const theme = useThemeStore((s) => s.theme);
  const syncTheme = useThemeStore((s) => s.sync);
  const fontSize = settings?.fontSize ?? 16;
  const accent = settings?.accent ?? DEFAULT_ACCENT;
  const autoLockMin = settings?.autoLockMin ?? 0;

  // Sinkronkan tema dari settings backend saat pertama dimuat.
  useEffect(() => {
    if (settings?.theme) syncTheme(settings.theme);
  }, [settings?.theme, syncTheme]);

  // Auto-lock aktif hanya saat vault terbuka.
  useAutoLock(!locked && autoLockMin > 0, autoLockMin);

  // Terapkan tema + aksen + skema warna ke <html> sebagai satu mutasi sinkron.
  // Dipisah jadi fungsi supaya bisa dijalankan di dalam callback View Transition
  // (browser mengambil snapshot tepat sebelum & sesudah pemanggilan ini).
  const applyThemeNow = useCallback(() => {
    const root = document.documentElement;
    const presets = ["light", "dark", "slate", "nord", "sepia"];
    presets.forEach((p) => root.classList.remove(p));
    root.classList.add(theme);
    if (theme === "slate" || theme === "nord") root.classList.add("dark");
    // Sinkronkan skema warna engine (canvas/scrollbar) dengan tema aktif.
    root.style.colorScheme = isDarkTheme(theme) ? "dark" : "light";
    applyAccent(root, accent, isDarkTheme(theme));
  }, [theme, accent]);

  // Transisi tema: saat tema/aksen berganti, ungkap tema baru dengan reveal
  // lingkaran dari tombol toggle (View Transitions API) — snapshot-based,
  // sehingga mulus tanpa repaint DOM. Render pertama dilewati (tanpa animasi).
  useEffect(() => {
    const key = `${theme}|${accent}`;
    if (appliedThemeRef.current === key) return;
    const first = appliedThemeRef.current === null;
    appliedThemeRef.current = key;
    if (first) {
      applyThemeNow();
      return;
    }
    swapTheme(applyThemeNow, document.querySelector("[data-theme-toggle]"));
  }, [theme, accent, applyThemeNow]);

  // Ukuran font diterapkan langsung (tanpa transisi) — menskalakan snapshot
  // akan membuat teks tampak buram.
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  if (location.pathname === "/unlock") {
    return <UnlockScreen />;
  }
  if (locked) {
    return <Navigate to="/unlock" replace />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg text-ink">
      <TitleBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {degraded && (
            <div className="border-b border-danger/30 bg-danger-soft px-8 py-2 text-xs font-medium text-danger">
              {degraded}
            </div>
          )}
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div
              key={location.pathname}
              ref={pageRef}
              className="mx-auto w-full max-w-[1400px] px-8 py-7"
            >
              <ErrorBoundary>
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
                  <Route path="/health" element={<HealthPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <CommandPalette />
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
