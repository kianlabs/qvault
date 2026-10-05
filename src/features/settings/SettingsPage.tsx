// QVAULT — Settings (route "/settings"). Persists display/appearance/security
// preferences via useSettingsStore, plus vault maintenance (rotate master
// password, recovery code, reset) through the security API.
// Wave 3: menambah section "Data" (backup/restore terenkripsi, CSV, templates)
// dan section "About" (WAVE3-CONTRACT.md §B).
// UI: Calm Precision design system — lapisan tampilan saja, logika tidak diubah.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Database,
  Download,
  Globe,
  HardDriveDownload,
  History,
  Info,
  KeyRound,
  Loader2,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { withAutoLockPaused } from "../../lib/auto-lock";
import { api } from "../../lib/api";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useDataStore } from "../../store/useDataStore";
import { useToast } from "../../components/Toast";
import Modal from "../../components/Modal";
import AboutCard from "../../components/AboutCard";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  IconButton,
  Input,
  PageHeader,
  RowActions,
} from "../../components/ui";
import { cn, errorMessage } from "../../lib/utils";
import { staggerIn, useGsap } from "../../lib/motion";
import { ACCENTS, DEFAULT_ACCENT } from "../../lib/accents";
import type { BrowserKind, CsvKind, Theme } from "../../lib/types";
import { useThemeStore } from "../../store/useThemeStore";

/** Preset tema tambahan (di luar Light/Dark) — tetap tersedia, disajikan ringkas. */
const THEME_PRESETS: { id: Theme; label: string; swatch: string }[] = [
  { id: "slate", label: "Slate", swatch: "#0b1220" },
  { id: "nord", label: "Nord", swatch: "#2e3440" },
  { id: "sepia", label: "Sepia", swatch: "#f7f0e0" },
];

/** Ukuran font (paritas KeepR: Small / Medium / Large). */
const FONT_SIZES: { id: string; label: string; px: number }[] = [
  { id: "small", label: "Small", px: 13 },
  { id: "medium", label: "Medium", px: 15 },
  { id: "large", label: "Large", px: 18 },
];

const CSV_KINDS: { value: CsvKind; label: string }[] = [
  { value: "vault", label: "Vault" },
  { value: "notes", label: "Notes" },
  { value: "tasks", label: "Tasks" },
  { value: "income", label: "Income" },
];

const BROWSER_KINDS: { value: BrowserKind; label: string }[] = [
  { value: "chrome", label: "Chrome" },
  { value: "bitwarden", label: "Bitwarden" },
];

export default function SettingsPage() {
  const toast = useToast();
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const update = useSettingsStore((s) => s.update);
  const lock = useAuthStore((s) => s.lock);

  const templates = useDataStore((s) => s.templates);
  const loadTemplates = useDataStore((s) => s.loadTemplates);
  const saveTemplate = useDataStore((s) => s.saveTemplate);
  const removeTemplate = useDataStore((s) => s.removeTemplate);

  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  // Tema dikelola store global agar tombol toggle di Sidebar & grid di sini
  // selalu sinkron. Persistensi ditangani store (optimistic + backend).
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const syncTheme = useThemeStore((s) => s.sync);
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);
  const [fontSize, setFontSize] = useState(15);
  // Wave 5 — tampilkan favicon situs di daftar vault (default true).
  const [showIcons, setShowIcons] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [autoLockMin, setAutoLockMin] = useState(15);
  const [clipboardClearSec, setClipboardClearSec] = useState(30);
  const [saving, setSaving] = useState(false);

  // Data section state.
  const [backupPw, setBackupPw] = useState("");
  const [restorePw, setRestorePw] = useState("");
  const [csvKind, setCsvKind] = useState<CsvKind>("vault");
  const [dataBusy, setDataBusy] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplKind, setTplKind] = useState("note");
  const [tplBody, setTplBody] = useState("");

  // Wave 4 — auto-backup + import browser.
  const [backupBusy, setBackupBusy] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [backupPaths, setBackupPaths] = useState<string[]>([]);
  const [importKind, setImportKind] = useState<BrowserKind>("chrome");

  // Vault maintenance dialogs.
  const [pwdOpen, setPwdOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [recovery, setRecovery] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Entrance motion (presentation only): cascade the section stack on mount.
  const stackRef = useRef<HTMLDivElement>(null);
  useGsap(() => {
    staggerIn(stackRef.current, ":scope > *", { y: 8, stagger: 0.03 });
  }, []);

  useEffect(() => {
    void load();
    void loadTemplates();
  }, [load, loadTemplates]);

  useEffect(() => {
    if (!settings) return;
    setDisplayName(settings.displayName);
    setAvatar(settings.avatar ?? "");
    syncTheme(settings.theme);
    setAccent(settings.accent);
    setFontSize(settings.fontSize);
    setShowIcons(settings.showIcons);
    setAutoBackupEnabled(settings.autoBackupEnabled);
    setAutoLockMin(settings.autoLockMin);
    setClipboardClearSec(settings.clipboardClearSec);
  }, [settings, syncTheme]);

  async function persist(payload: Parameters<typeof update>[0], ok: string) {
    setSaving(true);
    try {
      await update(payload);
      toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Appearance diterapkan langsung (subtitle halaman menjanjikannya). Setelah
   * user berhenti mengubah selama 600ms, simpan ke backend + beri toast ringkas.
   * Mount pertama di-skip supaya tidak menulis ulang saat halaman dibuka.
   */
  const appearanceMounted = useRef(false);
  useEffect(() => {
    if (!settings) return;
    if (!appearanceMounted.current) {
      appearanceMounted.current = true;
      return;
    }
    const id = window.setTimeout(() => {
      void persist({ accent, fontSize, showIcons }, "Appearance saved");
    }, 600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, fontSize, showIcons]);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (next !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await api.changeMasterPassword(current, next);
      toast.success("Master password changed");
      setPwdOpen(false);
      setCurrent("");
      setNext("");
      setConfirmPw("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateRecovery() {
    try {
      const code = await api.generateRecoveryCode();
      setRecovery(code);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.resetVault(resetCode);
      toast.success("Vault reset — create a new master password");
      setResetOpen(false);
      await lock();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // --- Data section handlers -------------------------------------------------

  async function onExportBackup() {
    if (!backupPw) {
      toast.error("Enter a backup password first");
      return;
    }
    const path = await withAutoLockPaused(() =>
      save({
        title: "Export encrypted backup",
        defaultPath: `qvault-backup-${today()}.qvlt`,
        filters: [{ name: "QVAULT backup", extensions: ["qvlt"] }],
      }),
    );
    if (!path) return;
    setDataBusy(true);
    try {
      await api.exportBackup(path, backupPw);
      toast.success("Backup exported");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDataBusy(false);
    }
  }

  async function onImportBackup() {
    if (!restorePw) {
      toast.error("Enter the backup password first");
      return;
    }
    const path = await withAutoLockPaused(() =>
      open({
        title: "Restore from backup",
        multiple: false,
        filters: [{ name: "QVAULT backup", extensions: ["qvlt"] }],
      }),
    );
    if (!path) return;
    setDataBusy(true);
    try {
      await api.importBackup(path, restorePw);
      toast.success("Vault restored");
      await loadTemplates();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDataBusy(false);
    }
  }

  async function onExportCsv() {
    const path = await withAutoLockPaused(() =>
      save({
        title: "Export CSV",
        defaultPath: `qvault-${csvKind}-${today()}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      }),
    );
    if (!path) return;
    setDataBusy(true);
    try {
      await api.exportCsv(csvKind, path);
      toast.success("CSV exported");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDataBusy(false);
    }
  }

  async function onImportCsv() {
    const path = await withAutoLockPaused(() =>
      open({
        title: "Import CSV",
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      }),
    );
    if (!path) return;
    setDataBusy(true);
    try {
      const res = await api.importCsv(csvKind, path);
      toast.success(`Imported ${res.imported}, skipped ${res.skipped}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDataBusy(false);
    }
  }

  // --- Wave 4: auto-backup + import browser ---------------------------------

  async function onBackupNow() {
    setBackupBusy(true);
    try {
      const path = await api.autoBackupNow();
      toast.success(`Backup created: ${path}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBackupBusy(false);
    }
  }

  async function onShowBackups() {
    setBackupBusy(true);
    try {
      const paths = await api.listAutoBackups();
      setBackupPaths(paths);
      setShowBackups(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBackupBusy(false);
    }
  }

  async function onImportBrowser() {
    const path = await withAutoLockPaused(() =>
      open({
        title: `Import from ${importKind}`,
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      }),
    );
    if (!path) return;
    setDataBusy(true);
    try {
      const res = await api.importBrowserCsv(importKind, path);
      toast.success(`Imported ${res.imported}, skipped ${res.skipped}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDataBusy(false);
    }
  }

  async function onSaveTemplate(e: FormEvent) {
    e.preventDefault();
    if (!tplName.trim()) {
      toast.error("Template name is required");
      return;
    }
    try {
      await saveTemplate({ name: tplName.trim(), kind: tplKind, body: tplBody });
      toast.success("Template saved");
      setTplName("");
      setTplBody("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function onRemoveTemplate(id: string) {
    try {
      await removeTemplate(id);
      toast.success("Template removed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div ref={stackRef} className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Preferences are stored locally and applied immediately."
      />

      {/* Profile */}
      <Section icon={User} title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Avatar URL">
            <Input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>
        <SaveButton
          saving={saving}
          onClick={() =>
            persist({ displayName, avatar: avatar || null }, "Profile saved")
          }
        />
      </Section>

      {/* Appearance — applied immediately (no Save button). */}
      <Section
        icon={Palette}
        title="Appearance"
        hint="Applied immediately"
      >
        {/* Theme — Light / Dark segmented (paritas KeepR). */}
        <Field label="Theme">
          <div className="inline-flex rounded-xl border border-line bg-surface p-1">
            {(["light", "dark"] as const).map((id) => {
              const active = theme === id;
              const Icon = id === "light" ? Sun : Moon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {id === "light" ? "Light" : "Dark"}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Extra presets — tetap tersedia bagi yang ingin nuansa lain. */}
        <Field label="Theme presets">
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  theme === t.id
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-full border border-line"
                  style={{ backgroundColor: t.swatch }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Accent colour — enam aksen bernama (paritas KeepR). */}
        <Field label="Accent colour">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACCENTS.map((a) => {
              const active = accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150",
                    active
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: a.light }}
                  />
                  {a.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Font size — Small / Medium / Large segmented (paritas KeepR). */}
        <Field label="Font size">
          <div className="inline-flex rounded-xl border border-line bg-surface p-1">
            {FONT_SIZES.map((f) => {
              const active = fontSize === f.px;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFontSize(f.px)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Website icons — On / Off segmented (paritas KeepR). */}
        <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Website icons</p>
            <p className="mt-0.5 text-xs text-muted">
              Shows each site's initial as a local avatar. Icons are rendered
              entirely offline — no domains, URLs, or usernames ever leave this
              device.
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-xl border border-line bg-surface p-1">
            {([true, false] as const).map((on) => {
              const active = showIcons === on;
              return (
                <button
                  key={String(on)}
                  type="button"
                  onClick={() => setShowIcons(on)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {on ? "On" : "Off"}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section icon={ShieldCheck} title="Security">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auto-lock after (minutes)">
            <Input
              type="number"
              min={0}
              value={autoLockMin}
              onChange={(e) => setAutoLockMin(Number(e.target.value))}
            />
          </Field>
          <Field label="Clear clipboard after (seconds)">
            <Input
              type="number"
              min={5}
              value={clipboardClearSec}
              onChange={(e) => setClipboardClearSec(Number(e.target.value))}
            />
          </Field>
        </div>
        <SaveButton
          saving={saving}
          onClick={() =>
            persist({ autoLockMin, clipboardClearSec }, "Security saved")
          }
        />

        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <Button
            variant="secondary"
            icon={KeyRound}
            onClick={() => setPwdOpen(true)}
          >
            Change master password
          </Button>
          <Button variant="secondary" icon={RefreshCw} onClick={onGenerateRecovery}>
            Generate recovery code
          </Button>
        </div>
      </Section>

      {/* Data */}
      <Section icon={Database} title="Data">
        {/* Backup vault */}
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Backup vault</p>
            <p className="text-xs text-muted">
              Export an encrypted copy of every item, note, task and folder.
            </p>
          </div>
          <Field label="Backup password">
            <Input
              type="password"
              value={backupPw}
              onChange={(e) => setBackupPw(e.target.value)}
              placeholder="Encrypt the backup with…"
            />
          </Field>
          <Button variant="primary" onClick={onExportBackup} disabled={dataBusy}>
            {dataBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export backup
          </Button>
        </div>

        {/* Restore vault */}
        <div className="space-y-3 rounded-xl border border-danger/30 bg-danger-soft p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Restore vault</p>
            <p className="text-xs text-danger">
              This will REPLACE all current data with the backup.
            </p>
          </div>
          <Field label="Backup password">
            <Input
              type="password"
              value={restorePw}
              onChange={(e) => setRestorePw(e.target.value)}
              placeholder="Password used for the backup…"
            />
          </Field>
          <Button
            variant="danger"
            onClick={onImportBackup}
            disabled={dataBusy}
          >
            {dataBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Restore from file
          </Button>
        </div>

        {/* CSV export / import */}
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">CSV export / import</p>
            <p className="text-xs text-muted">
              Move data in and out as plain-text spreadsheets.
            </p>
          </div>
          <Field label="Data type">
            <select
              value={csvKind}
              onChange={(e) => setCsvKind(e.target.value as CsvKind)}
              className="field"
            >
              {CSV_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={Download}
              onClick={onExportCsv}
              disabled={dataBusy}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              icon={Upload}
              onClick={onImportCsv}
              disabled={dataBusy}
            >
              Import CSV
            </Button>
          </div>
        </div>

        {/* Auto-backup (Wave 4) */}
        {/* Auto-backup (Wave 4) */}
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Backups</p>
            <p className="text-xs text-muted">
              Snapshot the encrypted database anytime — keeps the latest 5.
              Automatic snapshots run once every 24 hours while the app is open.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={onBackupNow}
              disabled={backupBusy}
            >
              {backupBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDriveDownload className="h-4 w-4" />
              )}
              Back up now
            </Button>
            <Button
              variant="secondary"
              icon={History}
              onClick={onShowBackups}
              disabled={backupBusy}
            >
              Show backups
            </Button>
          </div>

          {/* Toggle auto-backup */}
          <div>
            <p className="mb-2 text-xs font-medium text-ink">Automatic backups</p>
            <p className="mb-2 text-xs text-muted">
              Snapshot otomatis tiap 24 jam selama app berjalan; menyimpan 5 terbaru.
            </p>
            <div className="flex gap-2">
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => {
                    setAutoBackupEnabled(val);
                    void persist({ autoBackupEnabled: val }, "Backup settings saved");
                  }}
                  aria-pressed={autoBackupEnabled === val}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    autoBackupEnabled === val
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-bg text-muted hover:border-accent/50 hover:text-ink"
                  )}
                >
                  {val ? "On" : "Off"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Import from browser (Wave 4) */}
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Import from browser</p>
            <p className="text-xs text-muted">
              Bring passwords in from a Chrome, Chromium, Brave, Edge or
              Bitwarden CSV export.
            </p>
          </div>

          <details className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-ink">
              How to export a CSV
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Open your browser&apos;s password manager settings:{" "}
                <code className="rounded bg-raised px-1">
                  chrome://password-manager/settings
                </code>{" "}
                (Chrome / Chromium / Edge) or{" "}
                <code className="rounded bg-raised px-1">
                  brave://password-manager/settings
                </code>{" "}
                (Brave).
              </li>
              <li>
                Under <span className="text-ink">Export passwords</span>, choose{" "}
                <span className="text-ink">Download file</span> and confirm.
              </li>
              <li>
                If you use several browser profiles, repeat the export for each
                profile, then import them here one at a time.
              </li>
              <li>
                Pick the matching <span className="text-ink">Source</span> below,
                then click <span className="text-ink">Import CSV</span>.
              </li>
            </ol>
          </details>

          <div className="flex flex-wrap items-end gap-2">
            <Field label="Source" className="min-w-[180px]">
              <select
                value={importKind}
                onChange={(e) => setImportKind(e.target.value as BrowserKind)}
                className="field"
              >
                {BROWSER_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="secondary"
              onClick={onImportBrowser}
              disabled={dataBusy}
            >
              {dataBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Import CSV
            </Button>
          </div>
        </div>

        {/* Templates */}
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Templates</p>
            <p className="text-xs text-muted">Reusable note and task templates.</p>
          </div>

          {templates.length > 0 ? (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2"
                >
                  <p className="min-w-0 flex-1 truncate text-sm text-ink">
                    {t.name}
                  </p>
                  <Badge tone="neutral">{t.kind}</Badge>
                  <RowActions>
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${t.name}`}
                      tone="danger"
                      size="sm"
                      onClick={() => onRemoveTemplate(t.id)}
                    />
                  </RowActions>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No templates yet.</p>
          )}

          <form
            onSubmit={onSaveTemplate}
            className="space-y-3 border-t border-line pt-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Template name"
                />
              </Field>
              <Field label="Kind">
                <select
                  value={tplKind}
                  onChange={(e) => setTplKind(e.target.value)}
                  className="field"
                >
                  <option value="note">note</option>
                  <option value="task">task</option>
                </select>
              </Field>
            </div>
            <Field label="Body">
              <textarea
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                rows={3}
                className="field resize-y font-mono"
                placeholder="Template content or JSON…"
              />
            </Field>
            <Button variant="primary" type="submit" icon={Plus}>
              Save template
            </Button>
          </form>
        </div>
      </Section>

      {/* About */}
      <Section icon={Info} title="About">
        <AboutCard />
      </Section>

      {/* Danger zone */}
      <Card padding="lg" className="border-danger/30 bg-danger-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-danger">
          <AlertTriangle className="h-4 w-4" />
          Danger zone
        </h2>
        <p className="mt-2 max-w-prose text-xs text-muted">
          Resetting wipes every vault item, note, task and income entry. Only a
          valid recovery code can authorise it. This cannot be undone.
        </p>
        <div className="mt-4">
          <Button
            variant="danger"
            icon={AlertTriangle}
            onClick={() => setResetOpen(true)}
          >
            Reset vault
          </Button>
        </div>
      </Card>

      {/* Change password modal */}
      <Modal
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        title="Change master password"
      >
        <form onSubmit={onChangePassword} className="space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setPwdOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* Recovery code modal */}
      <Modal
        open={recovery !== null}
        onClose={() => setRecovery(null)}
        title="Your recovery code"
      >
        <p className="text-sm text-muted">
          Store this somewhere safe. It is the only way to reset the vault if you
          forget your master password.
        </p>
        <pre className="mt-4 select-all whitespace-pre-wrap rounded-xl border border-line bg-surface px-4 py-3 font-mono text-lg tracking-widest text-ink">
          {recovery}
        </pre>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={() => setRecovery(null)}>
            I&apos;ve saved it
          </Button>
        </div>
      </Modal>

      {/* Reset modal */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset vault"
      >
        <form onSubmit={onReset} className="space-y-4">
          <p className="text-sm text-muted">
            Enter your recovery code to wipe all data and start over.
          </p>
          <Field label="Recovery code">
            <Input
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              autoFocus
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={busy || !resetCode}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Wipe &amp; reset
            </Button>
          </div>
        </form>
      </Modal>

      {/* Auto-backup list modal (Wave 4) */}
      <Modal
        open={showBackups}
        onClose={() => setShowBackups(false)}
        title="Automatic backups"
      >
        {backupPaths.length > 0 ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {backupPaths.map((p) => (
              <li
                key={p}
                className="truncate rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink"
                title={p}
              >
                {p}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No automatic backups yet. Use “Back up now” to create one.
          </p>
        )}
      </Modal>
    </div>
  );
}

/** ISO date (yyyy-mm-dd) untuk default filename backup/CSV. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg">
      <CardHeader
        icon={icon}
        title={title}
        action={
          hint ? <Badge tone="neutral">{hint}</Badge> : undefined
        }
      />
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function SaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <div className="pt-1">
      <Button variant="primary" onClick={onClick} disabled={saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save
      </Button>
    </div>
  );
}
