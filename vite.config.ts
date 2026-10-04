import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // WebView2/WKWebView modern: aman target ES2021, hindari transpile berlebih.
    target: "es2021",
    // Matikan sourcemap di produksi (bundel lebih ramping; debug via dev).
    sourcemap: false,
    // Peringatan chunk besar dinaikkan — kita memang memisah vendor.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Pisahkan vendor besar agar cache jangka panjang & muat paralel.
        // (Vite 8/rolldown memakai bentuk fungsi.)
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("gsap")) return "motion";
            if (
              id.includes("react-dom") ||
              id.includes("react-router") ||
              id.includes("/react/")
            ) {
              return "react";
            }
          }
          return undefined;
        },
      },
    },
  },
}));
