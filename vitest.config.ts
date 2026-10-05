import { defineConfig } from "vitest/config";

// Test logika murni (tanpa DOM) — tidak memuat plugin React/Tailwind agar
// cepat dan tidak butuh jsdom. Komponen UI tetap dijaga oleh `tsc` + build.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
