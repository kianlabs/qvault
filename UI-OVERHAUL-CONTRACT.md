# QVAULT — UI OVERHAUL CONTRACT ("Calm Precision")

> Wajib dibaca sebelum mengubah halaman mana pun. Fondasi (tokens, primitif,
> shell) sudah selesai & terverifikasi. Tugasmu: **terapkan** ke halaman, JANGAN
> mengubah fondasi.

## 0. Aturan mutlak

1. **JANGAN ubah** `src/index.css`, `src/components/ui/*`, `src/components/Sidebar.tsx`,
   `src/components/Topbar.tsx`, `src/App.tsx`. Fondasi ini sudah final.
2. **JANGAN ubah** logika bisnis, store, API, atau tipe. Hanya lapisan tampilan (JSX + className).
3. **JANGAN** menyentuh kripto/TOTP/auto-lock/clipboard. Perilaku harus identik.
4. Bahasa UI: **Inggris** (konsisten dengan app saat ini).
5. Setelah selesai WAJIB: `npx tsc --noEmit` exit 0.

## 1. Token warna — pakai ini, jangan hardcode hex

| Tujuan | Kelas |
|---|---|
| Kanvas app | `bg-bg` |
| Panel dasar (sidebar/topbar) | `bg-surface` |
| Kartu | `bg-elevated` |
| Hover / popover / input aktif | `bg-raised` |
| Border halus | `border-line` |
| Border tegas (hover) | `border-line-strong` |
| Teks utama | `text-ink` |
| Teks sekunder | `text-muted` |
| Teks tersier / placeholder | `text-faint` |
| Aksen | `bg-accent` / `text-accent` / `bg-accent-soft` |
| Semantik | `danger`, `warn`, `success`, `info` (+ `-soft`) |

**DILARANG**: `bg-white/5`, `text-white`, `bg-black/60` (kecuali overlay modal),
`bg-red-500`, `bg-emerald-500`, `border-gray-*`, atau hex apa pun. Ganti dengan token.

## 2. Skala tipografi (gunakan persis)

- Judul halaman: `text-2xl font-semibold tracking-tight` (dipakai lewat `<PageHeader>`)
- Judul section/kartu: `text-sm font-semibold`
- Body: `text-sm`
- Meta / label: `text-xs text-muted`
- Caption / badge: `text-[11px]`
- Angka metrik besar: `text-2xl font-semibold tracking-tight tabular-nums`

## 3. Primitif wajib (import dari `../components/ui`)

```tsx
import {
  Button, IconButton, Badge, Card, CardHeader,
  Input, SearchInput, Field, PageHeader, StatCard,
  Toggle, Tabs, Menu, RowActions,
} from "../components/ui";
```

- `<Button variant="primary|secondary|ghost|danger" size="sm|md" icon={Icon}>`
- `<Badge tone="neutral|accent|success|warn|danger|info">`
- `<Card padding="none|sm|md|lg" interactive>`
- `<Tabs items={[{value,label,count}]} value onChange />`
- `<Menu items={[{label,icon,onClick,danger}]} />` untuk aksi sekunder "⋯"
- `<RowActions>` — bungkus aksi baris; muncul hanya saat hover/focus.

## 4. Aturan UX yang WAJIB diperbaiki (temuan audit)

1. **Icon soup → hover-reveal.** Di daftar (Vault, Notes, Tasks, Income, Folders),
   jangan tampilkan edit+delete terus-menerus. Bungkus baris dengan `className="group …"`,
   letakkan aksi di dalam `<RowActions>`; maksimal 1 aksi primer terlihat + sisanya di `<Menu>`.
2. **Hapus data ganda.** Jangan ulangi angka yang sama di dua tempat pada satu layar.
3. **Hapus tag tak informatif** ("task" di Tasks, "note" di Notes) — semua item di
   halaman itu sudah jelas jenisnya.
4. **Satu favorit saja** per kartu (jangan bintang 2×).
5. **Tidak ada emoji** sebagai ikon; pakai Lucide.
6. **Kontras**: teks meta minimal `text-muted` (jangan lebih pudar dari itu untuk teks yang harus dibaca).
7. **Format tanggal seragam**: pakai `formatDate`/`formatRelative`/`formatDateTime` dari `../lib/utils`.
8. **State kosong**: pakai `<EmptyState>`, sertakan aksi bila relevan.
9. **Semua tombol ikon wajib punya `aria-label`** (IconButton sudah otomatis).

## 5. Struktur halaman standar

```tsx
<div className="space-y-6">
  <PageHeader
    title="Vault"
    subtitle="18 items · 2 weak"
    actions={<Button variant="primary" icon={Plus}>New item</Button>}
  />
  {/* konten */}
</div>
```

Grid kartu: `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`.
Baris daftar: kartu `padding="none"`, tiap baris `flex items-center gap-3 px-4 py-2.5
border-b border-line last:border-0 group hover:bg-raised`.

## 6. Definisi selesai

- [ ] Tidak ada warna hardcoded / `white/5` / `red-500` dll.
- [ ] Semua aksi baris hover-reveal + `aria-label`.
- [ ] Data tidak ada yang tampil ganda.
- [ ] `npx tsc --noEmit` → exit 0.
- [ ] Perilaku fungsional identik (tombol lama masih berfungsi, hanya tampilannya berubah).
