import { describe, expect, it } from "vitest";
import { mergeBlocksTotp, mergeNotes } from "./vault-merge";

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

// Regresi: merge pernah hanya menyimpan catatan PERTAMA non-kosong, sehingga
// catatan pada item duplikat ke-3+ hilang diam-diam saat item dihapus.
describe("mergeNotes", () => {
  it("menggabungkan semua catatan unik non-kosong", () => {
    expect(
      mergeNotes([
        { notes: "catatan A" },
        { notes: "catatan B" },
        { notes: "catatan C" },
      ]),
    ).toBe("catatan A\n\ncatatan B\n\ncatatan C");
  });

  it("melewati catatan kosong & spasi", () => {
    expect(mergeNotes([{ notes: "" }, { notes: "  " }, { notes: "isi" }])).toBe(
      "isi",
    );
  });

  it("mendeduplikasi catatan identik", () => {
    expect(
      mergeNotes([{ notes: "sama" }, { notes: "sama" }, { notes: "beda" }]),
    ).toBe("sama\n\nbeda");
  });

  it("memangkas spasi pinggir tiap catatan", () => {
    expect(mergeNotes([{ notes: "  rapi  " }])).toBe("rapi");
  });

  it("semua kosong → string kosong", () => {
    expect(mergeNotes([{ notes: "" }, { notes: "" }])).toBe("");
  });
});
