# QVAULT — FINAL CONTRACT ADDENDUM (Wave 2)

> Written by the parent AFTER Wave 1 landed and was read from disk.
> This REFINES SPEC.md. Where they differ, THIS FILE WINS.

## A. Backend command layer rules (agent C)

Modules live in `src-tauri/src/commands/`. `lib.rs` already imports them and
lists every command in `generate_handler!` — **you must create exactly these
`pub` command fns with these names** (they are already referenced; if a name is
missing the crate won't compile):

`security.rs`: vault_status, init_vault, unlock_vault, lock_vault, change_master_password, generate_recovery_code, reset_vault
`vault.rs`: list_vault_items, create_vault_item, update_vault_item, delete_vault_item, toggle_vault_favorite, reveal_vault_password
`notes.rs`: list_notes, create_note, update_note, delete_note, duplicate_note, toggle_note_favorite
`tasks.rs`: list_tasks, create_task, update_task, delete_task, set_task_status, dashboard_stats
`income.rs`: list_income, create_income, update_income, delete_income, income_summary
`folders.rs`: list_folders, create_folder, update_folder, delete_folder, toggle_folder_favorite
`activity.rs`: list_activity, clear_activity
`settings.rs`: get_settings, update_settings

Also create `commands/mod.rs` with `pub mod <each>;`.

### A.1 Use the ACTUAL Wave-1 API (verified on disk)

```rust
use tauri::State;
use crate::state::AppState;
use crate::error::{AppError, Result};

// DB access:
state.db.with(|conn| { /* conn: &rusqlite::Connection */ Ok(()) })?;
// or: let conn = state.db.conn();

// Crypto (re-exported from crate::crypto):
use crate::crypto::{derive_key, new_salt, encrypt, decrypt, random_key, Key};
```

### A.2 AppState key handling
- `state.vault_key: Mutex<Option<Key>>`. DEK in memory only.
- Helper you may add (in your own file, e.g. commands/security.rs) to get the DEK:
  ```rust
  fn dek(state: &State<AppState>) -> Result<Key> {
      state.vault_key.lock().unwrap().clone().ok_or_else(|| AppError::Msg("vault is locked".into()))
  }
  ```
  (`Key` derives `Clone`.)

### A.3 Crypto / settings persistence (SPEC §2)
Settings keys (table `settings(key,value)`):
- `pwd_salt` — base64 of 16-byte salt
- `pwd_verifier` — `encrypt(master_key, b"QVAULT_VERIFY")` (check master password)
- `dek_nonce` + `dek_ciphertext` — the DEK encrypted with the master key
  (equivalently store one blob `dek_wrapped = encrypt(master_key, dek.0)`)
- `recovery_hash` — SHA-free approach: `encrypt` a known constant with a key derived from the recovery code, OR store `argon2`-derived verifier. Keep it simple + documented.

Flow:
- `init_vault(masterPassword)`: if already initialized → error. new_salt → master_key=derive_key → dek=random_key() → store pwd_salt, pwd_verifier, dek_wrapped. Put `Some(dek)` in `state.vault_key`. Log activity module="security" action="init".
- `unlock_vault(masterPassword)`: load pwd_salt → master_key → decrypt dek_wrapped (fails = wrong pw) → verify pwd_verifier → put DEK in state. Log "unlock".
- `lock_vault()`: `*state.vault_key.lock().unwrap() = None;`. Log "lock".
- `vault_status()`: `{ initialized: settings has dek_wrapped, locked: state.vault_key is None }`.
- `change_master_password(current,new)`: verify current, rewrap DEK with new key, rotate pwd_salt/verifier.
- `generate_recovery_code()`: return a random code (e.g. 4×4 groups), store its verifier in `recovery_hash`.
- `reset_vault(recoveryCode)`: verify code, wipe all tables, clear vault_key (frontend re-inits).

### A.4 Read-model field mapping (CRITICAL — fixes Rust `Option` vs TS `string`)
Rust read models use `Option<String>` for decoded sensitive fields; the TS types
declare those as non-null `string`. **When building a read model, decrypt each
`*_enc` column and emit `String` (use `String::new()` when the column is NULL or
empty) so it serializes as `""`, never `null`.** Non-sensitive optional fields
that TS declares as `string | null` (e.g. `folderId`, `icon`, `dueDate`) keep
`None` → `null`.

- `tags` column stores a JSON array string (`serde_json`), default `"[]"`.
- Timestamps: RFC3339 UTC via `chrono::Utc::now().to_rfc3339()`. IDs: `uuid::Uuid::new_v4().to_string()`.
- Booleans: store as INTEGER 0/1, read as `row.get::<_, i64>(..)? != 0`.

### A.5 Activity logging
Every mutating command appends to `activity_log` via a small helper in your own
code (module, action, item_name, created_at). `dashboard_stats` returns the last
~8 entries as `recentActivity` plus `upcomingTasks` (next 5 by due_date, not done).

### A.6 dashboard_stats / income_summary shapes
Return the exact `DashboardStats` / `IncomeSummary` structs from `models.rs`
(already defined). `income_summary.byMonth` = last 6 months, `month` = `"YYYY-MM"`.

---

## B. Frontend store APIs (verified on disk) — agents D & E MUST use these

```ts
// useAuthStore: initialized, locked, loading, error, unlock(pw), init(pw), lock(), refreshStatus()
// useVaultStore: items, loading, error, load(p?), create(payload), update(id,payload), remove(id), toggleFavorite(id), revealPassword(id)
// useNotesStore: items, loading, error, load(p?), create(payload), update(id,payload), remove(id), duplicate(id), toggleFavorite(id)
// useTasksStore: items, loading, error, stats, statsLoading, load(p?), create(payload), update(id,payload), remove(id), setStatus(id,status), loadStats()
// useIncomeStore: items, loading, error, summary, summaryLoading, load(p?), create(payload), update(id,payload), remove(id), loadSummary()
// useFoldersStore: items, loading, error, load(kind?), create(payload), update(id,payload), remove(id), toggleFavorite(id)
// useActivityStore: items, loading, error, load(limit?), clear()
// useSettingsStore: settings, loading, error, load(), update(payload)
```
Types: `VaultItem`, `Note`, `Task`, `Income`, `Folder`, `ActivityEntry`,
`Settings`, `DashboardStats`, `IncomeSummary`, payloads + `VaultListParams` etc.
— all in `src/lib/types.ts`. Helpers in `src/lib/utils.ts`:
`cn, formatDate, formatDateTime, formatRelative, toDateInput, formatNumber,
formatCurrency, truncate, parseTags, initials, hostnameFromUrl,
passwordStrength, generatePassword, errorMessage`.

## C. Shared UI already built by the parent — import and use, DO NOT recreate
```ts
import Modal from "../components/Modal";            // { open, onClose, title?, children, className? }
import { useToast } from "../components/Toast";     // { push, success, error, info }
import PasswordStrength from "../components/PasswordStrength"; // { password }
import EmptyState from "../components/EmptyState";  // { icon: LucideIcon, title, hint? }
```
Layout: pages render inside `<div className="mx-auto w-full max-w-6xl px-6 py-8">`
(already in App.tsx) — start with a page header (title + action button), do NOT
add another max-width wrapper. Icons: `lucide-react`. Styling tokens:
`bg-surface bg-elevated border-line text-ink text-muted bg-accent bg-accent-soft`.

## D. Routes owned by App.tsx (default export per page)
`/` DashboardPage · `/vault` VaultPage · `/notes` NotesPage · `/tasks` TasksPage
· `/calendar` CalendarPage · `/income` IncomePage · `/folders` FoldersPage
· `/favorites` FavoritesPage · `/generator` GeneratorPage · `/activity`
ActivityPage · `/settings` SettingsPage

## E. Verify
`cd /home/kian/Projects/qvault && npx tsc --noEmit` → must be exit 0 for the
files you own. Rust agent: `cd src-tauri && cargo check` → must be exit 0.
Report RAW output. Never fabricate.
