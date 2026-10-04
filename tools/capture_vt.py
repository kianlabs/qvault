"""Tangkap frame saat reveal lingkaran View Transition berjalan (headless).
Animasi asli 520ms terlalu cepat untuk ditangkap, jadi kita perlambat lewat
monkeypatch Element.animate (khusus pseudoElement view-transition) — hanya untuk
pengambilan bukti, bukan mengubah perilaku produksi."""
import asyncio
from playwright.async_api import async_playwright
from qvmock import open_dashboard

SLOW = r"""
() => {
  const orig = Element.prototype.animate;
  Element.prototype.animate = function(kf, opts) {
    if (opts && opts.pseudoElement) {
      opts = Object.assign({}, opts, {duration: 4000, easing: 'linear'});
    }
    return orig.call(this, kf, opts);
  };
}
"""

async def main():
    async with async_playwright() as p:
        browser, page, _ = await open_dashboard(p, width=1200, height=760)
        await page.evaluate(SLOW)
        await page.click("[data-theme-toggle]")
        for i in range(12):
            await page.wait_for_timeout(300)
            await page.screenshot(path=f"/tmp/vtc_{i:02d}.png")
        print("captured 12 frames -> /tmp/vtc_*.png")
        await browser.close()

asyncio.run(main())
