# QVAULT × KEEPR PARITY CONTRACT (v1)

Tujuan: QVAULT harus terasa **sama seperti KeepR** — bukan sekadar mirip fitur,
tapi bahasa visual, ritme, dan komponennya identik. Dokumen ini adalah kontrak
wajib untuk setiap subagent yang menyentuh UI.

## Referensi visual (SUMBER KEBENARAN)
Screenshot asli KeepR (1920×1080) ada di `/tmp/keepr-shots/*.webp`:
Dashboard, Vault, Vault - Grid View, Notes, Tasks, Calendar - Month, Income,
Folders - GridView, Favorites, Generate Password, Activity Log,
Settings - Account/Appearance/Security, Appearance - Dark - Slate,
Full Screen Mode, Search, Dashboard - World Clock.

**WAJIB** buka screenshot relevan dengan `vision_analyze` SEBELUM mengubah halaman.

## Aturan visual (WAJIB)
1. **Aksen** — JANGAN hardcode warna. Pakai token: `bg-accent`, `text-accent`,
   `bg-accent-soft`, `border-accent`, `text-accent-fg` (teks di atas aksen).
   Nilai `--accent` di-resolve otomatis dari settings (6 aksen: Sage, Clay,
   Slate, Moss, Stone, Dusk) via `src/lib/accents.ts`.
2. **Permukaan** — kartu: `rounded-2xl border border-line bg-elevated`.
   Kanvas: `bg-bg`. Panel/sidebar: `bg-surface`. Hover: `bg-raised`.
3. **Hairline** — border 1px `border-line` (kontras rendah), jangan shadow tebal.
4. **Teks** — `text-ink` (utama), `text-muted` (sekunder), `text-faint` (tersier).
   Angka/tanggal/monospace → `tabular-nums` atau `font-mono`.
5. **Radius** — kartu `rounded-2xl` (16px), kontrol `rounded-lg` (10px),
   pill/badge `rounded-full` atau `rounded-md`.
6. **Badge** — pakai `<Badge tone="…">` (neutral/accent/success/warn/danger/info).
   Tone = makna, bukan dekorasi.
7. **Tombol** — pakai `<Button variant="primary|secondary|ghost|danger">`.
   Aksi utama halaman = `primary` (aksen). Aksi baris = `<IconButton>`.
8. **Statistik** — pakai `<StatCard label value icon tone hint>`.
9. **Header halaman** — pakai `<PageHeader title subtitle actions>`.
10. **Empty state** — pakai `<EmptyState>` bila ada; jangan teks telanjang.
11. **Spacing** — gutter halaman `space-y-6`; gap kartu `gap-4`/`gap-5`;
    padding kartu `p-4`/`p-5`.

## Aturan perilaku (WAJIB)
- **JANGAN ubah logika bisnis, crypto, TOTP, auto-lock, clipboard wiper, atau
  skema database.** Hanya presentasi.
- **JANGAN ubah signature store/api.** Kalau butuh data baru, pakai store yang
  sudah ada.
- **JANGAN tambah dependency baru.**
- Pertahankan animasi yang sudah ada (`useGsap`, `staggerIn`, `pageEnter`) —
  kini berbasis **Web Animations API native**, tanpa library eksternal.
- Nama ekspor/komponen harus tetap sama agar tidak memutus import.
- Setiap file harus lolos `npx tsc --noEmit`.

## Checklist paritas per halaman (ringkas)
- [ ] Judul + subtitle deskriptif (bukan judul telanjang).
- [ ] Toolbar: search + filter + tombol `+` aksen di kanan.
- [ ] Kartu/baris pakai hairline + radius + surface ramp.
- [ ] Badge status pakai tone semantik.
- [ ] Angka/uang/tanggal pakai tabular-nums / font-mono.
- [ ] Hover state halus (150ms) di semua elemen interaktif.
- [ ] Tidak ada warna aksen hardcoded.

## Bukti (WAJIB dilaporkan)
Setelah selesai: jalankan `npx tsc --noEmit` dan laporkan exit code. Sebutkan
file yang diubah dan apa yang diubah, tanpa melebih-lebihkan.
