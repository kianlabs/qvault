// QVAULT — Update proxy (Cloudflare Worker).
//
// Tujuan: repo qvault PRIVAT, jadi app TIDAK bisa mengambil release langsung
// dari GitHub. Worker ini memegang token GitHub (rahasia) lalu menyajikan:
//   GET /updates/latest.json          -> isi asset "latest.json" rilis terbaru
//   GET /updates/download/<nama>      -> stream asset AppImage dari rilis
//   GET /health                       -> cek hidup
//
// Token TIDAK pernah sampai ke klien. Endpoint publik hanya menyalurkan
// metadata update + binary bertanda tangan (signature diverifikasi di app).

const LATEST_ASSET = "latest.json";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { GH_OWNER, GH_REPO, GH_TOKEN } = env;
    if (!GH_OWNER || !GH_REPO || !GH_TOKEN) {
      return json({ error: "Worker belum dikonfigurasi (GH_OWNER/GH_REPO/GH_TOKEN)." }, 500);
    }

    const api = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;
    const ghHeaders = {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "qvault-updater-worker",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/updates/latest.json") {
      const release = await latestRelease(api, ghHeaders);
      if (!release) return json({ error: "Belum ada rilis." }, 502);
      const asset = findAsset(release, LATEST_ASSET);
      if (!asset) return json({ error: "Asset latest.json tidak ada di rilis." }, 404);
      const body = await fetchAsset(asset, ghHeaders);
      if (!body) return json({ error: "Gagal mengambil latest.json." }, 502);
      return new Response(body, {
        headers: {
          "content-type": "application/json",
          // Cache singkat supaya rilis baru cepat terlihat.
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (url.pathname.startsWith("/updates/download/")) {
      const name = decodeURIComponent(url.pathname.slice("/updates/download/".length));
      const release = await latestRelease(api, ghHeaders);
      if (!release) return json({ error: "Belum ada rilis." }, 502);
      const asset = findAsset(release, name);
      if (!asset) return json({ error: `Asset ${name} tidak ditemukan.` }, 404);
      const body = await fetchAsset(asset, ghHeaders);
      if (!body) return json({ error: "Gagal mengambil asset." }, 502);
      return new Response(body, {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(asset.size),
          "content-disposition": `attachment; filename="${name}"`,
        },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};

async function latestRelease(api, headers) {
  const res = await fetch(`${api}/releases/latest`, { headers });
  if (!res.ok) return null;
  return res.json();
}

function findAsset(release, name) {
  return (release.assets || []).find((a) => a.name === name) || null;
}

async function fetchAsset(asset, headers) {
  const res = await fetch(asset.url, {
    headers: { ...headers, Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return res.body;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
