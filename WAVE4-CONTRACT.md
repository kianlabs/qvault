# QVAULT — WAVE 4 CONTRACT (13 item: bug keamanan, identitas, fitur baru)

> Ditulis parent SETELAH membaca file aktual di disk. Memperluas FINAL-CONTRACT & WAVE3-CONTRACT.
> Jika berbeda, FILE INI MENANG untuk Wave 4.

## 0. Kepemilikan file (TIDAK BOLEH tumpang-tindih)

| Agent | File yang dimiliki |
|---|---|
| **A** (frontend security) | `src/components/ErrorBoundary.tsx` (baru), `src/lib/clipboard.ts` (baru), `src/components/TotpField.tsx` (baru), `src/features/vault/VaultPage.tsx`, `src/features/generator/GeneratorPage.tsx`, `src/features/settings/SettingsPage.tsx` |
| **B** (repo/identitas) | `README.md`, `LICENSE` (baru), `.github/workflows/ci.yml` (baru), `src-tauri/icons/*` (regenerate), `src-tauri/icons/source.svg` (baru) |
| **C** (password health) | `src/features/health/HealthPage.tsx` (baru) |
| **D** (command palette) | `src/components/CommandPalette.tsx` (baru), `src/lib/search.ts` (baru) |
| **E** (backend Rust) | `src-tauri/src/commands/totp.rs` (baru), `src-tauri/src/commands/data.rs`, `src-tauri/src/commands/vault.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/models.rs`, `src-tauri/src/db/schema.sql`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml` |

**PARENT memegang** (JANGAN disentuh agent): `src/lib/types.ts`, `src/lib/api.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`.
Parent sudah menambahkan tipe + wrapper API yang dibutuhkan Agent A/C/E. **Pakai yang sudah ada.**

---

## A. FRONTEND SECURITY (Agent A)

### A.1 `src/lib/clipboard.ts` (baru)
```ts
/** Copy ke clipboard lalu OTOMATIS hapus setelah `clearAfterSec` detik. */
export async function secureCopy(text: string, clearAfterSec: number): Promise<void>
```
- Tulis via `navigator.clipboard.writeText(text)`.
- Jadwalkan `setTimeout` (ms = clearAfterSec*1000, min 5s) yang menulis string kosong `""` ke clipboard
  **hanya bila isi clipboard masih sama** (baca `navigator.clipboard.readText()` di dalam try/catch —
  bila gagal karena izin, tetap kosongkan; jangan melempar).
- Simpan id timer di modul-level Map agar copy berikutnya membatalkan timer lama (jangan hapus clipboard baru).
- Export juga `cancelClipboardClear()`.

### A.2 `src/components/ErrorBoundary.tsx` (baru)
Class component React, `componentDidCatch` + `getDerivedStateFromError`. Saat error: tampilkan kartu
centered (token `bg-surface text-ink border-line`) berisi ikon `AlertTriangle` (lucide), judul
"Something went wrong", pesan error, tombol "Reload" (`window.location.reload()`) dan
"Copy details" (pakai `secureCopy`, 30s). Props: `children`, opsional `fallback?: ReactNode`.
Export default.

### A.3 `src/components/TotpField.tsx` (baru)
Komponen untuk item vault yang punya 2FA (TOTP).
```ts
interface Props { itemId: string; hasTotp: boolean; onChanged: () => void; }
```
- Bila `hasTotp`: panggil `api.getTotpCode(itemId)` → tampilkan kode 6 digit besar + countdown
  `secondsRemaining` (progress bar / angka). Auto-refresh: `setInterval` 1000ms menghitung mundur;
  saat mencapai 0 → panggil `api.getTotpCode` lagi. Tombol copy memakai `secureCopy(code, 20)`.
  Tombol "Remove" → `api.clearTotpSecret(itemId)` → `onChanged()`.
- Bila tidak ada: input teks (placeholder "Paste 2FA secret (base32)") + tombol "Add 2FA" →
  `api.setTotpSecret(itemId, secret)` → `onChanged()`. Tampilkan error dari API bila secret invalid.
- Bersihkan interval di `useEffect` return.

### A.4 `src/features/vault/VaultPage.tsx`
- Ganti `navigator.clipboard.writeText(...)` di `onCopyPassword` dan `onCopyUsername` menjadi
  `secureCopy(pw, settings.clipboardClearSec)` / `secureCopy(item.username, ...)`.
  Ambil `clipboardClearSec` dari `useSettingsStore` (fallback 30).
- Tampilkan toast yang menyebut auto-clear: `"Password copied · clears in 30s"`.
- Di modal detail/edit item, render `<TotpField itemId={item.id} hasTotp={item.hasTotp} onChanged={...}/>`
  (untuk item baru yang belum tersimpan, sembunyikan — hanya tampil saat `item.id` ada).
- `VaultItem` sekarang punya field `hasTotp: boolean`; `VaultItemPayload` punya `totp?: string | null`.
  Saat submit form, sertakan `totp` bila diisi.

### A.5 `src/features/generator/GeneratorPage.tsx`
Ganti `navigator.clipboard.writeText(password)` → `secureCopy(password, clipboardClearSec)`
dari `useSettingsStore` (fallback 30). Toast menyebut auto-clear.

### A.6 `src/features/settings/SettingsPage.tsx`
Tambahkan di section **Security** yang sudah ada:
- **Auto-lock** (sudah ada UI-nya) — biarkan; logika timer dipasang parent di App.tsx.
- **Clipboard clear** (sudah ada) — biarkan.
Tambahkan di section **Data** yang sudah ada:
- **Auto-backup**: toggle "Enable automatic backups" + info "keeps last 5". Tombol
  **"Back up now"** → `api.autoBackupNow()` → toast menampilkan path hasil. Tombol
  **"Show backups"** → `api.listAutoBackups()` → daftar path (modal/list kecil).
- **Import from browser**: dropdown (Chrome / Bitwarden) + tombol → `open()` dari
  `@tauri-apps/plugin-dialog` → `api.importBrowserCsv(kind, path)` → toast
  `"Imported X, skipped Y"`.

### A.7 Verifikasi Agent A
`cd /home/kian/Projects/qvault && npx tsc --noEmit 2>&1 | tail -25` → exit 0. Laporkan output MENTAH.

---

## B. REPO & IDENTITAS (Agent B)

### B.1 `src-tauri/icons/source.svg` (baru)
Tulis PERSIS SVG ini (ikon Q — huruf Q dengan lubang kunci):
```svg
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b6cff"/>
      <stop offset="1" stop-color="#4b2fd6"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#g)"/>
  <circle cx="512" cy="470" r="232" fill="none" stroke="#ffffff" stroke-width="92"/>
  <line x1="648" y1="606" x2="800" y2="758" stroke="#ffffff" stroke-width="92" stroke-linecap="round"/>
  <circle cx="512" cy="452" r="60" fill="#ffffff"/>
  <rect x="486" y="452" width="52" height="132" rx="26" fill="#ffffff"/>
</svg>
```
Lalu regenerate semua ikon:
```bash
cd /home/kian/Projects/qvault && npx tauri icon src-tauri/icons/source.svg
```
Ini menimpa `src-tauri/icons/*` (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico, + Android/iOS).
Verifikasi dengan `ls -la src-tauri/icons/` dan `file src-tauri/icons/32x32.png`. Laporkan output mentah.

### B.2 `LICENSE` (baru)
MIT License, tahun 2025, pemilik: **Ridzkyan Buti Pratama (Kyan)**.

### B.3 `.github/workflows/ci.yml` (baru)
Workflow GitHub Actions: trigger `push` + `pull_request` ke `main`.
Job 1 `frontend`: ubuntu-latest, `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`,
`bunx tsc --noEmit`, `bun run build`.
Job 2 `backend`: ubuntu-latest, install system deps Tauri
(`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf`),
`dtolnay/rust-toolchain@stable`, cache `Swatinem/rust-cache@v2` dengan `workspaces: src-tauri`,
lalu `cargo check --manifest-path src-tauri/Cargo.toml` dan `cargo test --manifest-path src-tauri/Cargo.toml`.
Tulis YAML valid (indentasi 2 spasi). Jangan pakai secret.

### B.4 `README.md` (perluas — pertahankan judul & bagian yang ada)
Tambahkan: badge (build status), daftar fitur lengkap (11 modul + Wave 3 & 4: backup terenkripsi,
CSV, templates, world clock, markdown preview, password health, command palette, 2FA TOTP, auto-backup),
tabel teknologi, **cara build/run** (`bun install`, `bun run tauri dev`, `bun run tauri build`),
cara menjalankan test (`cargo test`), catatan keamanan (Argon2id params, AES-256-GCM, verifier+wrapped DEK),
struktur folder, dan bagian "Q = Ky". Bahasa Inggris. Jangan mengarang screenshot — boleh placeholder teks.

### B.5 Verifikasi Agent B
`cd /home/kian/Projects/qvault && ls -la src-tauri/icons/ && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"` → laporkan output mentah.

---

## C. PASSWORD HEALTH (Agent C) — `src/features/health/HealthPage.tsx` (baru)

Halaman analisis kekuatan password. Sumber data: `useVaultStore` (`items` sudah didekripsi:
`item.password`, `item.username`, `item.title`, `item.updatedAt`, `item.url`). Tidak perlu backend.

Hitung & tampilkan:
1. **Skor kesehatan total** (0–100): persentase item "sehat" dari total.
2. **Weak** — pakai `passwordStrength(item.password).score <= 1` dari `src/lib/utils.ts`.
3. **Reused** — password yang muncul di >1 item (bandingkan nilai password yang sama, abaikan string kosong).
4. **Stale** — `updatedAt` lebih tua dari 180 hari (pakai `parseDate`/`formatDate` dari utils).
5. **Missing password** — `item.password === ""`.
6. **No 2FA** — `!item.hasTotp`.

Tampilkan sebagai: kartu ringkasan (4 stat: Total, Weak, Reused, Stale) + daftar masalah
(accordion/tab per kategori) dengan tombol yang menavigasi ke `/vault` (`useNavigate`) untuk memperbaiki.
Pakai `EmptyState` bila vault kosong. Token warna standar + ikon lucide (`ShieldAlert`, `KeyRound`,
`RefreshCw`, `Copy`, `Lock`). `load()` dari `useVaultStore` di `useEffect`.
UI bahasa Inggris, komentar bahasa Indonesia. Jangan tambah max-width wrapper.

**Verifikasi:** `npx tsc --noEmit` → exit 0. Laporkan output mentah.

---

## D. COMMAND PALETTE (Agent D)

### D.1 `src/lib/search.ts` (baru)
```ts
export interface SearchHit {
  id: string; title: string; subtitle: string;
  module: "vault" | "note" | "task" | "income" | "folder" | "page";
  to: string; // route tujuan, mis. "/vault"
}
/** Bangun indeks dari store; pencarian substring case-insensitive atas title/subtitle. */
export function buildIndex(): SearchHit[]
export function searchIndex(index: SearchHit[], q: string, limit?: number): SearchHit[]
```
`buildIndex` membaca state store saat ini (`useVaultStore.getState().items`, `useNotesStore`, `useTasksStore`,
`useIncomeStore`, `useFoldersStore`) — pakai `.getState()` zustand (bukan hook) agar aman dipanggil dari event.
Tambahkan juga entri statis untuk tiap halaman (Dashboard/Vault/Notes/Tasks/Calendar/Income/Folders/
Favorites/Generator/Health/Activity/Settings). `searchIndex` memberi skor: exact prefix > contains,
urut menurun, batasi `limit` (default 8).

### D.2 `src/components/CommandPalette.tsx` (baru)
Modal command palette (Ctrl+K / Cmd+K):
- `useEffect` global `keydown`: buka saat `(e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'`
  (preventDefault), tutup saat `Escape`.
- Input pencarian autofocus; hasil dari `searchIndex(buildIndex(), q)`; navigasi keyboard
  `ArrowUp`/`ArrowDown`/`Enter`; klik juga jalan.
- Tampilkan ikon per modul + judul + subtitle. Pilih → `navigate(hit.to)` + tutup.
- Saat query kosong, tampilkan daftar halaman (shortcut). Footer kecil: "↑↓ navigate · ↵ open · esc close".
- Overlay gelap + panel `bg-elevated border-line rounded-2xl`; pakai portal (`createPortal` ke `document.body`)
  atau fixed overlay dengan z-50. Export default.

**Verifikasi:** `npx tsc --noEmit` → exit 0. Laporkan output mentah.

---

## E. BACKEND RUST (Agent E)

### E.1 Schema — `db/schema.sql`
Tambahkan kolom TOTP ke `vault_items`. Karena `CREATE TABLE IF NOT EXISTS` tidak mengubah tabel lama,
WAJIB tambahkan migrasi idempoten di akhir file:
```sql
-- Wave 4: kolom TOTP (migrasi idempoten untuk DB lama)
ALTER TABLE vault_items ADD COLUMN totp_enc TEXT;
```
Catatan: SQLite tidak punya `ADD COLUMN IF NOT EXISTS` → bungkus aman: jalankan via helper yang
mengabaikan error "duplicate column name". Buat fungsi di `db/mod.rs`? **Tidak** — `db/mod.rs` bukan milikmu.
Sebagai gantinya: di `init_schema` sudah `execute_batch(include_str!("schema.sql"))`. Untuk aman, ubah
pendekatan: tambahkan kolom di `CREATE TABLE vault_items` (untuk DB baru) DAN tambahkan fungsi
`ensure_column(conn, table, col, decl)` di `commands/mod.rs` yang mengecek `PRAGMA table_info`
lalu `ALTER TABLE` bila belum ada; panggil dari `list_vault_items`/`create_vault_item` (idempoten, murah).
Ya — `commands/mod.rs` milikmu. Lakukan itu.

### E.2 `models.rs`
- `VaultItem`: tambah `pub has_totp: bool` (serde camelCase → `hasTotp`).
- `VaultItemPayload`: tambah `#[serde(default)] pub totp: Option<String>`.
- Tambah:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpCode { pub code: String, pub seconds_remaining: i64, pub period: i64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpStatus { pub has_secret: bool }
```

### E.3 `commands/vault.rs`
- `COLS` tambah `totp_enc`; `map_row` set `has_totp: row.get::<_, Option<String>>(12)?.map(|s| !s.is_empty()).unwrap_or(false)`.
- `create_vault_item` / `update_vault_item`: simpan `enc_opt(&key, &payload.totp)` ke kolom `totp_enc`
  (bila payload.totp None → tetap None, JANGAN hapus yang lama saat update kosong? Sederhana: tulis apa adanya).
- Panggil `super::ensure_column(conn, "vault_items", "totp_enc", "TEXT")` di awal `list_vault_items` &
  `create_vault_item` sebelum query.

### E.4 `commands/totp.rs` (baru) — RFC 6238 (TOTP, SHA-1, 6 digit, 30s)
Command (nama PERSIS):
```rust
#[tauri::command] pub fn set_totp_secret(state: State<'_, AppState>, id: String, secret: String) -> Result<()>;
#[tauri::command] pub fn clear_totp_secret(state: State<'_, AppState>, id: String) -> Result<()>;
#[tauri::command] pub fn totp_status(state: State<'_, AppState>, id: String) -> Result<TotpStatus>;
#[tauri::command] pub fn get_totp_code(state: State<'_, AppState>, id: String) -> Result<TotpCode>;
```
- `set_totp_secret`: validasi secret (base32 decode sukses, non-kosong) → `enc_opt(&dek,&Some(secret))` → UPDATE `vault_items.totp_enc`. Error `AppError::Msg("secret 2FA tidak valid".into())` bila gagal. Log activity module="vault", action="totp_set".
- `clear_totp_secret`: set `totp_enc = NULL`. Log "totp_clear".
- `totp_status`: `has_secret` dari kolom (dekripsi tidak perlu).
- `get_totp_code`: ambil `totp_enc` → `dec_str` → base32 decode → hitung kode:
  ```
  counter = (utc_now_unix / 30) as u64
  msg = counter.to_be_bytes()               // 8 byte
  mac = Hmac<Sha1>::new_from_slice(&secret_bytes)?.update(&msg); hash = mac.finalize().into_bytes() // 20 byte
  offset = (hash[19] & 0x0f) as usize
  bin = ((hash[offset] & 0x7f) as u32) << 24 | (hash[offset+1] as u32) << 16 | (hash[offset+2] as u32) << 8 | hash[offset+3] as u32
  code = format!("{:06}", bin % 1_000_000)
  seconds_remaining = 30 - (utc_now_unix % 30)
  ```
  Bila tidak ada secret → `AppError::Msg("2FA belum diaktifkan".into())`.
- Base32 decode: pakai crate `data-encoding` → `data_encoding::BASE32_NOPAD.decode(secret.trim().to_uppercase().replace(' ','').trim_end_matches('=').as_bytes())`.
- Tambah ke `Cargo.toml`: `hmac = "0.12"`, `sha1 = "0.10"`, `data-encoding = "2"`.

### E.5 `commands/data.rs` — auto-backup + import browser
Command baru:
```rust
/// Salin DB ke <data_dir>/qvault/backups/qvault-YYYYMMDD-HHMMSS.db via VACUUM INTO. Simpan 5 terbaru.
#[tauri::command] pub fn auto_backup_now(state: State<'_, AppState>) -> Result<String>;
/// Daftar path backup otomatis (terbaru dulu).
#[tauri::command] pub fn list_auto_backups(state: State<'_, AppState>) -> Result<Vec<String>>;
/// Impor CSV dari Chrome / Bitwarden (kind = "chrome" | "bitwarden") ke vault_items.
#[tauri::command] pub fn import_browser_csv(state: State<'_, AppState>, kind: String, path: String) -> Result<ImportResult>;
```
- `auto_backup_now`: dir = `$XDG_DATA_HOME|$HOME/.local/share` + `/qvault/backups`; `create_dir_all`.
  Nama file pakai `chrono::Utc::now().format("%Y%m%d-%H%M%S")`. Jalankan
  `conn.execute("VACUUM INTO ?1", params![dest])` (pastikan file belum ada). Setelah itu prune:
  urut nama DESC, hapus sisanya setelah 5. Return path (String). Log activity module="data", action="auto_backup".
- `list_auto_backups`: baca dir, filter `.db`, urut DESC, return path lengkap.
- `import_browser_csv`: header Chrome = `name,url,username,password,note`;
  Bitwarden = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp`.
  Petakan ke `vault_items` (title=name, url, username=username|login_username, password, notes=note|notes,
  totp=login_totp bila ada). Enkripsi dengan DEK. Skip baris tanpa name. Return ImportResult.
  Log activity module="data", action="import_browser".

### E.6 `lib.rs` — daftarkan 7 command baru di `generate_handler!` (blok `// totp` dan `// data (wave 4)`).
### E.7 `commands/mod.rs` — `pub mod totp;` + fungsi `ensure_column`.

### E.8 Verifikasi Agent E
`cd /home/kian/Projects/qvault/src-tauri && cargo check 2>&1 | tail -25` → WAJIB `Finished` exit 0.
Lalu `cargo test 2>&1 | tail -15` → 4 test lama harus tetap lulus. Laporkan output MENTAH.

---

## F. ATURAN UMUM
- Komentar: Indonesia santai. UI: Inggris.
- JANGAN sentuh file milik agent lain. JANGAN edit `types.ts`, `api.ts`, `App.tsx`, `Sidebar.tsx`.
- JANGAN `git commit` / `git push`.
- Laporkan output MENTAH tsc/cargo. Bila gagal, katakan gagal — jangan mengarang.
