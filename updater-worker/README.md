# QVAULT — Update Worker

Proxy Cloudflare Worker yang menyajikan update QVAULT dari repo **privat**.

## Kenapa perlu?

Repo `kianlabs/qvault` privat, sehingga app yang terpasang tidak bisa mengunduh
aset rilis langsung dari GitHub. Worker ini memegang token GitHub (rahasia) dan
menyajikan:

| Endpoint | Fungsi |
| --- | --- |
| `GET /updates/latest.json` | Metadata rilis terbaru (dipakai updater Tauri) |
| `GET /updates/download/<nama>` | Stream aset AppImage |
| `GET /health` | Cek hidup |

Token GitHub **tidak pernah** sampai ke klien.

## Deploy

```bash
cd updater-worker
bunx wrangler login                       # sekali saja
bunx wrangler secret put GH_TOKEN         # tempel GitHub token (repo:read cukup)
bunx wrangler deploy
```

Setelah deploy, URL worker (mis. `https://qvault-updates.ridzkyan0504.workers.dev`)
harus sama dengan `endpoints` di `src-tauri/tauri.conf.json` dan `WORKER_BASE`
di `.github/workflows/release.yml`.

## Alur

1. Push tag `vX.Y.Z` → workflow Release membangun AppImage bertanda tangan.
2. Workflow membuat `latest.json` (URL menunjuk ke worker) dan mempublikasikan
   GitHub Release (privat).
3. Worker menyajikan `latest.json` + AppImage ke app.
4. App memverifikasi signature dengan public key di `tauri.conf.json`.
