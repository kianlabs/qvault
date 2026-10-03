# QVAULT — BUILD SPEC (single source of truth for all agents)

> Local-First Password Vault & Life OS. Tauri 2 + Rust + React 19 + TS + SQLite.
> Crypto: Argon2id (KDF) + AES-256-GCM (encryption at rest).

## 0. NON-NEGOTIABLE RULES FOR EVERY AGENT

1. **Own only your files.** Do NOT edit files outside your assignment. Shared files (`src-tauri/src/lib.rs`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`) are OWNED BY THE PARENT — never touch them; the parent wires them.
2. **Follow the exact interfaces below.** Command names, argument keys (camelCase), return shapes, TS types, store API, and routes are frozen. If something is missing, implement to the spec, do not invent a new name.
3. **No network.** Everything local. No telemetry.
4. **Verify what you write.** Run `cargo check` (rust agents) or `npx tsc --noEmit` (ts agents) for YOUR files when feasible and report the raw result. Do not claim success without it.
5. **Report honestly.** If a step fails, say so with the raw error. Never fabricate.
6. Indonesian comments are fine; identifiers in English.

---

## 1. DIRECTORY OWNERSHIP

```
src-tauri/src/
├── lib.rs                 [PARENT]  builder + generate_handler! (all commands)
├── main.rs                [PARENT]
├── error.rs               [A1]      AppError + Result alias
├── crypto/
│   ├── mod.rs             [A1]
│   ├── kdf.rs             [A1]      Argon2id derive/verify
│   └── cipher.rs          [A1]      AES-256-GCM encrypt/decrypt
├── db/
│   ├── mod.rs             [A2]      pool/open + init_schema
│   └── schema.sql         [A2]      CREATE TABLE (see §3)
├── state.rs               [A2]      AppState { db, vault_key: Mutex<Option<Key32>> }
├── models.rs              [A2]      all serde structs (see §3)
└── commands/
    ├── mod.rs             [A2]      pub mod ...
    ├── vault.rs           [A3]
    ├── notes.rs           [A3]
    ├── tasks.rs           [A3]
    ├── income.rs          [A3]
    ├── folders.rs         [A3]
    ├── activity.rs        [A3]
    ├── settings.rs        [A3]
    └── security.rs        [A3]

src/
├── main.tsx               [PARENT]
├── App.tsx                [PARENT]  Router + gate
├── index.css              [PARENT]  Tailwind v4 + theme vars
├── lib/
│   ├── api.ts             [B1]      typed wrappers over invoke()
│   ├── types.ts           [B1]      TS mirrors of §3
│   └── utils.ts           [B1]      cn(), formatters, password strength
├── store/
│   ├── useAuthStore.ts    [B2]
│   ├── useVaultStore.ts   [B2]
│   ├── useNotesStore.ts   [B2]
│   ├── useTasksStore.ts   [B2]
│   ├── useIncomeStore.ts  [B2]
│   ├── useFoldersStore.ts [B2]
│   ├── useActivityStore.ts[B2]
│   └── useSettingsStore.ts[B2]
├── components/
│   ├── Sidebar.tsx        [B4]
│   ├── Topbar.tsx         [B4]
│   ├── Modal.tsx          [B4]
│   ├── Toast.tsx          [B4]
│   ├── PasswordStrength.tsx[B4]
│   └── EmptyState.tsx     [B4]
└── features/
    ├── auth/UnlockScreen.tsx        [B4]
    ├── dashboard/DashboardPage.tsx  [B5]
    ├── vault/VaultPage.tsx          [B3]
    ├── notes/NotesPage.tsx          [B3]
    ├── tasks/TasksPage.tsx          [B3]
    ├── calendar/CalendarPage.tsx    [B3]
    ├── income/IncomePage.tsx        [B3]
    ├── folders/FoldersPage.tsx      [B3]
    ├── favorites/FavoritesPage.tsx  [B5]
    ├── generator/GeneratorPage.tsx  [B5]
    ├── activity/ActivityPage.tsx    [B5]
    └── settings/SettingsPage.tsx    [B5]
```

---

## 2. VAULT KEY & CRYPTO CONTRACT

- **Master password** → Argon2id (m=19456 KiB, t=2, p=1) with a 16-byte random salt → **32-byte key**.
- A random **DEK (data encryption key, 32 bytes)** is generated at vault creation and encrypted with the master key via AES-256-GCM. Stored in `settings` table: `dek_nonce` + `dek_ciphertext`.
- **All sensitive fields** are stored as `"{nonce_b64}:{ciphertext_b64}"` (AES-256-GCM, DEK). Sensitive fields per entity are listed in §3.
- On unlock: derive key → decrypt DEK → keep DEK in `AppState.vault_key` (in memory only). Lock = set to `None`.
- Argon2id verify for the master-password *verifier*: store `pwd_salt` + `pwd_verifier` (AES-GCM encryption of a known constant) to check the password without storing it.

### A1 — crypto API (rust, exact signatures)
```rust
// error.rs
#[derive(Debug, thiserror::Error)]
pub enum AppError { #[error("{0}")] Msg(String), #[error(transparent)] Io(#[from] std::io::Error), #[error(transparent)] Db(#[from] rusqlite::Error), #[error(transparent)] Crypto(String) }
pub type Result<T> = std::result::Result<T, AppError>;
impl serde::Serialize for AppError { /* serialize as string */ }

// crypto/kdf.rs
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32]>;
pub fn new_salt() -> [u8; 16];

// crypto/cipher.rs
pub struct Key(pub [u8; 32]);            // zeroize on drop
pub fn encrypt(key: &Key, plaintext: &[u8]) -> Result<String>;  // "nonce_b64:ct_b64"
pub fn decrypt(key: &Key, blob: &str) -> Result<Vec<u8>>;
pub fn random_key() -> Key;
```

---

## 3. DATA MODEL (frozen)

IDs = `String` (uuid v4). Timestamps = `String` (RFC3339, UTC). Booleans = `i64` 0/1 in DB, `bool` in serde.
All `*_enc` columns hold `"nonce_b64:ct_b64"`. Non-sensitive metadata stays plaintext (needed for search/sort).

```
settings(key TEXT PRIMARY KEY, value TEXT)         -- incl: pwd_salt, pwd_verifier, dek_nonce, dek_ciphertext, display_name, avatar, theme, accent, font_size, auto_lock_min, clipboard_clear_sec, recovery_hash

folders(id PK, name TEXT, color TEXT, kind TEXT,    -- kind: 'password'|'note'|'both'
        parent_id TEXT, favorite INTEGER, created_at TEXT, updated_at TEXT)

vault_items(id PK, title TEXT, username_enc TEXT, password_enc TEXT, url TEXT,
        notes_enc TEXT, tags TEXT, folder_id TEXT, favorite INTEGER,
        icon TEXT, created_at TEXT, updated_at TEXT)

notes(id PK, title TEXT, content_enc TEXT, tags TEXT, folder_id TEXT,
        favorite INTEGER, created_at TEXT, updated_at TEXT)

tasks(id PK, title TEXT, description_enc TEXT, status TEXT,   -- 'todo'|'in_progress'|'done'
        priority TEXT, due_date TEXT, tags TEXT, folder_id TEXT,
        created_at TEXT, updated_at TEXT)

income(id PK, source TEXT, amount REAL, currency TEXT, category TEXT,
        date TEXT, notes_enc TEXT, created_at TEXT, updated_at TEXT)

activity_log(id PK, module TEXT, action TEXT, item_name TEXT, created_at TEXT)
```

### serde structs (A2 `models.rs`) — camelCase for the frontend
Each entity has `#[derive(Serialize, Deserialize)]` with `#[serde(rename_all = "camelCase")]`.
Payloads:
- `VaultItemPayload { title, username, password, url, notes, tags: Vec<String>, folderId: Option<String>, favorite: bool, icon: Option<String> }`
- `NotePayload { title, content, tags: Vec<String>, folderId: Option<String>, favorite: bool }`
- `TaskPayload { title, description, status, priority, dueDate: Option<String>, tags: Vec<String>, folderId: Option<String> }`
- `IncomePayload { source, amount, currency, category, date, notes }`
- `FolderPayload { name, color, kind, parentId: Option<String>, favorite: bool }`
- Read models include `id, createdAt, updatedAt` and decoded sensitive fields.

---

## 4. TAURI COMMAND SURFACE (frozen names + arg keys)

All commands return `Result<T, AppError>`. All take `state: tauri::State<AppState>`.

### security.rs (A3)
```
vault_status() -> { initialized: bool, locked: bool }
init_vault(masterPassword: String) -> ()            // create DEK + verifier, log activity
unlock_vault(masterPassword: String) -> ()          // derive, decrypt DEK into state, log
lock_vault() -> ()                                  // clear key, log
change_master_password(currentPassword, newPassword) -> ()
generate_recovery_code() -> String                  // store recovery_hash
reset_vault(recoveryCode: String) -> ()             // wipe + re-init prompt
```

### vault.rs (A3)
```
list_vault_items(search: Option<String>, folderId: Option<String>, favoriteOnly: Option<bool>) -> Vec<VaultItem>
create_vault_item(payload: VaultItemPayload) -> VaultItem
update_vault_item(id: String, payload: VaultItemPayload) -> VaultItem
delete_vault_item(id: String) -> ()
toggle_vault_favorite(id: String) -> ()
reveal_vault_password(id: String) -> String
```

### notes.rs (A3)
```
list_notes(search, folderId, favoriteOnly) -> Vec<Note>
create_note(payload: NotePayload) -> Note
update_note(id, payload) -> Note
delete_note(id) -> ()
duplicate_note(id) -> Note
toggle_note_favorite(id) -> ()
```

### tasks.rs (A3)
```
list_tasks(status: Option<String>, folderId: Option<String>) -> Vec<Task>
create_task(payload) -> Task
update_task(id, payload) -> Task
delete_task(id) -> ()
set_task_status(id, status) -> Task
dashboard_stats() -> { totalItems, totalNotes, tasksOverdue, tasksToday, tasksDone, incomeThisMonth, recentActivity: Vec<ActivityEntry>, upcomingTasks: Vec<Task> }
```

### income.rs (A3)
```
list_income(search: Option<String>) -> Vec<Income>
create_income(payload) -> Income
update_income(id, payload) -> Income
delete_income(id) -> ()
income_summary() -> { thisMonth, allTime, byMonth: Vec<{ month: String, total: f64 }> }
```

### folders.rs (A3)
```
list_folders(kind: Option<String>) -> Vec<Folder>
create_folder(payload) -> Folder
update_folder(id, payload) -> Folder
delete_folder(id) -> ()
toggle_folder_favorite(id) -> ()
```

### activity.rs (A3)
```
list_activity(limit: Option<i64>) -> Vec<ActivityEntry>
clear_activity() -> ()
```

### settings.rs (A3)
```
get_settings() -> { displayName, avatar, theme, accent, fontSize, autoLockMin, clipboardClearSec }
update_settings(payload: SettingsPayload) -> ()
```

---

## 5. FRONTEND CONTRACT

### B1 `lib/types.ts` — mirror §3 read models (camelCase). `lib/api.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
export const api = {
  vaultStatus: () => invoke<VaultStatus>("vault_status"),
  initVault: (masterPassword: string) => invoke<void>("init_vault", { masterPassword }),
  unlockVault: (masterPassword: string) => invoke<void>("unlock_vault", { masterPassword }),
  lockVault: () => invoke<void>("lock_vault"),
  listVaultItems: (p?: { search?: string; folderId?: string; favoriteOnly?: boolean }) => invoke<VaultItem[]>("list_vault_items", p ?? {}),
  // ...one wrapper per command, args camelCase matching §4
};
```

### B2 stores (zustand). Every store exposes `{ items, loading, error, load(), create(), update(), remove(), ... }`.
`useAuthStore`: `{ initialized, locked, unlock(pw), init(pw), lock(), refreshStatus() }`.

### B3/B5 pages: functional components, default export, use stores + `lib/api`. Style with Tailwind v4 utility classes + these CSS vars (defined by parent in index.css):
`bg-surface`, `bg-elevated`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-accent`. Dark mode via `.dark` on `<html>`.

### B4 components: `Sidebar` (nav links to routes), `Topbar` (search + lock button), `Modal` (`{ open, onClose, title, children }`), `Toast` (`useToast()`), `PasswordStrength` (`{ password }` → meter), `EmptyState` (`{ icon, title, hint }`). `UnlockScreen` = master-password gate (create if not initialized, unlock otherwise).

### Routes (react-router-dom, App.tsx wires them):
`/unlock` (UnlockScreen) · `/` Dashboard · `/vault` · `/notes` · `/tasks` · `/calendar` · `/income` · `/folders` · `/favorites` · `/generator` · `/activity` · `/settings`

---

## 6. DESIGN TOKENS (parent defines in index.css; agents just use them)

- Dark-first, minimal, "vault" feel. Accent default: violet `#7c5cff`.
- Radius: `rounded-xl` / `rounded-2xl`. Borders: subtle 1px `border-line`.
- Sidebar 240px fixed; content max-w-6xl centered; generous spacing.
- Icons: `lucide-react` only.
- No external fonts (system stack) — offline-safe.

---

## 7. ACCEPTANCE (parent runs at the end)
1. `cargo check` (src-tauri) → exit 0.
2. `npx tsc --noEmit` (src) → exit 0.
3. `bun run build` (vite) → dist/ produced.
4. `cargo tauri build --debug` OR `cargo build` → binary produced (headless may lack a display; build success is the bar).
