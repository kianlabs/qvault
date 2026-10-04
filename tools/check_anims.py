"""Uji: apakah animasi stagger tertinggal (layer komposit) setelah dashboard
diam? Layer tertinggal = penyebab utama scroll tersendat di WebKitGTK."""
import asyncio, json
from playwright.async_api import async_playwright
from qvmock import open_dashboard

COUNT_JS = r"""
() => {
  const all = document.getAnimations();
  const running = all.filter(a => a.playState === 'running');
  const persisted = all.filter(a => a.playState === 'finished' && a.effect &&
     (a.effect.fill === 'both' || a.effect.fill === 'forwards'));
  return {
    total: all.length, running: running.length,
    finishedButFilling: persisted.length,
    sample: all.slice(0,6).map(a => ({state:a.playState, fill: a.effect && a.effect.fill,
      dur: a.effect && a.effect.getTiming && a.effect.getTiming().duration})),
  };
}
"""

async def main():
    async with async_playwright() as p:
        browser, page, _ = await open_dashboard(p)
        # tunggu animasi masuk selesai (stagger terpanjang ~ 0.28 + 8*0.035 = 0.56s)
        await page.wait_for_timeout(2500)
        print("=== ANIMASI TERTINGGAL setelah dashboard diam ===")
        print(json.dumps(await page.evaluate(COUNT_JS), indent=2))
        await browser.close()

asyncio.run(main())
