// QVAULT — Settings (route "/settings"). Persists display/appearance/security
// preferences via useSettingsStore, plus vault maintenance (rotate master
// password, recovery code, reset) through the security API.
// Wave 3: menambah section "Data" (backup/restore terenkripsi, CSV, templates)
// dan section "About" (WAVE3-CONTRACT.md §B).
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api } from "../../lib/api";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useDataStore } from "../../store/useDataStore";
import { useToast } from "../../components/Toast";
import Modal from "../../components/Modal";
import AboutCard from "../../components/AboutCard";
import { cn, errorMessage } from "../../lib/utils";
import type { BrowserKind, CsvKind, Theme } from "../../lib/types";

const ACCENTS = ["#7c5cff", "#22d3ee", "#34d399", "#f472b6", "#f59e0b"];

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
  const [theme, setTheme] = useState<Theme>("dark");
  const [accent, setAccent] = useState("#7c5cff");
  const [fontSize, setFontSize] = useState(16);
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
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
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

  useEffect(() => {
    void load();
    void loadTemplates();
  }, [load, loadTemplates]);

  useEffect(() => {
    if (!settings) return;
    setDisplayName(settings.displayName);
    setAvatar(settings.avatar ?? "");
    setTheme(settings.theme);
    setAccent(settings.accent);
    setFontSize(settings.fontSize);
    setAutoLockMin(settings.autoLockMin);
    setClipboardClearSec(settings.clipboardClearSec);
  }, [settings]);

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
    const path = await save({
      title: "Export encrypted backup",
      defaultPath: `qvault-backup-${today()}.qvlt`,
      filters: [{ name: "QVAULT backup", extensions: ["qvlt"] }],
    });
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
    const path = await open({
      title: "Restore from backup",
      multiple: false,
      filters: [{ name: "QVAULT backup", extensions: ["qvlt"] }],
    });
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
    const path = await save({
      title: "Export CSV",
      defaultPath: `qvault-${csvKind}-${today()}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
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
    const path = await open({
      title: "Import CSV",
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
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
    const path = await open({
      title: `Import from ${importKind}`,
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Preferences are stored locally and applied immediately.
        </p>
      </header>

      {/* Profile */}
      <Section icon={User} title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls}
              placeholder="Your name"
            />
          </Field>
          <Field label="Avatar URL">
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className={inputCls}
              placeholder="https://…"
            />
          </Field>
        </div>
        <SaveButton
          saving={saving}
          onClick={() =>
            persist(
              { displayName, avatar: avatar || null },
              "Profile saved",
            )
          }
        />
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title="Appearance">
        <Field label="Theme">
          <div className="flex gap-2">
            {(["dark", "light"] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm capitalize transition",
                  theme === t
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {t === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Accent colour">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                aria-label={`Accent ${c}`}
                style={{ backgroundColor: c }}
                className={cn(
                  "h-8 w-8 rounded-lg border-2 transition",
                  accent.toLowerCase() === c.toLowerCase()
                    ? "border-ink"
                    : "border-transparent",
                )}
              />
            ))}
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-surface"
            />
          </div>
        </Field>

        <Field label={`Font size — ${fontSize}px`}>
          <input
            type="range"
            min={12}
            max={20}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
        </Field>

        <SaveButton
          saving={saving}
          onClick={() =>
            persist({ theme, accent, fontSize }, "Appearance saved")
          }
        />
      </Section>

      {/* Security */}
      <Section icon={ShieldCheck} title="Security">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auto-lock after (minutes)">
            <input
              type="number"
              min={0}
              value={autoLockMin}
              onChange={(e) => setAutoLockMin(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Clear clipboard after (seconds)">
            <input
              type="number"
              min={0}
              value={clipboardClearSec}
              onChange={(e) => setClipboardClearSec(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>
        <SaveButton
          saving={saving}
          onClick={() =>
            persist({ autoLockMin, clipboardClearSec }, "Security saved")
          }
        />

        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setPwdOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
          >
            <KeyRound className="h-4 w-4" />
            Change master password
          </button>
          <button
            type="button"
            onClick={onGenerateRecovery}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
          >
            <RefreshCw className="h-4 w-4" />
            Generate recovery code
          </button>
        </div>
      </Section>

      {/* Data */}
      <Section icon={Database} title="Data">
        {/* Backup vault */}
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div>
            <p className="text-sm font-medium text-ink">Backup vault</p>
            <p className="text-xs text-muted">
              Export an encrypted copy of every item, note, task and setting.
            </p>
          </div>
          <Field label="Backup password">
            <input
              type="password"
              value={backupPw}
              onChange={(e) => setBackupPw(e.target.value)}
              className={inputCls}
              placeholder="Encrypt the backup with…"
            />
          </Field>
          <button
            type="button"
            onClick={onExportBackup}
            disabled={dataBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {dataBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export backup
          </button>
        </div>

        {/* Restore vault */}
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div>
            <p className="text-sm font-medium text-ink">Restore vault</p>
            <p className="text-xs text-red-300">
              This will REPLACE all current data with the backup.
            </p>
          </div>
          <Field label="Backup password">
            <input
              type="password"
              value={restorePw}
              onChange={(e) => setRestorePw(e.target.value)}
              className={inputCls}
              placeholder="Password used for the backup…"
            />
          </Field>
          <button
            type="button"
            onClick={onImportBackup}
            disabled={dataBusy}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {dataBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Restore from file
          </button>
        </div>

        {/* CSV export / import */}
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div>
            <p className="text-sm font-medium text-ink">CSV export / import</p>
            <p className="text-xs text-muted">
              Move data in and out as plain-text spreadsheets.
            </p>
          </div>
          <Field label="Data type">
            <select
              value={csvKind}
              onChange={(e) => setCsvKind(e.target.value as CsvKind)}
              className={inputCls}
            >
              {CSV_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={dataBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={onImportCsv}
              disabled={dataBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
          </div>
        </div>

        {/* Auto-backup (Wave 4) */}
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Automatic backups</p>
              <p className="text-xs text-muted">
                Snapshot the encrypted database on a schedule. Keeps the last 5.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoBackupEnabled}
              aria-label="Enable automatic backups"
              onClick={() => setAutoBackupEnabled((v) => !v)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full border transition",
                autoBackupEnabled
                  ? "border-accent bg-accent"
                  : "border-line bg-surface",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                  autoBackupEnabled ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBackupNow}
              disabled={backupBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {backupBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDriveDownload className="h-4 w-4" />
              )}
              Back up now
            </button>
            <button
              type="button"
              onClick={onShowBackups}
              disabled={backupBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-50"
            >
              <History className="h-4 w-4" />
              Show backups
            </button>
          </div>
        </div>

        {/* Import from browser (Wave 4) */}
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div>
            <p className="text-sm font-medium text-ink">Import from browser</p>
            <p className="text-xs text-muted">
              Bring passwords in from a Chrome or Bitwarden CSV export.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Source">
              <select
                value={importKind}
                onChange={(e) => setImportKind(e.target.value as BrowserKind)}
                className={inputCls}
              >
                {BROWSER_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={onImportBrowser}
              disabled={dataBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-50"
            >
              {dataBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Import CSV
            </button>
          </div>
        </div>

        {/* Templates */}
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div>
            <p className="text-sm font-medium text-ink">Templates</p>
            <p className="text-xs text-muted">
              Reusable note and task templates.
            </p>
          </div>

          {templates.length > 0 ? (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{t.name}</p>
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {t.kind}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveTemplate(t.id)}
                    aria-label={`Delete ${t.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className={inputCls}
                  placeholder="Template name"
                />
              </Field>
              <Field label="Kind">
                <select
                  value={tplKind}
                  onChange={(e) => setTplKind(e.target.value)}
                  className={inputCls}
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
                className={cn(inputCls, "resize-y font-mono")}
                placeholder="Template content or JSON…"
              />
            </Field>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Save template
            </button>
          </form>
        </div>
      </Section>

      {/* About */}
      <Section icon={Info} title="About">
        <AboutCard />
      </Section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-red-300">
          <AlertTriangle className="h-4 w-4" />
          Danger zone
        </h2>
        <p className="mt-2 max-w-prose text-xs text-muted">
          Resetting wipes every vault item, note, task and income entry. Only a
          valid recovery code can authorise it. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <AlertTriangle className="h-4 w-4" />
          Reset vault
        </button>
      </section>

      {/* Change password modal */}
      <Modal
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        title="Change master password"
      >
        <form onSubmit={onChangePassword} className="space-y-4">
          <Field label="Current password">
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPwdOpen(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Update
            </button>
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
          <button
            type="button"
            onClick={() => setRecovery(null)}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            I've saved it
          </button>
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
            <input
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              className={inputCls}
              autoFocus
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !resetCode}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Wipe & reset
            </button>
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

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-elevated p-6">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-accent" />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
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
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save
      </button>
    </div>
  );
}
