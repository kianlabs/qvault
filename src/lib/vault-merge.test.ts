import { describe, expect, it } from "vitest";
import { mergeBlocksTotp } from "./vault-merge";

// Regresi: merge duplikat pernah bisa menghapus secret 2FA diam-diam karena
// hanya TOTP milik item primary yang bertahan.
describe("mergeBlocksTotp", () => {
  it("blokir bila anggota non-primary punya TOTP", () => {
    expect(
      mergeBlocksTotp([
        { hasTotp: false },
        { hasTotp: true },
        { hasTotp: false },
      ]),
    ).toBe(true);
  });

  it("blokir bila SEMUA anggota (termasuk primary) punya TOTP", () => {
    expect(mergeBlocksTotp([{ hasTotp: true }, { hasTotp: true }])).toBe(true);
  });

  it("izinkan bila hanya primary yang punya TOTP", () => {
    expect(mergeBlocksTotp([{ hasTotp: true }, { hasTotp: false }])).toBe(
      false,
    );
  });

  it("izinkan bila tak ada TOTP sama sekali", () => {
    expect(mergeBlocksTotp([{ hasTotp: false }, { hasTotp: false }])).toBe(
      false,
    );
  });

  it("grup satu item tidak pernah diblokir", () => {
    expect(mergeBlocksTotp([{ hasTotp: true }])).toBe(false);
  });
});
