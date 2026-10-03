# QVAULT — WAVE 3 CONTRACT (fitur yang belum ada vs KeepR)

> Ditulis parent SETELAH membaca semua file aktual di disk (bukan asumsi).
> Memperluas FINAL-CONTRACT.md. Jika berbeda, FILE INI MENANG untuk Wave 3.

Tujuan: menambahkan 11 fitur yang belum ada di QVAULT dibanding KeepR.

## Pembagian file (TIDAK BOLEH tumpang-tindih antar agent)

| Agent | File yang dimiliki |
|---|---|
| **A (backend Rust)** | `src-tauri/src/commands/data.rs` (baru), `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/db/schema.sql`, `src-tauri/src/models.rs`, `src-tauri/Cargo.toml` |
| **B (Settings/Data UI)** | `src/features/settings/SettingsPage.tsx`, `src/store/useDataStore.ts` (baru), `src/components/AboutCard.tsx` (baru) |
| **C (Dashboard/Calendar)** | `src/features/dashboard/DashboardPage.tsx`, `src/features/calendar/CalendarPage.tsx`, `src/components/WorldClock.tsx` (baru) |
| **D (Notes/Vault/Folders)** | `src/features/notes/NotesPage.tsx`, `src/features/vault/VaultPage.tsx`, `src/features/folders/FoldersPage.tsx`, `src/lib/markdown.tsx` (baru), `src/lib/favicon.ts` (baru) |

Parent SUDAH menambahkan tipe di `src/lib/types.ts` dan wrapper di `src/lib/api.ts`.
**JANGAN mengedit `types.ts` atau `api.ts`** — pakai yang sudah ada.

---

## A. BACKEND — `src-tauri/src/commands/data.rs` (Agent A)

Tambahkan `pub mod data;` di `commands/mod.rs` (setelah `pub mod activity;` agar urut abjad),
dan daftarkan 7 command baru di `lib.rs::generate_handler!` (blok baru `// data`).

Gunakan helper yang SUDAH ADA di `commands/mod.rs` (jangan buat ulang):
`dek, now, new_id, b64_encode, b64_decode, get_setting, set_setting, log_activity, enc_opt, dec_str, tags_to_json, tags_from_json`.

Impor: `use tauri::State; use crate::state::AppState; use crate::error::{AppError, Result};`
Kripto: `use crate::crypto::{derive_key, new_salt, encrypt, decrypt};`
DEK: `let key = super::dek(&state)?;`

### A.1 Tabel baru — tambahkan di `db/schema.sql` (paling bawah):
```sql
CREATE TABLE IF NOT EXISTS templates (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL, -- 'note' | 'task'
    body       TEXT NOT NULL, -- JSON payload
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_kind ON templates(kind);
```

### A.2 Struct baru di `models.rs` (pakai pola serde yang ada):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    pub kind: String,   // 'note' | 'task'
    pub body: String,   // JSON string
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplatePayload {
    pub name: String,
    pub kind: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: i64,
    pub skipped: i64,
}
```

### A.3 Tujuh command (nama & signature PERSIS):

```rust
// Backup terenkripsi: seluruh DB → JSON → AES-256-GCM dengan key dari password.
// Format file: "QVLTBK1:<salt_b64>:<nonce_b64>:<ct_b64>"  (satu baris teks)
#[tauri::command]
pub fn export_backup(state: State<'_, AppState>, path: String, password: String) -> Result<()>;

// Restore: baca file, verifikasi password (AEAD), wipe tabel data, insert ulang.
#[tauri::command]
pub fn import_backup(state: State<'_, AppState>, path: String, password: String) -> Result<()>;

// kind = "vault" | "notes" | "tasks" | "income"
#[tauri::command]
pub fn export_csv(state: State<'_, AppState>, kind: String, path: String) -> Result<()>;

#[tauri::command]
pub fn import_csv(state: State<'_, AppState>, kind: String, path: String) -> Result<ImportResult>;

#[tauri::command]
pub fn list_templates(state: State<'_, AppState>) -> Result<Vec<Template>>;

#[tauri::command]
pub fn save_template(state: State<'_, AppState>, payload: TemplatePayload) -> Result<Template>;

#[tauri::command]
pub fn delete_template(state: State<'_, AppState>, id: String) -> Result<()>;
```

### A.4 Detail implementasi WAJIB

**export_backup:**
- Baca semua baris dari `vault_items, notes, tasks, income, folders, activity_log, templates`
  sebagai JSON (nilai kolom apa adanya, TERMASUK kolom `*_enc` yang sudah terenkripsi DEK).
- Bangun `serde_json::json!({ "version": 1, "exportedAt": now(), "tables": { "vault_items": [...], ... } })`.
- `salt = new_salt()` (16B); `key = Key(derive_key(&password, &salt)?)`; `blob = encrypt(&key, json.as_bytes())?`.
- `blob` sudah berformat `"nonce:ct"`. Tulis file: `format!("QVLTBK1:{}:{}", b64_encode(&salt), blob)`.
- `std::fs::write(path, contents)?`. Log activity module="data", action="backup".

**import_backup:**
- Baca file, strip prefix `QVLTBK1:`, split sisa dengan `splitn(2, ':')` → salt_b64, blob.
  Error `AppError::Msg("file backup tidak valid".into())` bila format salah.
- `key = Key(derive_key(&password, &b64_decode(salt_b64)?)?)`; `bytes = decrypt(&key, blob)`
  → bila gagal: `AppError::Msg("password backup salah".into())`.
- Parse JSON, lalu **dalam satu transaksi**: `DELETE FROM` tiap tabel, lalu INSERT semua baris.
  Gunakan `conn.execute` per baris; ambil nilai via `serde_json::Value` (`.get("col")`).
- Log activity module="data", action="restore".

**export_csv / import_csv:**
- Tambahkan `csv = "1"` ke `Cargo.toml` [dependencies].
- Kolom per kind (urutan header PERSIS):
  - vault: `id,title,username,password,url,notes,tags,folder_id,favorite,icon,created_at,updated_at`
    (username/password/notes DIKELUARKAN dalam bentuk PLAINTEXT via `dec_str`; tags = JSON array string)
  - notes: `id,title,content,tags,folder_id,favorite,created_at,updated_at` (content plaintext)
  - tasks: `id,title,description,status,priority,due_date,tags,folder_id,created_at,updated_at` (description plaintext)
  - income: `id,source,amount,currency,category,date,notes,created_at,updated_at` (notes plaintext)
- `import_csv`: baca header, untuk tiap baris INSERT ke tabel yang sesuai; id kosong → `new_id()`;
  `created_at`/`updated_at` kosong → `now()`. Kembalikan `ImportResult { imported, skipped }`
  (skipped = baris tanpa field wajib, mis. title/source kosong). Enkripsi ulang field sensitif dengan DEK.
- Log activity module="data", action="export"/"import".

**templates:** CRUD standar (mirip folders.rs). `list_templates` urut `updated_at DESC`.
`save_template`: bila `id` tidak ada di payload → INSERT baru; (tidak perlu update, tapi kalau mau
sederhana: selalu INSERT dengan id baru). Log activity module="template".

### A.5 Verifikasi Agent A
`cd /home/kian/Projects/qvault/src-tauri && cargo check 2>&1 | tail -20` → WAJIB `Finished` / exit 0.
Laporkan output MENTAH. Jangan mengarang.

---

## B. FRONTEND SETTINGS/DATA — Agent B

`src/store/useDataStore.ts` (baru): pakai pola zustand yang sama dengan store lain.
```ts
interface DataState {
  templates: Template[];
  loading: boolean;
  error: string | null;
  loadTemplates: () => Promise<void>;
  saveTemplate: (p: TemplatePayload) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}
```
API yang tersedia di `src/lib/api.ts` (JANGAN edit, cukup pakai):
`api.exportBackup(path, password)`, `api.importBackup(path, password)`,
`api.exportCsv(kind, path)`, `api.importCsv(kind, path)`, `api.listTemplates()`,
`api.saveTemplate(payload)`, `api.deleteTemplate(id)`.

`SettingsPage.tsx`: TAMBAHKAN dua `<Section>` baru SETELAH section "Security" yang sudah ada
(pertahankan Profile/Appearance/Security apa adanya):

1. **Section "Data"** (icon `Database` dari lucide-react):
   - **Backup vault** → tombol; pakai `save()` dari `@tauri-apps/plugin-dialog` untuk pilih path
     (default `qvault-backup-YYYY-MM-DD.qvlt`), minta password lewat input di halaman, lalu `api.exportBackup`.
   - **Restore vault** → `open()` dari plugin-dialog → pilih file → password → `api.importBackup`.
     Beri peringatan merah "ini akan MENGGANTI semua data".
   - **Export CSV** → dropdown kind (Vault/Notes/Tasks/Income) + tombol → `save()` → `api.exportCsv`.
   - **Import CSV** → dropdown kind + tombol → `open()` → `api.importCsv` → tampilkan toast
     `"Imported X, skipped Y"`.
   - **Templates** → daftar template (dari useDataStore), form tambah (nama + kind + body JSON/text),
     tombol hapus. Tombol "Save template".

2. **Section "About"** (icon `Info`):
   - Nama app "QVAULT", versi "0.1.0", tagline "Local-First Password Vault & Life OS".
   - Baris identitas: **"Q = Ky"** dan keterangan kecil "Q melambangkan Kyan".
   - Catatan privasi: "100% offline · tanpa cloud · tanpa telemetri".
   - Baris kecil: "Argon2id · AES-256-GCM · SQLite".

Gunakan `Modal`, `useToast`, token warna (`bg-surface bg-elevated border-line text-ink text-muted
bg-accent bg-accent-soft`). Bahasa UI: Inggris (konsisten dengan halaman lain).

Verifikasi: `cd /home/kian/Projects/qvault && npx tsc --noEmit` → exit 0. Laporkan output mentah.

---

## C. FRONTEND DASHBOARD/CALENDAR — Agent C

**`src/components/WorldClock.tsx`** (baru): komponen React menampilkan 3–4 jam dunia yang berjalan
(detik bergerak). Zona default: `Local`, `UTC`, `Asia/Tokyo`, `America/New_York`.
Pakai `Intl.DateTimeFormat("en-GB", { timeZone, hour, minute, second })`, update via
`setInterval` 1000ms di `useEffect` (bersihkan di return). Tampilkan nama kota + jam.

**`DashboardPage.tsx`**: TAMBAHKAN (pertahankan kartu & layout yang ada):
- `<WorldClock />` sebagai kartu (grid 2 kolom dengan kartu lain bila muat).
- Kartu **"Vault protection"**: status dari `useAuthStore` (`locked`, `initialized`) —
  tampilkan badge "Locked"/"Unlocked", jumlah item vault, dan checklist kecil
  (Argon2id ✓, AES-256-GCM ✓, Offline ✓).
- Kartu **"Recent credentials"**: 5 item vault terbaru (pakai `useVaultStore` → `items`,
  `load()`); tampilkan inisial/favicon + title + username. Klik → navigasi ke `/vault`
  (`useNavigate`). Kosong → `EmptyState`.

**`CalendarPage.tsx`**: TAMBAHKAN:
- Toggle **view: Month / Week / Year** (state lokal, tombol segmented di header).
  - Month = grid 6×7 yang SUDAH ADA (pertahankan).
  - Week = 7 kolom (Senin–Minggu) untuk minggu yang sedang dipilih, task di kolom tanggalnya.
  - Year = 12 mini-kartu bulan (jumlah task per bulan), klik bulan → pindah ke view Month.
  - Navigasi prev/next/today menyesuaikan mode (geser 1 bulan / 1 minggu / 1 tahun).
- **Klik tanggal → buka Modal "New task"** dengan `dueDate` terisi tanggal itu; submit →
  `useTasksStore.create({...})` → toast → refresh. Ini "add task from calendar".

Verifikasi: `npx tsc --noEmit` → exit 0.

---

## D. FRONTEND NOTES/VAULT/FOLDERS — Agent D

**`src/lib/markdown.tsx`** (baru): export `renderMarkdown(src: string): React.ReactNode`.
Parser minimal AMAN (TANPA `dangerouslySetInnerHTML`): dukung
`# ## ###` heading, `**bold**`, `*italic*`, `` `code` ``, `-`/`*` bullet list, `1.` ordered list,
`[text](url)` link (buka via `@tauri-apps/plugin-opener` `openUrl`), baris kosong = paragraf.
Kembalikan elemen React (`<h1>`, `<p>`, `<ul>`, `<code>`, …) — bukan string HTML.

**`src/lib/favicon.ts`** (baru): export `faviconUrl(url: string | null | undefined): string | null`
dan `avatarInitials` bila perlu. `faviconUrl` mengembalikan
`https://www.google.com/s2/favicons?domain=<host>&sz=64` (host dari `hostnameFromUrl` di utils),
atau `null` bila url kosong.

**`NotesPage.tsx`**: TAMBAHKAN toggle **Write / Preview** di editor. Mode Preview memakai
`renderMarkdown(content)` di area baca yang rapi (`prose`-style manual: spacing heading/paragraf).
Pertahankan CRUD/duplicate/favorite yang sudah ada.

**`VaultPage.tsx`**: TAMBAHKAN:
- Toggle **Grid / List** (icon `LayoutGrid` / `List`, state lokal, persist ke `localStorage`
  key `qvault.vaultView`). Grid = kartu (favicon/inisial + title + username + tombol copy/reveal/fav).
  List = baris yang sudah ada. Pertahankan fitur copy/reveal/favorite/search/folder filter.
- Render favicon: `<img src={item.icon || faviconUrl(item.url)}>` dengan `onError` →
  fallback ke `initials(item.title)` (pertahankan gaya avatar sekarang).

**`FoldersPage.tsx`**: TAMBAHKAN toggle **Grid / List** serupa (icon `LayoutGrid`/`List`).
Grid = kartu (sudah ada). List = baris ringkas (nama + warna + jumlah + aksi). Pertahankan
create/rename/delete/favorite/warna.

Verifikasi: `npx tsc --noEmit` → exit 0.

---

## E. ATURAN UMUM SEMUA AGENT
- Bahasa komentar: Indonesia santai (konsisten dengan file lama). Bahasa UI: Inggris.
- JANGAN menyentuh `src/lib/types.ts`, `src/lib/api.ts`, `src/App.tsx`, `src/components/{Modal,Toast,Sidebar,Topbar,EmptyState,PasswordStrength}.tsx`.
- JANGAN `git commit` / `git push`.
- Laporkan output MENTAH tsc/cargo. Jangan mengarang hasil. Bila gagal, katakan gagal.
