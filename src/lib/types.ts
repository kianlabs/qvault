// QVAULT — TypeScript mirrors of the frozen Rust models (SPEC.md §3).
// IDs = string (uuid v4). Timestamps = RFC3339 UTC strings. Booleans = bool.

/** Union of the valid `folders.kind` values (SPEC §3). */
export type FolderKind = "password" | "note" | "both";

/** Union of the valid `tasks.status` values (SPEC §3). */
export type TaskStatus = "todo" | "in_progress" | "done";

/** Convenience union for task priority (DB column is free-form TEXT). */
export type TaskPriority = "low" | "medium" | "high";

/** Theme preset persisted in settings. `dark`/`light` = default palettes;
 *  `slate`/`nord`/`sepia` are named presets (Wave 5). */
export type Theme = "dark" | "light" | "slate" | "nord" | "sepia";

// ---------------------------------------------------------------------------
// Security (security.rs)
// ---------------------------------------------------------------------------

/** Result of `vault_status`. */
export interface VaultStatus {
  initialized: boolean;
  locked: boolean;
  /** Bila ada, backend berjalan dengan DB in-memory sementara (data tidak persisten). */
  degraded?: string;
}

// ---------------------------------------------------------------------------
// Read models (decoded sensitive fields, camelCase)
// ---------------------------------------------------------------------------

/** `vault_items` row with `username`/`password`/`notes` decrypted. */
export interface VaultItem {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  folderId: string | null;
  favorite: boolean;
  icon: string | null;
  /** Wave 4 — true bila item punya secret 2FA (TOTP) tersimpan. */
  hasTotp: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `notes` row with `content` decrypted. */
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `tasks` row with `description` decrypted. */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  tags: string[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `income` row with `notes` decrypted. */
export interface Income {
  id: string;
  source: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** `folders` row. */
export interface Folder {
  id: string;
  name: string;
  color: string;
  kind: FolderKind;
  parentId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `activity_log` row. */
export interface ActivityEntry {
  id: string;
  module: string;
  action: string;
  itemName: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Payloads (write models) — SPEC §3
// ---------------------------------------------------------------------------

export interface VaultItemPayload {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  folderId: string | null;
  favorite: boolean;
  icon: string | null;
  /** Wave 4 — secret 2FA (base32) bila diisi. */
  totp?: string | null;
}

export interface NotePayload {
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  favorite: boolean;
}

export interface TaskPayload {
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  tags: string[];
  folderId: string | null;
}

export interface IncomePayload {
  source: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes: string;
}

export interface FolderPayload {
  name: string;
  color: string;
  kind: FolderKind;
  parentId: string | null;
  favorite: boolean;
}

// ---------------------------------------------------------------------------
// Settings (settings.rs)
// ---------------------------------------------------------------------------

/** `get_settings` return shape. */
export interface Settings {
  displayName: string;
  avatar: string | null;
  theme: Theme;
  accent: string;
  fontSize: number;
  autoLockMin: number;
  clipboardClearSec: number;
  /** Wave 5 — tampilkan ikon situs (favicon) di daftar vault. */
  showIcons: boolean;
  /** Scheduler backup otomatis (tiap 24 jam selama app berjalan). */
  autoBackupEnabled: boolean;
}

/** `update_settings` payload (partial merge of the settings fields). */
export type SettingsPayload = Partial<Settings>;

// ---------------------------------------------------------------------------
// Aggregates (tasks.rs / income.rs)
// ---------------------------------------------------------------------------

/** `dashboard_stats` return shape. */
export interface DashboardStats {
  totalItems: number;
  totalNotes: number;
  tasksOverdue: number;
  tasksToday: number;
  tasksDone: number;
  incomeThisMonth: number;
  recentActivity: ActivityEntry[];
  upcomingTasks: Task[];
}

/** One entry of `income_summary.byMonth`. */
export interface IncomeMonthTotal {
  month: string;
  total: number;
}

/** `income_summary` return shape. */
export interface IncomeSummary {
  thisMonth: number;
  allTime: number;
  byMonth: IncomeMonthTotal[];
}

// ---------------------------------------------------------------------------
// Wave 3 — Data / Templates / Backup (commands/data.rs)
// ---------------------------------------------------------------------------

/** `templates` row (Wave 3). */
export interface Template {
  id: string;
  name: string;
  /** 'note' | 'task' */
  kind: string;
  /** JSON string payload. */
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatePayload {
  name: string;
  kind: string;
  body: string;
}

/** Result of `import_csv`. */
export interface ImportResult {
  imported: number;
  skipped: number;
}

/** CSV export targets. */
export type CsvKind = "vault" | "notes" | "tasks" | "income";

// ---------------------------------------------------------------------------
// Wave 4 — TOTP (2FA) + auto-backup + browser import
// ---------------------------------------------------------------------------

/** `get_totp_code` return shape. */
export interface TotpCode {
  code: string;
  secondsRemaining: number;
  period: number;
}

/** `totp_status` return shape. */
export interface TotpStatus {
  hasSecret: boolean;
}

/** Browser CSV import sources. */
export type BrowserKind = "chrome" | "bitwarden";

// ---------------------------------------------------------------------------
// Wave 6 — password history (commands/vault.rs)
// ---------------------------------------------------------------------------

/** One old password for a vault item. */
export interface PasswordHistoryEntry {
  id: string;
  itemId: string;
  password: string;
  createdAt: string;
}

/** Result of `restore_password_history` (the entry displaced by the restore). */
export interface NewPasswordHistoryEntry {
  /** ID of the restored entry (removed after restore). */
  restoredId: string;
  /** The old current password, now pushed onto the history stack. */
  entry: PasswordHistoryEntry;
}

// ---------------------------------------------------------------------------
// List query params (camelCase arg keys matching SPEC §4)
// ---------------------------------------------------------------------------

export interface VaultListParams {
  search?: string;
  folderId?: string;
  favoriteOnly?: boolean;
}

export interface NoteListParams {
  search?: string;
  folderId?: string;
  favoriteOnly?: boolean;
}

export interface TaskListParams {
  status?: string;
  folderId?: string;
}

export interface IncomeListParams {
  search?: string;
}
