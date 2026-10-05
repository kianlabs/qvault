import { describe, expect, it } from "vitest";
import { breachStatus } from "./breach-status";

// Regresi: bug "false safe" — UI pernah menampilkan "aman" padahal nol
// password benar-benar dicek (mis. semua item tanpa password tersimpan).
describe("breachStatus", () => {
  it("'breached' menang meski sebagian pemeriksaan gagal", () => {
    expect(breachStatus({ breached: 2, failed: 1, scanned: 5 })).toBe(
      "breached",
    );
  });

  it("'failed' bila tak ada temuan tapi ada pemeriksaan yang gagal", () => {
    expect(breachStatus({ breached: 0, failed: 3, scanned: 5 })).toBe("failed");
  });

  it("'empty' (BUKAN clean) bila tak satu pun password dicek", () => {
    expect(breachStatus({ breached: 0, failed: 0, scanned: 0 })).toBe("empty");
  });

  it("'clean' hanya bila semua password yang dicek bersih", () => {
    expect(breachStatus({ breached: 0, failed: 0, scanned: 4 })).toBe("clean");
  });

  it("kegagalan sebagian tanpa temuan tetap 'failed', bukan 'clean'", () => {
    expect(breachStatus({ breached: 0, failed: 1, scanned: 1 })).toBe("failed");
  });
});
