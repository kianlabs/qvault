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
 * Transisi halus saat tema terang ⇄ gelap ditukar.
 *
 * Caranya: tutup seluruh viewport dengan warna kanvas tema LAMA (`fromBg`),
 * lalu memudarkannya (fade-out) sehingga tema BARU yang sudah terpasang di
 * belakangnya terungkap mulus — efek cross-fade satu layar penuh. Ini membuat
 * perpindahan terang↔gelap terlihat jelas (bukan sekadar "kedip").
 *
 * Penting: `fromBg` HARUS dibaca SEBELUM class tema di `<html>` ditukar, kalau
 * tidak warna veil akan sama dengan latar baru dan animasinya tak terlihat.
 *
 * Fade opacity tetap dijalankan walau OS meminta reduced-motion (opacity aman;
 * yang dihindari adalah gerak/scale) — hanya efek `scale` konten yang di-gate.
 * Veil `pointer-events: none` sehingga tidak memblokir input.
 */
export function themeSwap(fromBg: string, content: Element | null): void {
  if (typeof document === "undefined") return;

  // Buang veil lama bila pengguna menukar tema beruntun (hindari tumpukan).
  const prev = document.getElementById("qv-theme-veil");
  if (prev) {
    gsap.killTweensOf(prev);
    prev.remove();
  }

  const veil = document.createElement("div");
  veil.id = "qv-theme-veil";
  veil.setAttribute("aria-hidden", "true");
  veil.style.cssText =
    `position:fixed;inset:0;background:${fromBg};pointer-events:none;z-index:9999;`;
  document.body.appendChild(veil);

  // Mulai dari opaque penuh (sinkron, sebelum paint) agar tak ada kedip tema baru.
  gsap.set(veil, { autoAlpha: 1 });
  gsap.to(veil, {
    autoAlpha: 0,
    duration: 0.45,
    ease: "power2.inOut",
    onComplete: () => veil.remove(),
  });

  // Konten "mendarat" lembut — hanya bila gerak diizinkan.
  if (content && motionOK) {
    gsap.fromTo(
      content,
      { scale: 0.988 },
      { scale: 1, duration: 0.45, ease: "power2.out", clearProps: "transform" },
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
