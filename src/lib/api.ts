// QVAULT — typed wrappers over Tauri `invoke()` (SPEC.md §4 / §5 B1).
// One wrapper per command; argument keys are camelCase matching SPEC §4.
import { invoke } from "@tauri-apps/api/core";

import type {
  ActivityEntry,
  CsvKind,
  DashboardStats,
  Folder,
  FolderPayload,
  ImportResult,
  Income,
  IncomeListParams,
  IncomePayload,
  IncomeSummary,
  Note,
  NoteListParams,
  NotePayload,
  Settings,
  SettingsPayload,
  Task,
  TaskListParams,
  TaskPayload,
  Template,
  TemplatePayload,
  VaultItem,
  VaultItemPayload,
  VaultListParams,
  VaultStatus,
} from "./types";

export const api = {
  // --- security.rs ---------------------------------------------------------
  vaultStatus: () => invoke<VaultStatus>("vault_status"),
  initVault: (masterPassword: string) =>
    invoke<void>("init_vault", { masterPassword }),
  unlockVault: (masterPassword: string) =>
    invoke<void>("unlock_vault", { masterPassword }),
  lockVault: () => invoke<void>("lock_vault"),
  changeMasterPassword: (currentPassword: string, newPassword: string) =>
    invoke<void>("change_master_password", { currentPassword, newPassword }),
  generateRecoveryCode: () =>
    invoke<string>("generate_recovery_code"),
  resetVault: (recoveryCode: string) =>
    invoke<void>("reset_vault", { recoveryCode }),

  // --- vault.rs ------------------------------------------------------------
  listVaultItems: (p?: VaultListParams) =>
    invoke<VaultItem[]>("list_vault_items", {
      search: p?.search ?? null,
      folderId: p?.folderId ?? null,
      favoriteOnly: p?.favoriteOnly ?? null,
    }),
  createVaultItem: (payload: VaultItemPayload) =>
    invoke<VaultItem>("create_vault_item", { payload }),
  updateVaultItem: (id: string, payload: VaultItemPayload) =>
    invoke<VaultItem>("update_vault_item", { id, payload }),
  deleteVaultItem: (id: string) =>
    invoke<void>("delete_vault_item", { id }),
  toggleVaultFavorite: (id: string) =>
    invoke<void>("toggle_vault_favorite", { id }),
  revealVaultPassword: (id: string) =>
    invoke<string>("reveal_vault_password", { id }),

  // --- notes.rs ------------------------------------------------------------
  listNotes: (p?: NoteListParams) =>
    invoke<Note[]>("list_notes", {
      search: p?.search ?? null,
      folderId: p?.folderId ?? null,
      favoriteOnly: p?.favoriteOnly ?? null,
    }),
  createNote: (payload: NotePayload) =>
    invoke<Note>("create_note", { payload }),
  updateNote: (id: string, payload: NotePayload) =>
    invoke<Note>("update_note", { id, payload }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),
  duplicateNote: (id: string) => invoke<Note>("duplicate_note", { id }),
  toggleNoteFavorite: (id: string) =>
    invoke<void>("toggle_note_favorite", { id }),

  // --- tasks.rs ------------------------------------------------------------
  listTasks: (p?: TaskListParams) =>
    invoke<Task[]>("list_tasks", {
      status: p?.status ?? null,
      folderId: p?.folderId ?? null,
    }),
  createTask: (payload: TaskPayload) =>
    invoke<Task>("create_task", { payload }),
  updateTask: (id: string, payload: TaskPayload) =>
    invoke<Task>("update_task", { id, payload }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  setTaskStatus: (id: string, status: string) =>
    invoke<Task>("set_task_status", { id, status }),
  dashboardStats: () => invoke<DashboardStats>("dashboard_stats"),

  // --- income.rs -----------------------------------------------------------
  listIncome: (p?: IncomeListParams) =>
    invoke<Income[]>("list_income", { search: p?.search ?? null }),
  createIncome: (payload: IncomePayload) =>
    invoke<Income>("create_income", { payload }),
  updateIncome: (id: string, payload: IncomePayload) =>
    invoke<Income>("update_income", { id, payload }),
  deleteIncome: (id: string) => invoke<void>("delete_income", { id }),
  incomeSummary: () => invoke<IncomeSummary>("income_summary"),

  // --- folders.rs ----------------------------------------------------------
  listFolders: (kind?: string) =>
    invoke<Folder[]>("list_folders", { kind: kind ?? null }),
  createFolder: (payload: FolderPayload) =>
    invoke<Folder>("create_folder", { payload }),
  updateFolder: (id: string, payload: FolderPayload) =>
    invoke<Folder>("update_folder", { id, payload }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),
  toggleFolderFavorite: (id: string) =>
    invoke<void>("toggle_folder_favorite", { id }),

  // --- activity.rs ---------------------------------------------------------
  listActivity: (limit?: number) =>
    invoke<ActivityEntry[]>("list_activity", { limit: limit ?? null }),
  clearActivity: () => invoke<void>("clear_activity"),

  // --- settings.rs ---------------------------------------------------------
  getSettings: () => invoke<Settings>("get_settings"),
  updateSettings: (payload: SettingsPayload) =>
    invoke<void>("update_settings", { payload }),

  // --- data.rs (Wave 3) ----------------------------------------------------
  exportBackup: (path: string, password: string) =>
    invoke<void>("export_backup", { path, password }),
  importBackup: (path: string, password: string) =>
    invoke<void>("import_backup", { path, password }),
  exportCsv: (kind: CsvKind, path: string) =>
    invoke<void>("export_csv", { kind, path }),
  importCsv: (kind: CsvKind, path: string) =>
    invoke<ImportResult>("import_csv", { kind, path }),
  listTemplates: () => invoke<Template[]>("list_templates"),
  saveTemplate: (payload: TemplatePayload) =>
    invoke<Template>("save_template", { payload }),
  deleteTemplate: (id: string) => invoke<void>("delete_template", { id }),
};

export type Api = typeof api;
