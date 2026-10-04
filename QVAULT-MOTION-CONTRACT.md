# QVAULT — MOTION CONTRACT (GSAP)

Tujuan: menambahkan **efek masuk yang halus** ke tiap halaman, memakai satu
lapisan gerak bersama. **Hanya menyentuh presentasi** — jangan ubah logika,
crypto, TOTP, auto-lock, clipboard, DB, atau handler data apa pun.

## API yang tersedia — `src/lib/motion.ts`

Import dari `"../../lib/motion"` (atau `"../lib/motion"` bila file ada di
`src/components/`).

| Helper | Kegunaan |
|---|---|
| `useGsap(fn, deps?, scopeRef?)` | Jalankan animasi dalam `gsap.context()`; otomatis dibersihkan saat unmount. **Selalu pakai ini**, jangan `gsap.to` telanjang di `useEffect`. |
| `usePageEnter(deps?)` | Mengembalikan `ref` untuk wrapper konten; animasi naik-halus + fade. (Sudah dipasang di `App.tsx` untuk transisi rute — **jangan** pasang lagi di halaman.) |
| `staggerIn(container, selector?, opts?)` | Anak-anak container muncul berurutan. `opts: { y, duration, stagger, delay }`. |
| `popIn(el)` | Panel/kartu muncul dengan sedikit skala (modal, popover). |
| `pulse(el)` | Denyut singkat saat nilai berubah. |
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

## Aturan

1. **GPU-friendly saja**: animasikan `opacity`/`autoAlpha` dan `transform`
   (`y`, `scale`). JANGAN animasikan `width`/`height`/`top`/`left`/`margin`.
2. **Durasi pendek**: 0.18–0.35s. `ease: "power2.out"`.
3. **Jangan animasikan saat data pertama kali kosong** lalu muncul lagi terus —
   cukup pada mount/perubahan filter.
4. **Jangan tambah dependensi** baru. GSAP sudah terpasang.
5. **Jangan hardcode warna**; pakai token yang sudah ada (`text-ink`, `bg-surface`, dst).
6. **Jangan** menyentuh `src/lib/motion.ts`, `src/App.tsx`, `vite.config.ts`,
   `package.json`, atau file di `src/components/ui/` — itu milik lead.
7. **Jangan** ubah teks/struktur JSX yang terlihat; hanya tambah `ref` + `useGsap`.
8. Bila ragu, lebih sedikit animasi lebih baik. Jangan berlebihan.

## Bukti wajib

Setelah selesai, jalankan dan tempel output:

```
cd /home/kian/Projects/qvault && npx tsc --noEmit
```

Harus `exit 0`. Laporkan file yang diubah + helper yang dipakai per halaman.
