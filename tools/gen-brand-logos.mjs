// Generator sekali-jalan untuk src/lib/brand-logos-data.ts.
//
// Sumber ikon: set Iconify "simple-icons" (glyph persegi 24x24, CC0) — versi
// ini masih memuat brand yang sudah ditarik dari paket npm simple-icons@15
// (Microsoft, Amazon, Adobe, LinkedIn, X, Shopee, Gojek, Grab, ...).
// Warna brand: paket npm simple-icons@15 (field `hex`) + override manual.
//
// Output dibundel ke dalam app (offline). Regenerate: bun tools/gen-brand-logos.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Unduh sekali ke cache lokal, lalu pakai ulang (idempotent, tanpa jaringan
// bila cache sudah ada).
const CACHE = "/tmp/qvault-brand-cache";
const SOURCES = {
  "si-iconify.json":
    "https://cdn.jsdelivr.net/npm/@iconify-json/simple-icons@1/icons.json",
  "si.json": "https://cdn.jsdelivr.net/npm/simple-icons@15/data/simple-icons.json",
};
if (!existsSync(CACHE)) {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(CACHE, { recursive: true });
}
for (const [file, url] of Object.entries(SOURCES)) {
  const path = `${CACHE}/${file}`;
  if (existsSync(path)) continue;
  console.log(`mengunduh ${file} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  writeFileSync(path, await res.text());
}

// slug -> daftar domain yang memakainya
const BRANDS = {
  github: ["github.com", "github.io"],
  gitlab: ["gitlab.com"],
  bitbucket: ["bitbucket.org"],
  stackoverflow: ["stackoverflow.com"],
  npm: ["npmjs.com"],
  docker: ["docker.com", "hub.docker.com"],
  microsoft: [
    "microsoft.com",
    "live.com",
    "office.com",
    "microsoftonline.com",
    "outlook.com",
    "outlook.office.com",
  ],
  apple: ["apple.com", "icloud.com"],
  amazon: ["amazon.com"],
  google: ["google.com", "google.co.id", "googleapis.com"],
  gmail: ["gmail.com", "mail.google.com"],
  googledrive: ["drive.google.com"],
  youtube: ["youtube.com", "youtu.be"],
  facebook: ["facebook.com"],
  instagram: ["instagram.com"],
  whatsapp: ["whatsapp.com", "web.whatsapp.com"],
  messenger: ["messenger.com"],
  threads: ["threads.net"],
  x: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com"],
  discord: ["discord.com"],
  slack: ["slack.com"],
  telegram: ["telegram.org", "t.me"],
  reddit: ["reddit.com"],
  netflix: ["netflix.com"],
  spotify: ["spotify.com"],
  twitch: ["twitch.tv"],
  tiktok: ["tiktok.com"],
  snapchat: ["snapchat.com"],
  pinterest: ["pinterest.com"],
  medium: ["medium.com"],
  quora: ["quora.com"],
  wikipedia: ["wikipedia.org"],
  dropbox: ["dropbox.com"],
  paypal: ["paypal.com"],
  stripe: ["stripe.com"],
  wise: ["wise.com"],
  revolut: ["revolut.com"],
  coinbase: ["coinbase.com"],
  binance: ["binance.com"],
  steam: ["steampowered.com", "store.steampowered.com"],
  epicgames: ["epicgames.com"],
  cloudflare: ["cloudflare.com"],
  digitalocean: ["digitalocean.com"],
  heroku: ["heroku.com"],
  vercel: ["vercel.com"],
  netlify: ["netlify.com"],
  figma: ["figma.com"],
  notion: ["notion.so"],
  trello: ["trello.com"],
  asana: ["asana.com"],
  zoom: ["zoom.us"],
  atlassian: ["atlassian.com"],
  shopify: ["shopify.com"],
  wordpress: ["wordpress.com"],
  godaddy: ["godaddy.com"],
  namecheap: ["namecheap.com"],
  adobe: ["adobe.com"],
  oracle: ["oracle.com"],
  ibm: ["ibm.com"],
  salesforce: ["salesforce.com"],
  sap: ["sap.com"],
  ebay: ["ebay.com"],
  aliexpress: ["aliexpress.com"],
  alibabadotcom: ["alibaba.com"],
  airbnb: ["airbnb.com"],
  bookingdotcom: ["booking.com"],
  uber: ["uber.com"],
  lyft: ["lyft.com"],
  protonmail: ["protonmail.com", "proton.me"],
  bitwarden: ["bitwarden.com"],
  "1password": ["1password.com"],
  lastpass: ["lastpass.com"],
  dashlane: ["dashlane.com"],
  nordvpn: ["nordvpn.com"],
  mozilla: ["mozilla.org"],
  brave: ["brave.com"],
  mongodb: ["mongodb.com"],
  postgresql: ["postgresql.org"],
  mysql: ["mysql.com"],
  redis: ["redis.io"],
  udemy: ["udemy.com"],
  coursera: ["coursera.org"],
  duolingo: ["duolingo.com"],
  leetcode: ["leetcode.com"],
  hackerrank: ["hackerrank.com"],
  mastodon: ["mastodon.social"],
  bluesky: ["bsky.app", "bsky.social"],
  shopee: ["shopee.co.id", "shopee.com", "shopee.co.th"],
  gojek: ["gojek.com"],
  grab: ["grab.com"],
  bukalapak: ["bukalapak.com"],
  blibli: ["blibli.com"],
  xendit: ["xendit.co"],
};

// Brand tanpa `hex` di simple-icons@15 (ditarik karena alasan merek).
const HEX_OVERRIDE = {
  microsoft: "#5E5E5E",
  amazon: "#FF9900",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
  adobe: "#FF0000",
  oracle: "#F80000",
  ibm: "#052FAD",
};

const si = JSON.parse(readFileSync(`${CACHE}/si-iconify.json`, "utf8")).icons;
const npmData = JSON.parse(readFileSync(`${CACHE}/si.json`, "utf8"));
const npmHex = {};
for (const it of npmData.icons ?? npmData) {
  if (it?.slug && it.hex) npmHex[it.slug] = `#${it.hex}`;
}

const icons = {};
const domains = {};
const missing = [];

for (const [slug, domainList] of Object.entries(BRANDS)) {
  const glyph = si[slug];
  if (!glyph) {
    missing.push(slug);
    continue;
  }
  const hex = HEX_OVERRIDE[slug] ?? npmHex[slug];
  if (!hex) {
    missing.push(`${slug} (tanpa warna)`);
    continue;
  }
  icons[slug] = {
    hex,
    width: glyph.width ?? 24,
    height: glyph.height ?? 24,
    body: glyph.body.replace(/\s+/g, " ").trim(),
  };
  for (const d of domainList) domains[d] = slug;
}

const out = `// QVAULT — logo perusahaan (GENERATED, jangan diedit manual).
//
// Sumber: set Iconify "simple-icons" (glyph persegi 24x24, lisensi CC0) +
// warna brand dari paket npm simple-icons@15. Semua data dibundel ke dalam app
// sebagai string SVG inline — TIDAK ada permintaan jaringan saat runtime,
// konsisten dengan janji "local-first · tanpa telemetri".
//
// Regenerate: bun tools/gen-brand-logos.mjs
export interface BrandLogo {
  /** Warna brand (hex). */
  hex: string;
  width: number;
  height: number;
  /** Isi <svg> (path dengan fill="currentColor"). */
  body: string;
}

export const BRAND_ICONS: Record<string, BrandLogo> = ${JSON.stringify(icons, null, 2)};

/** domain (lowercase, tanpa www) -> slug brand. */
export const BRAND_DOMAINS: Record<string, string> = ${JSON.stringify(domains, null, 2)};
`;

writeFileSync("src/lib/brand-logos-data.ts", out);
console.log(`OK ${Object.keys(icons).length} brand, ${Object.keys(domains).length} domain`);
console.log("gagal:", missing.join(", ") || "-");
