"""
Harness headless untuk QVAULT (Playwright).
Mock __TAURI_INTERNALS__ supaya app masuk ke dashboard, lalu ukur:
  1. jank scroll (frame timing via requestAnimationFrame)
  2. transisi tema: apakah View Transition dipakai + durasi/clip animasinya
  3. jank scroll SETELAH ganti tema (deteksi layer komposit tertinggal)

Pakai: python tools/harness.py [chromium|webkit]
WebKit dipakai untuk mendekati engine webview Tauri (WebKitGTK).
"""
import asyncio, json, sys
from playwright.async_api import async_playwright
from qvmock import open_dashboard

SCROLL_JS = r"""
() => new Promise((resolve) => {
  const main = document.querySelector('main');
  if (!main) { resolve({error:'no main'}); return; }
  const frames = []; let last = performance.now(); let raf;
  const step = () => {
    const t = performance.now(); frames.push(t-last); last=t;
    if (frames.length < 200) raf = requestAnimationFrame(step); else finish();
  };
  let s=0; const sc=setInterval(()=>{ s+=40; main.scrollTop=s; if(s>1400) clearInterval(sc); },16);
  const finish = () => {
    cancelAnimationFrame(raf); clearInterval(sc);
    const sorted=[...frames].sort((a,b)=>a-b);
    const p=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))];
    const long=frames.filter(f=>f>33).length;
    resolve({n:frames.length, avg:+(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(2),
      p50:+p(0.5).toFixed(2), p95:+p(0.95).toFixed(2), p99:+p(0.99).toFixed(2),
      max:+sorted[sorted.length-1].toFixed(2), longFrames:long,
      longPct:+(100*long/frames.length).toFixed(1)});
  };
  raf = requestAnimationFrame(step);
})
"""

async def install_vt_probe(page):
    await page.evaluate(r"""
    () => {
      window.__vt = {started:0, applied:0, anims:[],
        hasVT: typeof document.startViewTransition==='function'};
      const origVT = document.startViewTransition;
      if (origVT) {
        document.startViewTransition = function(cb) {
          window.__vt.started++;
          return origVT.call(document, () => { window.__vt.applied++; return cb(); });
        };
      }
      const origAnim = Element.prototype.animate;
      Element.prototype.animate = function(kf, opts) {
        const a = origAnim.call(this, kf, opts);
        window.__vt.anims.push({dur:(opts&&opts.duration)||0,
          pseudo:(opts&&opts.pseudoElement)||null, clip: !!(kf && kf.clipPath)});
        return a;
      };
    }
    """)

async def main():
    engine = sys.argv[1] if len(sys.argv) > 1 else "chromium"
    async with async_playwright() as p:
        browser, page, errors = await open_dashboard(p, browser_type=engine)

        screen = await page.evaluate("() => ({hasMain:!!document.querySelector('main'), hasSidebar:!!document.querySelector('aside')})")
        print(f"=== SCREEN ({engine}) ==="); print(json.dumps(screen))
        if not screen["hasMain"]:
            print("!! tidak masuk dashboard"); print("errors:", errors[:5]); await browser.close(); return

        print("\n=== SCROLL JANK (sebelum ganti tema) ===")
        print(json.dumps(await page.evaluate(SCROLL_JS)))

        await install_vt_probe(page)
        await page.click("[data-theme-toggle]")
        await page.wait_for_timeout(1500)
        vt = await page.evaluate("() => window.__vt")
        print("\n=== THEME TRANSITION ===")
        print(json.dumps({k:vt[k] for k in ('hasVT','started','applied','anims')}, indent=2))
        print("tema sekarang:", await page.evaluate("() => document.documentElement.className"))

        print("\n=== SCROLL JANK (setelah ganti tema) ===")
        print(json.dumps(await page.evaluate(SCROLL_JS)))

        # Animasi tertinggal (penyebab layer komposit / jank scroll)
        await page.wait_for_timeout(800)
        leftover = await page.evaluate("() => document.getAnimations().length")
        print("\nanimasi masih hidup setelah idle:", leftover)

        if errors:
            print("\n=== ERRORS ==="); print("\n".join(errors[:8]))
        await browser.close()

asyncio.run(main())
