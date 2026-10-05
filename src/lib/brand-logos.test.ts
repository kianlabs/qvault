import { describe, expect, it } from "vitest";
import { brandForHost } from "./brand-logos";

describe("brandForHost", () => {
  it("mencocokkan domain persis", () => {
    expect(brandForHost("github.com")?.hex).toBe("#181717");
  });

  it("mengabaikan prefix www", () => {
    expect(brandForHost("www.github.com")?.hex).toBe("#181717");
  });

  it("mengabaikan huruf besar/kecil", () => {
    expect(brandForHost("GOOGLE.COM")?.hex).toBe(brandForHost("google.com")?.hex);
  });

  it("mencocokkan subdomain ke domain brand", () => {
    expect(brandForHost("accounts.google.com")?.hex).toBe(
      brandForHost("google.com")?.hex,
    );
    expect(brandForHost("mail.google.com")?.hex).toBe(
      brandForHost("gmail.com")?.hex,
    );
  });

  it("domain tak dikenal → null (fallback inisial)", () => {
    expect(brandForHost("contoh-tidak-dikenal.example")).toBeNull();
  });

  it("host kosong / null → null", () => {
    expect(brandForHost("")).toBeNull();
    expect(brandForHost(null)).toBeNull();
    expect(brandForHost(undefined)).toBeNull();
  });

  it("TIDAK cocok bila domain brand hanya sebagai prefix (anti spoof)", () => {
    expect(brandForHost("google.com.evil.com")).toBeNull();
  });

  it("memuat glyph SVG inline (tanpa jaringan)", () => {
    const b = brandForHost("shopee.co.id");
    expect(b).not.toBeNull();
    expect(b?.body).toContain("<path");
    expect(b?.body).not.toContain("http");
  });
});
