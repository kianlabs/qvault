// QVAULT — Hasilkan latest.json untuk rilis updater.
//
// Dipakai di CI (workflow Release). Membaca versi dari tauri.conf.json, lalu
// mengambil signature AppImage yang baru dibangun, dan menulis latest.json
// dengan URL yang menunjuk ke WORKER PROXY (bukan GitHub), karena repo privat
// tidak bisa diunduh langsung oleh app.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WORKER_BASE =
  process.env.WORKER_BASE || "https://qvault-updates.kianlabs.workers.dev";

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const version = conf.version;

const appimageDir = "src-tauri/target/release/bundle/appimage";
const appimage = readdirSync(appimageDir).find((f) => f.endsWith(".AppImage"));
if (!appimage) {
  throw new Error(`AppImage tidak ditemukan di ${appimageDir}`);
}
const signature = readFileSync(join(appimageDir, `${appimage}.sig`), "utf8").trim();

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES || `QVAULT ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "linux-x86_64": {
      signature,
      url: `${WORKER_BASE}/updates/download/${appimage}`,
    },
  },
};

writeFileSync("latest.json", JSON.stringify(manifest, null, 2));
console.log(`latest.json untuk versi ${version}:\n${JSON.stringify(manifest, null, 2)}`);
