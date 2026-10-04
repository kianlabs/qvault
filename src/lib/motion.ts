// QVAULT — motion layer (Calm Precision).
//
// Prinsip: gerak harus *membantu*, bukan menghibur. Semua animasi hanya
// menyentuh `opacity` dan `transform` (GPU-friendly), durasinya pendek, dan
// otomatis dimatikan bila OS meminta reduced-motion. Tak ada animasi yang
// memblokir input.
//
// Implementasi memakai **Web Animations API (WAAPI) native** — bukan library
// eksternal. Ini menghapus ~27 KB (gzip) dependensi runtime, animasi berjalan
// di compositor thread (lebih ringan & mulus), dan bundel jadi lebih ramping.
//
// PENTING (performa scroll): semua animasi masuk memakai `fill: "backwards"`
// — BUKAN `"both"`. Dengan `"both"`, animasi yang sudah selesai tetap "hidup"
// dan menahan properti, sehingga tiap elemen dipaksa punya layer komposit
// permanen; pada WebKitGTK ini membuat scroll tersendat. `"backwards"` hanya
// menahan keadaan awal selama delay, lalu melepas ke gaya asli saat selesai →
// nol layer tertinggal, scroll tetap mulus.
import { useEffect, useRef, type RefObject } from "react";

/** Hormati setelan aksesibilitas OS. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Apakah animasi boleh berjalan? (sekali cek, dipakai berulang) */
export const motionOK = !prefersReducedMotion();

// ---------------------------------------------------------------------------
// Kurva easing (padanan GSAP → cubic-bezier WAAPI)
// ---------------------------------------------------------------------------
const EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)"; // ≈ power2.out

// ---------------------------------------------------------------------------
// Pelacakan animasi untuk pembersihan (dipakai useGsap)
// ---------------------------------------------------------------------------
let _sink: Animation[] | null = null;

function _track(anim: Animation | undefined): void {
  if (anim && _sink) _sink.push(anim);
}

/** Batalkan animasi lama pada satu elemen agar restart bersih (tak menumpuk). */
function _cancelOn(el: Element): void {
  el.getAnimations().forEach((a) => a.cancel());
}

// ---------------------------------------------------------------------------
// Primitif animasi
// ---------------------------------------------------------------------------

/** Halaman/kontainer masuk: naik halus + fade. */
export function pageEnter(el: Element | null): void {
  if (!el || !motionOK) return;
  _cancelOn(el);
  _track(
    el.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 340, easing: EASE_OUT, fill: "backwards" },
    ),
  );
}

/** Anak-anak sebuah container muncul berurutan (cascade). */
export function staggerIn(
  container: Element | null,
  selector = ":scope > *",
  opts: { y?: number; duration?: number; stagger?: number; delay?: number } = {},
): void {
  if (!container || !motionOK) return;
  const targets = container.querySelectorAll(selector);
  if (targets.length === 0) return;

  // Durasi & stagger dalam detik (kompatibel dgn pemanggil lama).
  const y = opts.y ?? 8;
  const durMs = (opts.duration ?? 0.28) * 1000;
  const staggerMs = (opts.stagger ?? 0.035) * 1000;
  const baseDelay = (opts.delay ?? 0) * 1000;

  targets.forEach((t, i) => {
    _cancelOn(t);
    _track(
      t.animate(
        [
          { opacity: 0, transform: `translateY(${y}px)` },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: durMs,
          delay: baseDelay + i * staggerMs,
          easing: EASE_OUT,
          fill: "backwards",
        },
      ),
    );
  });
}

/** Kartu/panel muncul dengan sedikit skala — untuk modal & popover. */
export function popIn(el: Element | null): void {
  if (!el || !motionOK) return;
  _cancelOn(el);
  _track(
    el.animate(
      [
        { opacity: 0, transform: "translateY(6px) scale(0.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 220, easing: EASE_OUT, fill: "backwards" },
    ),
  );
}

/** Fade sederhana (mis. overlay modal). */
export function fadeIn(el: Element | null, durationSec = 0.22): void {
  if (!el || !motionOK) return;
  _cancelOn(el);
  _track(
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: durationSec * 1000,
      easing: EASE_OUT,
      fill: "backwards",
    }),
  );
}

/** Umpan balik singkat saat nilai berubah (mis. skor, saldo). */
export function pulse(el: Element | null): void {
  if (!el || !motionOK) return;
  _cancelOn(el);
  _track(
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.03)" },
        { transform: "scale(1)" },
      ],
      { duration: 240, easing: "ease-in-out" },
    ),
  );
}

// ---------------------------------------------------------------------------
// Transisi tema — View Transitions API (paritas web CV)
// ---------------------------------------------------------------------------
//
// Alih-alih menganimasikan DOM (berat: memaksa repaint seluruh shell), kami
// memakai **View Transitions API**: browser mengambil *snapshot* tema lama &
// baru, lalu mengungkap tema baru dengan lingkaran `clip-path` yang mengembang
// dari tombol toggle. Karena yang dianimasikan hanya gambar snapshot di
// compositor, hasilnya jauh lebih mulus — inilah pola yang dipakai web CV.

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void> };

/** Durasi reveal (ms). Disamakan persis dengan web CV. */
const THEME_DUR = 800;

/**
 * Tukar tema dengan reveal lingkaran dari `toggleEl`.
 *
 * `apply` HARUS melakukan mutasi DOM sinkron (menukar class tema di <html>),
 * karena View Transitions membekukan snapshot tepat sebelum & sesudah callback.
 * Bila API tak tersedia atau reduced-motion aktif, `apply` dijalankan langsung
 * tanpa animasi (pergantian tetap instan, tanpa kedip).
 */
export function swapTheme(apply: () => void, toggleEl?: Element | null): void {
  if (typeof document === "undefined") {
    apply();
    return;
  }

  const start =
    typeof document.startViewTransition === "function"
      ? document.startViewTransition.bind(document)
      : null;

  if (!start || prefersReducedMotion()) {
    apply();
    return;
  }

  let vt: ViewTransitionLike;
  try {
    vt = start(apply) as unknown as ViewTransitionLike;
  } catch {
    // API ada tapi menolak (mis. transisi lain sedang jalan) → fallback instan.
    apply();
    return;
  }

  vt.ready
    .then(() => {
      const r = toggleEl?.getBoundingClientRect();
      const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const cy = r ? r.top + r.height / 2 : 40;
      const radius = Math.hypot(
        Math.max(cx, window.innerWidth - cx),
        Math.max(cy, window.innerHeight - cy),
      );
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${cx}px ${cy}px)`,
            `circle(${radius}px at ${cx}px ${cy}px)`,
          ],
        },
        {
          duration: THEME_DUR,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      /* snapshot gagal — tema sudah diterapkan oleh apply(); abaikan */
    });
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Jalankan `fn` dan bersihkan otomatis semua animasi yang dibuat di dalamnya
 * saat komponen unmount / deps berubah. Ini mencegah kebocoran animasi saat
 * berpindah halaman.
 */
export function useGsap(fn: () => void, deps: unknown[] = [], _scope?: RefObject<HTMLElement | null>): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!motionOK) return;
    const anims: Animation[] = [];
    const prev = _sink;
    _sink = anims;
    try {
      fnRef.current();
    } finally {
      _sink = prev;
    }
    return () => {
      anims.forEach((a) => a.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Animasi masuk standar untuk satu halaman (dipasang di wrapper konten). */
export function usePageEnter(deps: unknown[] = []): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useGsap(() => {
    pageEnter(ref.current);
  }, deps);
  return ref;
}
