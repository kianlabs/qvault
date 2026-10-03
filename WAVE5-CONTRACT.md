# WAVE 5 — CONTRACT (parity: 3 gap KeepR terakhir)

Tujuan: menutup 3 gap terakhir dibanding KeepR.
1. **Full Screen Mode** (Dashboard & Calendar) — toggle jendela penuh.
2. **Toggle "Website icons"** di Appearance — on/off ikon situs di daftar vault.
3. **Preset tema bernama** — dark / light / **slate** / **nord** / **sepia**.

**Sudah dikerjakan PARENT (jangan diubah lagi):**
- `src/lib/types.ts`: `Theme = "dark"|"light"|"slate"|"nord"|"sepia"`; `Settings.showIcons: boolean`.
- `src-tauri/src/models.rs` + `commands/settings.rs`: `show_icons` (default true, key `show_icons` = "1"/"0").
- `src/index.css`: kelas preset `html.slate`, `html.nord`, `html.sepia` (+ `.light`).
- `src/App.tsx`: apply preset kelas + toggle varian dark (slate/nord = gelap).
- `src-tauri/capabilities/default.json`: izin `core:window:allow-set-fullscreen`, `core:window:allow-is-fullscreen`.

---

## Agent F — Full Screen Mode (frontend)

**File yang dimiliki:** `src/lib/fullscreen.ts` (baru), `src/features/dashboard/DashboardPage.tsx`, `src/features/calendar/CalendarPage.tsx`.
**JANGAN sentuh** file lain (App.tsx, Topbar.tsx, Sidebar.tsx, types.ts, SettingsPage.tsx, dll). JANGAN git commit/push.

### F.1 `src/lib/fullscreen.ts`
```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Apakah window sedang fullscreen. */
export async function isFullscreen(): Promise<boolean>;
/** Toggle fullscreen; kembalikan state baru. */
export async function toggleFullscreen(): Promise<boolean>;
/** Keluar dari fullscreen (diam-diam gagal bila API tidak ada). */
export async function exitFullscreen(): Promise<void>;
```
Implementasi: `const w = getCurrentWindow();` → `await w.isFullscreen()`, `await w.setFullscreen(v)`. **Bungkus try/catch** — di luar Tauri (mis. `bun run dev` di browser) API bisa throw; kembalikan `false` agar app tidak crash.

### F.2 Tombol fullscreen di header Dashboard & Calendar
- Di header tiap halaman (baris judul + subtitle yang sudah ada), tambahkan tombol ikon di kanan:
  - `Maximize2` saat belum fullscreen, `Minimize2` saat sudah (dari `lucide-react`).
  - `title="Full screen"` / `title="Exit full screen"`, gaya tombol sama seperti tombol ikon lain di halaman (mis. `grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-ink`).
  - `onClick` → `const fs = await toggleFullscreen(); setFs(fs);`.
- Sinkronkan state saat mount: `useEffect(() => { void isFullscreen().then(setFs); }, [])`.
- Saat fullscreen aktif: kalau halaman punya container `max-w-*`, hapus/lebarkan (mis. hilangkan kelas `max-w-6xl` → `max-w-none`) supaya konten benar-benar memenuhi layar. Dashboard & Calendar **tidak** punya wrapper max-width sendiri (App.tsx yang punya) — jadi cukup tambahkan `useEffect` yang menambahkan `p-0`/menghilangkan padding? **Tidak.** Cukup toggle tombol + biarkan konten apa adanya; JANGAN ubah layout global.
- Tambahkan juga listener `Escape` di halaman saat fullscreen → `exitFullscreen()`.

### F.3 Verifikasi
`cd /home/kian/Projects/qvault && npx tsc --noEmit; echo TSC_EXIT=$?` → harus **TSC_EXIT=0**. Laporkan output mentah.

---

## Agent G — Appearance: toggle ikon situs + pemilih preset tema

**File yang dimiliki:** `src/features/settings/SettingsPage.tsx`, `src/features/vault/VaultPage.tsx`.
**JANGAN sentuh** file lain. JANGAN git commit/push.

### G.1 Preset tema bernama (SettingsPage, section Appearance)
- Ganti baris `theme === t` yang lama (yang cuma dark/light) dengan daftar **5 preset**:
  ```ts
  const THEMES: { id: Theme; label: string }[] = [
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "slate", label: "Dark · Slate" },
    { id: "nord", label: "Dark · Nord" },
    { id: "sepia", label: "Light · Sepia" },
  ];
  ```
- Render sebagai grid tombol (2–3 kolom). Tiap tombol: label + **swatch warna** kecil (kotak warna background preset) agar mirip KeepR (`Appearance - Dark - Slate.webp`).
  - Warna swatch: dark `#0e1015`, light `#f6f7fb`, slate `#0f172a`, nord `#2e3440`, sepia `#f4ecd8`.
  - Tombol aktif: `border-accent bg-accent-soft text-ink`; non-aktif: `border-line text-muted hover:text-ink`.
- Simpan lewat `persist({ theme, accent, fontSize }, "Appearance saved")` yang sudah ada (tidak perlu ubah).

### G.2 Toggle "Website icons" (SettingsPage, section Appearance)
- Tambahkan baris toggle di bawah "Font size": label **"Website icons"**, deskripsi **"Show each site's favicon in the vault list."**
- State lokal `showIcons` (default `true`), isi dari `settings.showIcons` di `useEffect` loader yang sudah ada, dan sertakan di `persist({ theme, accent, fontSize, showIcons }, "Appearance saved")`.
- Gaya: pakai pola toggle/checkbox yang sudah ada di halaman (atau `input type="checkbox"` dengan `accent-[var(--accent)]`).

### G.3 Hormati `showIcons` di VaultPage
- `VaultPage.tsx` sudah import `faviconUrl` dan memakainya di avatar item (fungsi `VaultItemAvatar`/`initials` fallback sekitar baris 71–85).
- Baca `useSettingsStore` → `settings?.showIcons ?? true`. Bila **false**, JANGAN pakai favicon/ikon situs: langsung pakai inisial. (Ikon `item.icon` manual boleh tetap? → **Tidak**, saat showIcons=false pakai inisial saja, sederhana.)
- Pastikan tidak mengubah API komponen lain.

### G.4 Verifikasi
`cd /home/kian/Projects/qvault && npx tsc --noEmit; echo TSC_EXIT=$?` → harus **TSC_EXIT=0**. Laporkan output mentah.

---

## Catatan bersama
- Token gaya: `bg-surface bg-elevated border-line text-ink text-muted bg-accent bg-accent-soft`.
- Ikon: `lucide-react`. UI bahasa Inggris, komentar bahasa Indonesia santai.
- JANGAN `git commit` / `git push`.
- Laporkan output verifikasi **mentah** — jangan mengarang. Bila gagal, perbaiki sampai hijau.
