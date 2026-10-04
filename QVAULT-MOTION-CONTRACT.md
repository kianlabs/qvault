# QVAULT — MOTION CONTRACT (Web Animations API + View Transitions)

Tujuan: memberi **efek masuk yang halus** ke tiap halaman lewat satu lapisan
gerak bersama, dan **transisi tema yang mulus** ala web CV (reveal lingkaran).
**Hanya menyentuh presentasi** — jangan ubah logika, crypto, TOTP, auto-lock,
clipboard, DB, atau handler data apa pun.

> **Tanpa library animasi.** GSAP sudah **dihapus** dari proyek. Semua gerak
> memakai **Web Animations API (WAAPI) native** dan **View Transitions API**
> bawaan browser. Ini memangkas ~27 KB (gzip) dari bundel dan membuat animasi
> berjalan di compositor thread (lebih ringan, scroll tetap mulus).

## API yang tersedia — `src/lib/motion.ts`

Import dari `"../../lib/motion"` (atau `"../lib/motion"` bila file ada di
`src/components/`).

| Helper | Kegunaan |
|---|---|
| `useGsap(fn, deps?, scopeRef?)` | Jalankan animasi di dalam `fn`; semua animasi yang dibuat di sana otomatis dibatalkan saat unmount / deps berubah. **Selalu pakai ini** untuk animasi berbasis lifecycle, jangan panggil `.animate()` telanjang di `useEffect`. (Namanya tetap `useGsap` demi kompatibilitas import lama.) |
| `usePageEnter(deps?)` | Mengembalikan `ref` untuk wrapper konten; animasi naik-halus + fade. (Sudah dipasang di `App.tsx` untuk transisi rute — **jangan** pasang lagi di halaman.) |
| `staggerIn(container, selector?, opts?)` | Anak-anak container muncul berurutan. `opts: { y, duration, stagger, delay }` — `duration`/`stagger`/`delay` dalam **detik** (default: `y=8`, `duration=0.28`, `stagger=0.035`). |
| `popIn(el)` | Panel/kartu muncul dengan sedikit skala (modal, popover). |
| `fadeIn(el, durationSec?)` | Fade sederhana (mis. overlay modal). Default 0.22s. |
| `pulse(el)` | Denyut singkat saat nilai berubah (skor, saldo). |
| `pageEnter(el)` | Versi imperatif dari animasi masuk halaman. |
| `swapTheme(apply, toggleEl?)` | **Transisi tema** lewat View Transitions API: reveal `clip-path: circle()` mengembang dari `toggleEl`. Lihat bagian di bawah. |
| `motionOK` | `false` bila OS minta reduced-motion — **tak perlu dicek manual**, semua helper sudah menghormatinya. |

## Pola yang dipakai di setiap halaman

Tambahkan `ref` pada **container utama daftar/grid** (bukan tiap item), lalu
stagger anak-anaknya:

```tsx
import { useRef } from "react";
import { useGsap, staggerIn } from "../../lib/motion";

const listRef = useRef<HTMLDivElement>(null);
useGsap(() => {
  staggerIn(listRef.current, ":scope > *", { y: 8, stagger: 0.03 });
}, [/* deps yang membuat daftar berubah, mis. filter/sort */]);
```

Lalu pasang `ref={listRef}` pada elemen pembungkus daftar/grid.

## Transisi tema — View Transitions API

`swapTheme(apply, toggleEl)` dipakai di `App.tsx`:

1. `apply` **harus** melakukan mutasi DOM **sinkron** (menukar class tema di
   `<html>`), karena View Transitions membekukan snapshot tepat sebelum &
   sesudah callback.
2. Browser mengambil snapshot tema lama & baru, lalu tema baru diungkap dengan
   `clip-path: circle()` yang mengembang dari pusat tombol toggle
   (`data-theme-toggle`, dipasang di `Sidebar.tsx`). Radius = jarak ke sudut
   viewport terjauh.
3. Durasi reveal **520 ms**, easing `ease-in-out`, dianimasikan pada
   `::view-transition-new(root)`.
4. Bila API tak tersedia atau reduced-motion aktif → `apply()` dijalankan
   langsung, pergantian tetap instan tanpa kedip (fallback aman).

**Terbukti bekerja di engine webview Tauri yang sesungguhnya** (WebKitGTK
2.52.6): `startViewTransition` ada, `clip-path: circle()` didukung, animasi
dibuat & selesai, dan mutasi DOM diterapkan. Diuji headless via
`tools/webkit_vt_test.py` (MiniBrowser + Xvfb).

## Aturan

1. **GPU-friendly saja**: animasikan `opacity` dan `transform` (`y`, `scale`,
   `clip-path` pada pseudo View Transition). JANGAN animasikan
   `width`/`height`/`top`/`left`/`margin`.
2. **Durasi pendek**: 0.18–0.35s untuk masuk halaman; easing `power2.out`
   (padanan `cubic-bezier(0.215, 0.61, 0.355, 1)`).
3. **`fill` WAJIB `"backwards"`, BUKAN `"both"`.** Dengan `"both"`, animasi yang
   sudah selesai tetap "hidup" dan menahan properti → tiap elemen dipaksa punya
   **layer komposit permanen**; pada WebKitGTK ini membuat **scroll tersendat**.
   `"backwards"` hanya menahan keadaan awal selama delay lalu melepas ke gaya
   asli → **nol layer tertinggal**, scroll tetap mulus. Ini penyebab jank yang
   pernah dilaporkan; jangan diulang.
4. **Jangan animasikan saat data pertama kosong** lalu muncul terus — cukup pada
   mount / perubahan filter.
5. **Jangan tambah dependensi** baru. **Tidak ada** library animasi; pakai
   WAAPI/View Transitions native saja.
6. **Jangan hardcode warna**; pakai token yang sudah ada (`text-ink`,
   `bg-surface`, dst).
7. **Jangan** menyentuh `src/lib/motion.ts`, `src/App.tsx`, `vite.config.ts`,
   `package.json`, atau file di `src/components/ui/` — itu milik lead.
8. **Jangan** ubah teks/struktur JSX yang terlihat; hanya tambah `ref` +
   `useGsap`.
9. Bila ragu, lebih sedikit animasi lebih baik. Jangan berlebihan.

## Bukti wajib

Setelah selesai, jalankan dan tempel output:

```
cd /home/kian/Projects/qvault && bunx tsc --noEmit
```

Harus `exit 0`. Laporkan file yang diubah + helper yang dipakai per halaman.

Untuk memverifikasi scroll tetap mulus (tanpa layer tertinggal) secara headless:

```
python tools/harness.py      # ukur jank scroll + deteksi View Transition
python tools/check_anims.py  # hitung animasi tertinggal setelah idle (harus 0)
```
