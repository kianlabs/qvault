// QVAULT — GSAP motion layer (Calm Precision).
//
// Prinsip: gerak harus *membantu*, bukan menghibur. Semua animasi hanya
// menyentuh `opacity` dan `transform` (GPU-friendly), durasinya pendek, dan
// otomatis dimatikan bila OS meminta reduced-motion. Tak ada animasi yang
// memblokir input pengguna.
import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";

/** Hormati setelan aksesibilitas OS. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Apakah GSAP boleh menganimasikan? (sekali cek, dipakai berulang) */
export const motionOK = !prefersReducedMotion();

// ---------------------------------------------------------------------------
// Timeline yang dipakai berulang
// ---------------------------------------------------------------------------

/** Halaman masuk: konten naik halus + fade. */
export function pageEnter(el: Element | null): void {
  if (!el || !motionOK) return;
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out", clearProps: "transform" },
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
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: opts.y ?? 8 },
    {
      autoAlpha: 1,
      y: 0,
      duration: opts.duration ?? 0.28,
      stagger: opts.stagger ?? 0.035,
      delay: opts.delay ?? 0,
      ease: "power2.out",
      clearProps: "transform",
    },
  );
}

/** Kartu/panel muncul dengan sedikit skala — untuk modal & popover. */
export function popIn(el: Element | null): void {
  if (!el || !motionOK) return;
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 6, scale: 0.985 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out", clearProps: "transform" },
  );
}

/** Umpan balik singkat saat nilai berubah (mis. skor, saldo). */
export function pulse(el: Element | null): void {
  if (!el || !motionOK) return;
  gsap.fromTo(
    el,
    { scale: 1 },
    { scale: 1.03, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut", clearProps: "transform" },
  );
}

/**
 * Transisi "slideshow" saat tema terang ⇄ gelap ditukar.
 *
 * Caranya: sebuah tirai (curtain) penuh-layar berisi warna kanvas tema LAMA
 * dipasang menutupi viewport, lalu digeser KELUAR ke kiri (translateX -100%)
 * sehingga tema BARU yang sudah terpasang di belakangnya terungkap seperti
 * lembaran yang di-slide. Konten ikut bergeser sedikit dari kanan (parallax)
 * supaya terasa seperti perpindahan slide, bukan sekadar fade.
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
    gsap.killTweensOf(prev);
    prev.remove();
  }

  const veil = document.createElement("div");
  veil.id = "qv-theme-veil";
  veil.setAttribute("aria-hidden", "true");
  veil.style.cssText =
    `position:fixed;inset:0;background:${fromBg};pointer-events:none;` +
    `z-index:9999;will-change:transform;`;

  // Tepi depan tirai — garis aksen tipis agar "lembaran" yang bergeser terlihat.
  const edge = document.createElement("div");
  edge.style.cssText =
    "position:absolute;top:0;right:0;width:2px;height:100%;" +
    "background:linear-gradient(180deg,transparent,var(--accent),transparent);" +
    "opacity:0.5;";
  veil.appendChild(edge);
  document.body.appendChild(veil);

  const DUR = 0.6;
  const EASE = "power3.inOut";

  // Reduced-motion: buang tirai seketika, tanpa gerak.
  // Cek dinamis saat pemanggilan (bukan nilai cache saat module-load) supaya
  // setelan OS yang berubah di tengah sesi tetap dihormati.
  if (prefersReducedMotion()) {
    veil.remove();
    return;
  }

  const tl = gsap.timeline({ onComplete: () => veil.remove() });

  // Tirai lama menggeser keluar ke kiri — mengungkap tema baru di belakangnya.
  tl.to(veil, { xPercent: -100, duration: DUR, ease: EASE }, 0);

  // Konten menyusul dari kanan (parallax) → terasa seperti slide show.
  if (content) {
    tl.fromTo(
      content,
      { xPercent: 6, autoAlpha: 0.55 },
      {
        xPercent: 0,
        autoAlpha: 1,
        duration: DUR,
        ease: EASE,
        clearProps: "transform,opacity,visibility",
      },
      0,
    );
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Jalankan `fn` di dalam gsap.context() agar semua tween yang dibuat di
 * dalamnya otomatis dibersihkan saat komponen unmount / deps berubah.
 * Ini mencegah kebocoran animasi saat berpindah halaman.
 *
 * Catatan: `fn` sengaja TIDAK menerima context — memakai variabel `ctx` di
 * dalam callback gsap.context() menyebabkan TDZ error karena callback dijalankan
 * sinkron sebelum `const ctx` selesai diinisialisasi.
 */
export function useGsap(fn: () => void, deps: unknown[] = [], scope?: RefObject<HTMLElement | null>): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!motionOK) return;
    const ctx = gsap.context(() => fnRef.current(), scope?.current ?? undefined);
    return () => ctx.revert();
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
