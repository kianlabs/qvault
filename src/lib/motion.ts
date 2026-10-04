// QVAULT — motion layer (Calm Precision).
//
// Prinsip: gerak harus *membantu*, bukan menghibur. Semua animasi hanya
// menyentuh `opacity` dan `transform` (GPU-friendly), durasinya pendek, dan
// otomatis dimatikan bila OS meminta reduced-motion. Tak ada animasi yang
// memblokir input pengguna.
//
// Implementasi memakai **Web Animations API (WAAPI) native** — bukan library
// eksternal. Ini menghapus ~27 KB (gzip) dependensi runtime, animasi berjalan
// di compositor thread (lebih ringan & mulus), dan bundel jadi lebih ramping.
// API yang diekspor tetap sama seperti sebelumnya agar pemanggil tak berubah.
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
const EASE_SMOOTH = "cubic-bezier(0.76, 0, 0.24, 1)"; // ≈ expo/quart in-out

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
      { duration: 360, easing: EASE_OUT, fill: "both" },
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
          fill: "both",
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
      { duration: 220, easing: EASE_OUT, fill: "both" },
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
      fill: "both",
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

/**
 * Transisi "slideshow" saat tema terang ⇄ gelap ditukar.
 *
 * Caranya: sebuah tirai (curtain) penuh-layar berisi warna kanvas tema LAMA
 * dipasang menutupi viewport, lalu digeser KELUAR ke kiri (translateX -100%)
 * sehingga tema BARU yang sudah terpasang di belakangnya terungkap seperti
 * lembaran yang di-slide. Konten ikut bergeser sedikit dari kanan (parallax)
 * supaya terasa seperti perpindahan slide yang tenang & halus.
 *
 * `fromBg` HARUS dibaca SEBELUM class tema di `<html>` ditukar.
 *
 * Gerak (slide) di-gate oleh reduced-motion; bila gerak dimatikan, tirai tetap
 * dipasang lalu langsung dibuang tanpa animasi (perpindahan tetap instan).
 * Tirai `pointer-events: none` sehingga tidak memblokir input.
 */
export function themeSwap(fromBg: string, content: Element | null): void {
  if (typeof document === "undefined") return;

  // Buang tirai lama bila pengguna menukar tema beruntun (hindari tumpukan).
  const prev = document.getElementById("qv-theme-veil");
  if (prev) {
    prev.getAnimations().forEach((a) => a.cancel());
    prev.remove();
  }

  const veil = document.createElement("div");
  veil.id = "qv-theme-veil";
  veil.setAttribute("aria-hidden", "true");
  veil.style.cssText =
    `position:fixed;inset:0;background:${fromBg};pointer-events:none;` +
    `z-index:9999;will-change:transform;backface-visibility:hidden;`;

  // Tepi depan tirai — garis aksen tipis agar "lembaran" yang bergeser terlihat.
  const edge = document.createElement("div");
  edge.style.cssText =
    "position:absolute;top:0;right:0;width:2px;height:100%;" +
    "background:linear-gradient(180deg,transparent,var(--accent),transparent);" +
    "opacity:0.45;";
  veil.appendChild(edge);
  document.body.appendChild(veil);

  // Reduced-motion: buang tirai seketika, tanpa gerak.
  // Cek dinamis saat pemanggilan (bukan nilai cache saat module-load) supaya
  // setelan OS yang berubah di tengah sesi tetap dihormati.
  if (prefersReducedMotion()) {
    veil.remove();
    return;
  }

  // Durasi sengaja dibuat lebih lambat & lembut supaya perpindahan terasa
  // tenang (bukan kedip). Konten menyusul dengan geser kecil + fade.
  const DUR_MS = 1000;
  const EASE = EASE_SMOOTH;

  const veilAnim = veil.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
    { duration: DUR_MS, easing: EASE, fill: "forwards" },
  );
  veilAnim.finished
    .then(() => veil.remove())
    .catch(() => veil.remove());
  _track(veilAnim);

  if (content) {
    _cancelOn(content);
    _track(
      content.animate(
        [
          { opacity: 0.7, transform: "translateX(3.5%)" },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: DUR_MS, easing: EASE, fill: "both" },
      ),
    );
  }
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
