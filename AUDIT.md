# QVAULT — Laporan Audit Menyeluruh

**Tanggal:** 2026-10-04
**Lingkup:** seluruh repo `/home/kian/Projects/qvault` (Rust/Tauri v2 + React 19 + TS + SQLite)
**Sifat:** audit read-only. Tidak ada file sumber yang diubah. Working tree bersih (`git status --short` kosong) kecuali artefak build `dist/` dari verifikasi.
**Ground truth:** kode = realitas; dokumen kontrak (`SPEC.md` < `FINAL-CONTRACT.md` < `WAVE3-CONTRACT.md` < `WAVE4-CONTRACT.md` < `WAVE5-CONTRACT.md`) = intent. Drift antara keduanya dilaporkan sebagai temuan tersendiri.

---

## Ringkasan Eksekutif

QVAULT adalah vault lokal (local-first) yang secara arsitektur **kokoh**: kripto memakai Argon2id + AES-256-GCM dengan `zeroize` on drop, CSP sangat ketat, tanpa capability `fs`, tanpa `dangerouslySetInnerHTML`/`eval`, dan tanpa satu pun permintaan jaringan keluar. Seluruh toolchain **hijau**: `tsc` (0), `cargo test` (14 lulus), `cargo clippy` (0, 5 warning), `bun run build` (0).

Namun ditemukan **satu cacat Critical** yang menyebabkan **kehilangan data + penurunan keamanan secara senyap**: setiap penyuntingan item vault menghapus secret 2FA (TOTP) item tersebut, karena form edit mengirim `totp: null` dan backend menuliskannya sebagai NULL. Selain itu ada **satu temuan High**: fitur "backup harian otomatis" diiklankan di README dan UI, tetapi **tidak ada scheduler sama sekali** — hanya backup manual.

Sisanya adalah temuan Medium/Low seputar hardening (tanpa rate-limit unlock, auto-lock tidak bereaksi pada blur/visibility), inkonsistensi nilai default, dan higienitas CI.

| Severity | Jumlah | Inti |
|---|---:|---|
| **Critical** | 1 | Penyuntingan item vault menghapus secret 2FA diam-diam |
| **High** | 1 | "Backup harian otomatis" diiklankan, tapi tidak ada scheduler |
| **Medium** | 2 | Tanpa rate-limit/lockout unlock; auto-lock abaikan blur/visibility |
| **Low** | 12 | Inkonsistensi default, higienitas clipboard/CI/backup, modulo bias, dsb. |

---

## Critical

### C1. Menyunting item vault menghapus secret 2FA (TOTP) secara diam-diam

**Bukti rantai (terverifikasi):**
1. `src/features/vault/VaultPage.tsx:74` — `EMPTY_FORM` menetapkan `totp: null`.
2. `src/features/vault/VaultPage.tsx:231` — `openEdit()` mengisi form dengan `totp: null`, dengan komentar eksplisit *"2FA tidak di-preload (secret tidak pernah dikirim ke frontend)"*.
3. `src/features/vault/VaultPage.tsx:246` — `onSubmit` membangun `payload = { ...form, tags: parseTags(tagsText) }`, sehingga **selalu** membawa `totp: null` (baik create maupun update).
4. `src/lib/types.ts:126` — `totp?: string | null`; `src-tauri/src/models.rs:126` — `pub totp: Option<String>` dengan `#[serde(default)]`.
5. `src-tauri/src/commands/vault.rs:143-160` — `update_vault_item` **selalu** menulis kolom: `totp_enc = ?11` dengan argumen `enc_opt(&key, &payload.totp)?` (`vault.rs:159`).
6. `src-tauri/src/commands/mod.rs:161-166` — `enc_opt` memetakan `None`/string kosong → `None` → kolom menjadi **NULL**.
7. `src-tauri/src/commands/vault.rs:35-39` — `has_totp` dihitung dari kolom tersebut, sehingga berubah menjadi `false`.

**Dampak:** mengganti field apa pun pada item yang punya 2FA — bahkan hanya mengganti judul — akan **menghapus secret TOTP** tanpa peringatan. Pengguna kehilangan kemampuan menghasilkan kode 2FA (kehilangan data), dan perlindungan 2FA pada item itu turun secara senyap (penurunan keamanan). `TotpField` (dipasang di modal, `VaultPage.tsx:666-669`) tidak pernah menulis balik ke `form.totp`, jadi tidak ada jalur yang memulihkan nilainya.

**Catatan drift kontrak:** `WAVE4-CONTRACT.md:227-228` secara eksplisit menginstruksikan *"bila `payload.totp` None → tetap None … tulis apa adanya"*. Backend mematuhi kontrak; justru kontrak itulah yang melahirkan bug ini karena mengabaikan desain "secret tidak pernah dikirim ke frontend". Ini contoh drift intent-vs-realitas: kontrak meminta perilaku yang mustahil aman bila secret tidak pernah di-preload.

**Rekomendasi:** jangan pernah mengirim `totp` dari form edit. Ubah payload update agar `totp` bersifat tri-state — absen = jangan sentuh, `Some("")`/penanda khusus = hapus eksplisit, `Some(secret)` = set. Implementasi minimal: tambahkan `#[serde(default, skip_serializing_if = "Option::is_none")]` pada `VaultItemPayload.totp` dan di backend ubah `update_vault_item` agar hanya menyentuh `totp_enc` bila field benar-benar ada (mis. via `Option<Option<String>>`), sementara `create_vault_item` tetap menulis apa adanya. Tambahkan uji regresi: set TOTP → update judul → `totp_status` harus tetap `true`.

---

## High

### H1. "Backup harian otomatis" diiklankan, tetapi tidak ada scheduler

**Bukti (terverifikasi):**
- `README.md:47` — *"…on demand plus daily via a system timer; keeps the last 5."*
- `src/features/settings/SettingsPage.tsx:716-717` — teks UI: *"Snapshot the encrypted database anytime — keeps the latest 5. **Daily automatic snapshots run via the system backup timer.**"*
- `WAVE4-CONTRACT.md:74` mewajibkan *"toggle 'Enable automatic backups'"*.
- Grep `async_runtime|spawn|interval|scheduler|cron|setInterval|tokio::time` pada `src-tauri/src/` → **kosong**. Satu-satunya jalur adalah tombol manual `Back up now` (`SettingsPage.tsx:731`) → `api.autoBackupNow()` (`src/lib/api.ts:152`) → `auto_backup_now` (`src-tauri/src/commands/data.rs:711`). Tidak ada toggle "Enable automatic backups" di UI (grep → nol).
- `auto_backup_now_impl` (`data.rs:720-757`) hanya melakukan `VACUUM INTO` + prune saat dipanggil manual; tidak ada timer yang memanggilnya.

**Dampak:** pengguna (dan pembaca README) dibuat percaya punya snapshot harian, padahal tidak ada backup otomatis sama sekali. Karena backup adalah jaring pengaman utama, klaim palsu ini berpotensi menyebabkan kehilangan data nyata. Ini drift kontrak (WAVE4 §A.6 tak terpenuhi) sekaligus klaim produk yang menyesatkan.

**Rekomendasi:** pilih salah satu — (a) implementasikan timer nyata di backend (mis. `tauri::async_runtime` + interval, atau scheduler saat startup) beserta toggle "Enable automatic backups", **atau** (b) perbaiki teks UI + README agar hanya menyebut backup manual. Jangan biarkan klaim "daily … system timer" tanpa implementasi.

---

## Medium

### M1. Tanpa rate-limiting / lockout pada `unlock_vault`

**Bukti:** `src-tauri/src/commands/security.rs:125-142` — `unlock_vault` → `unlock_dek` (`security.rs:53-64`) tanpa penghitung percobaan gagal. Mitigasi satu-satunya adalah biaya Argon2id (`crypto/kdf.rs`: m=19456 KiB, t=2, p=1). `validate_password` (`security.rs:69-76`) hanya memeriksa panjang (≥8) dan hanya dipakai untuk init/change, bukan unlock.

**Dampak:** penyerang dengan akses ke file DB dapat melakukan brute-force offline/online tanpa hambatan tambahan selain biaya KDF. Untuk vault lokal ini sebagian termitigasi oleh biaya Argon2id, tetapi tidak ada perlambatan adaptif.

**Rekomendasi:** tambahkan backoff eksponensial / lockout sementara setelah N percobaan gagal (disimpan di settings/state), atau minimal dokumentasikan secara eksplisit bahwa model ancaman mengandalkan biaya KDF saja.

### M2. Auto-lock tidak memperhitungkan kehilangan fokus / visibilitas jendela

**Bukti:** `src/App.tsx:39-59` — `useAutoLock` memasang listener pada `["mousemove","mousedown","keydown","scroll","touchstart"]` (`App.tsx:51`); **tidak ada** `window.blur` maupun `document.visibilitychange`. Aktif hanya saat `!locked && autoLockMin > 0` (`App.tsx:95`), default 15 menit (`settings.rs:24`).

**Dampak:** bila jendela diminimalkan/disembunyikan tanpa interaksi, vault tidak dikunci lebih cepat. Risiko praktis rendah (tetap terkunci setelah idle), tetapi perilaku keamanan tidak sesuai ekspektasi "auto-lock".

**Rekomendasi:** tambahkan listener `blur`/`visibilitychange` untuk mengunci (atau mempersingkat timer) saat jendela kehilangan fokus, sesuai kebijakan yang diinginkan.

---

## Low

### L1. Inkonsistensi default `fontSize` + kontrol font tidak pernah tersorot
- `src-tauri/src/commands/settings.rs:23` → default `14`.
- `src/App.tsx:85` → `settings?.fontSize ?? 16`.
- `src/features/settings/SettingsPage.tsx:101` → `useState(16)`.
- `src/features/settings/SettingsPage.tsx:64-66` → `FONT_SIZES` px = **13/15/18**; `SettingsPage.tsx:516` `active = fontSize === f.px`.

**Dampak:** (a) sebelum settings termuat, ukuran font 16 bukan 14 (kedipan awal, tidak persisten); (b) karena default 14/16 tidak sama dengan px mana pun di `FONT_SIZES`, **tidak ada** tombol Small/Medium/Large yang tersorot saat pertama dibuka. Rekomendasi: satukan satu sumber default dan selaraskan daftar px dengan nilai default.

### L2. Modulo bias pada generator password
`src/lib/utils.ts:204` (`crypto.getRandomValues(new Uint32Array(len))`) dan `src/lib/utils.ts:207` (`out += pool[bytes[i] % pool.length]`). Panjang pool bukan pangkat dua → bias kecil. Dampak praktis dapat diabaikan. Rekomendasi: rejection sampling.

### L3. `clipboard.ts` menimpa nilai config pengguna + hanya satu slot jadwal
`src/lib/clipboard.ts:15` `MIN_CLEAR_SEC = 5` dipaksa via `Math.max` (`clipboard.ts:30-31`); `SLOT` tunggal (`clipboard.ts:12`) dengan `cancelClipboardClear()` (`clipboard.ts:35`). Copy kedua (mis. kode TOTP 20 dtk) membatalkan jadwal clear copy pertama. Bukan kebocoran; murni perilaku. Rekomendasi: dukung multi-slot atau dokumentasikan batas minimum.

### L4. `ErrorBoundary` menyalin stack + URL ke clipboard, tidak dibersihkan bila app ditutup
`src/components/ErrorBoundary.tsx:43` (`url: ${window.location.href}`), `ErrorBoundary.tsx:47` (`await secureCopy(details, 30)`). Bila aplikasi ditutup sebelum 30 dtk, timer hilang → clipboard tidak dikosongkan. Saat vault terkunci URL hanya berisi route (mis. `#/vault`), bukan secret → tetap Low. Rekomendasi: bersihkan clipboard saat `beforeunload`, atau jangan sertakan URL.

### L5. Password hasil reveal bertahan di state React
`src/features/vault/VaultPage.tsx:156` (`useState<Record<string,string>>({})`), diisi di `onReveal` (`VaultPage.tsx:261-278`). Tidak dibersihkan saat item di-refresh/dihapus, dan tidak dinolkan saat lock (bergantung pada unmount `VaultPage`). Rekomendasi: bersihkan entri saat item hilang dan saat transisi lock.

### L6. `import_backup` tidak memvalidasi field `version`
`src-tauri/src/commands/data.rs:105` menulis `"version": 1`, tetapi `data.rs:161` hanya membaca `.get("tables")` — field `version` tidak pernah dibaca. Forward-compat lemah. Rekomendasi: tolak `version` yang tidak dikenal atau tangani migrasi format.

### L7. `reset_vault` tidak menghapus tabel `templates`
`src-tauri/src/commands/security.rs:227-233` menghapus `vault_items, notes, tasks, income, folders, activity_log, settings` — **bukan** `templates` (tabel ada di `db/schema.sql:92`). Setelah reset, template lama tetap tersisa (data residual; daftar template muncul di vault yang "kosong"). Rekomendasi: tambahkan `DELETE FROM templates;` (dan tabel terkait lain bila ada).

### L8. Teks label backup tidak akurat ("…and setting")
`src/features/settings/SettingsPage.tsx:619` — *"Export an encrypted copy of every item, note, task and setting."* Namun `BACKUP_TABLES` (`src-tauri/src/commands/data.rs:80-88`) **tidak** menyertakan tabel `settings`. Ini keputusan desain yang aman (master password tidak bisa ditimpa lewat file backup), tetapi teksnya keliru. Rekomendasi: perbaiki teks agar tidak menjanjikan `settings`.

### L9. CI tidak menjalankan clippy / fmt / eslint / test frontend
`.github/workflows/ci.yml` hanya menjalankan `bunx tsc --noEmit`, `bun run build`, `cargo check`, `cargo test` (baris 17-44). Tidak ada `clippy`/`fmt`/`eslint` (grep → nol di `ci.yml` & `package.json`). Akibatnya `manual RangeInclusive::contains` (`src-tauri/src/commands/totp.rs:202`, terdeteksi clippy) lolos CI karena clippy dijalankan tanpa `-D warnings`. Rekomendasi: tambahkan `cargo clippy -- -D warnings` + `cargo fmt --check`.

### L10. `useThemeStore.setTheme` fire-and-forget
`src/store/useThemeStore.ts:43-49` — `void api.updateSettings({ theme }).catch(() => {})`. Kegagalan persist tema dibisukan (UI optimistik tetap jalan). Rekomendasi: minimal catat/toast bila persist gagal.

### L11. `export_backup` tidak memvalidasi kekuatan password backup
`src-tauri/src/commands/data.rs:97-131` — `export_backup_impl` memakai `derive_key(&password, &salt)` tanpa pemeriksaan panjang/kekosongan (tidak memanggil `validate_password`). Backup tetap AES-256-GCM, tetapi password kosong/lemah dapat membuat file backup mudah di-brute-force. Rekomendasi: terapkan panjang minimum pada password backup.

### L12. `key` DEK tidak di-zeroize pada `lock_vault`/`reset_vault` secara eksplisit
`src-tauri/src/commands/security.rs:147-152` (lock) dan `security.rs:243` (reset) mengganti `Option<Key>` menjadi `None`. Karena `Key` mengimplementasikan `Drop → zeroize` (`src-tauri/src/crypto/cipher.rs:25-31`), ini **aman** — namun `#[derive(Clone)]` pada `Key` (`cipher.rs:20`) berarti salinan (mis. saat di-clone ke variabel lokal) tetap ada sampai drop. Bukan kebocoran terverifikasi; dicatat sebagai catatan hardening. Rekomendasi: hindari `Clone` bila tidak perlu.

---

## Drift Kontrak (Informasi — Positif Keamanan)

### D1. `faviconUrl` selalu `null`, menyimpang dari WAVE3-CONTRACT §D — demi privasi
`WAVE3-CONTRACT.md:230-231` mewajibkan `faviconUrl()` mengembalikan `https://www.google.com/s2/favicons?domain=<host>&sz=64`. Implementasi `src/lib/favicon.ts:1-18` **selalu** `return null`, dengan alasan terdokumentasi: mengambil favicon dari pihak ketiga akan membocorkan hostname tiap item vault ke jaringan luar — bertentangan dengan prinsip local-first. Konsumen (`VaultPage.tsx:95`) otomatis jatuh ke inisial lokal. **Ini bukan bug**; ini deviasi yang memperkuat privasi dan konsisten dengan tidak adanya permintaan jaringan keluar. Rekomendasi: perbarui WAVE3-CONTRACT §D agar mencerminkan keputusan privasi ini supaya tidak dibaca sebagai utang teknis.

---

## Kekuatan Terverifikasi (Blue-team)

Disajikan sejajar dengan temuan di atas, berdasarkan pembacaan kode langsung:

1. **Anti-injeksi restore backup.** `insert_rows` (`src-tauri/src/commands/data.rs:210-258`) mem-whitelist key JSON terhadap kolom asli via `PRAGMA table_info` sebelum menyusun SQL; ada uji regresi `backup_import_ignores_malicious_column_names` yang lulus.
2. **CSP sangat ketat & tanpa capability `fs`.** `src-tauri/tauri.conf.json:25` (`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`); `src-tauri/capabilities/default.json` hanya `core:default` + window control + `opener:default` + `dialog:default` — tidak ada `fs`, tidak ada `devtools`/`withGlobalTauri`.
3. **Izin file 0600.** DB (`src-tauri/src/db/mod.rs:49-52, 76-88`), backup terenkripsi (`data.rs:120-122`), auto-backup (`data.rs:736-738`), dan CSV ekspor plaintext (`data.rs:400-402`) semuanya memaksa `0600`.
4. **`zeroize` on drop.** `src-tauri/src/crypto/cipher.rs:19-31` — `Key` menghapus byte kunci saat drop.
5. **Permukaan IPC minimal.** Hanya `src/lib/api.ts` yang memanggil `invoke()`.
6. **Tanpa vektor XSS umum.** Tidak ada `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` di `src/`; `src/lib/markdown.tsx` menghasilkan node React murni dan membuka link via `openUrl` (plugin-opener), bukan navigasi webview.
7. **Tanpa permintaan jaringan keluar.** Tidak ada `fetch`/XHR/axios ke host luar; favicon sengaja `null` (lihat D1).
8. **Kripto sesuai standar.** Argon2id (m=19456, t=2, p=1) + AES-256-GCM, nonce 12 byte per operasi; vektor uji RFC 6238 SHA-1 lulus (`totp.rs` test `rfc6238_sha1_vectors`).
9. **Secret TOTP tidak pernah dikirim ke frontend.** `get_totp_code` hanya mengembalikan kode 6 digit (`totp.rs:139-160`); frontend hanya menerima `hasTotp` boolean.
10. **Tabel `settings` dikecualikan dari backup** (`data.rs:80-88`) → master password/verifier tidak dapat ditimpa lewat file backup.
11. **`reset_vault` mengosongkan `dek_wrapped`** (`security.rs:227-233`) → vault kembali ke keadaan belum diinisialisasi.
12. **Recovery code tanpa bias modulo.** `ALPHABET` 32 karakter (`security.rs:187`), `256 % 32 == 0` → distribusi seragam.
13. **Penanganan poisoning mutex aman.** `unwrap_or_else(|p| p.into_inner())` dipakai konsisten (mis. `state.rs`, `security.rs`).

---

## Bukti Verifikasi (dijalankan ulang pada sesi ini)

| Perintah | Exit | Output kunci |
|---|---:|---|
| `bunx tsc --noEmit` | **0** | tanpa output (bersih) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **0** | `14 passed; 0 failed` (3 suite) |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` | **0** | 5 warning: `SALT_LEN`/`KEY_LEN`/`as_bytes`/`conn` never used + `manual RangeInclusive::contains` (`totp.rs:202`). Tanpa `-D warnings` → tidak memblokir. |
| `bun run build` (`tsc && vite build`) | **0** | `✓ 1643 modules transformed`, `built in 1.19s`; `index-CDBJwhCH.js 198.60 kB (gzip 51.29)`, `react-D64AEw9n.js 258.30 kB (gzip 81.94)`, `index-Bf9RE59S.css 41.87 kB` |

Catatan: `cargo check` tidak dijalankan ulang terpisah pada sesi ini, namun `cargo clippy` (yang menyertakan pemeriksaan kompilasi) keluar dengan exit 0.

---

## Rekomendasi Prioritas

1. **Segera (Critical):** perbaiki C1 agar penyuntingan item tidak menghapus TOTP; tambahkan uji regresi.
2. **Segera (High):** implementasikan atau tarik klaim backup harian otomatis (H1) di UI + README.
3. **Jangka pendek:** rate-limit unlock (M1); auto-lock pada blur/visibility (M2).
4. **Higienitas:** perbaiki default font (L1), teks label backup (L8), `reset_vault` untuk `templates` (L7), dan tambahkan clippy/fmt ke CI (L9).
5. **Dokumentasi kontrak:** selaraskan `WAVE3-CONTRACT.md §D` (favicon) dan `WAVE4-CONTRACT.md §E.3` (TOTP update) dengan realitas/keputusan keamanan yang diinginkan.
