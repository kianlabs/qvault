import { describe, expect, it } from "vitest";
import { menuPosition, type Rect, type Size } from "./menu-position";

const VIEW: Size = { width: 1000, height: 800 };
const MENU: Size = { width: 160, height: 200 };

/** Trigger di tengah-atas viewport. */
const TRIGGER: Rect = { top: 100, bottom: 128, left: 500, right: 528 };

describe("menuPosition", () => {
  it("menempatkan menu DI BAWAH trigger + jeda 4px", () => {
    const p = menuPosition(TRIGGER, MENU, VIEW, "right");
    expect(p.top).toBe(132);
  });

  it("align kanan: tepi kanan menu = tepi kanan trigger", () => {
    const p = menuPosition(TRIGGER, MENU, VIEW, "right");
    expect(p.left).toBe(528 - 160);
  });

  it("align kiri: tepi kiri menu = tepi kiri trigger", () => {
    const p = menuPosition(TRIGGER, MENU, VIEW, "left");
    expect(p.left).toBe(500);
  });

  it("flip ke ATAS bila tidak muat di bawah", () => {
    const low: Rect = { top: 700, bottom: 728, left: 500, right: 528 };
    const p = menuPosition(low, MENU, VIEW, "right");
    expect(p.top).toBe(700 - 4 - 200);
  });

  it("jepit ke dalam viewport di kanan (tidak terpotong)", () => {
    const right: Rect = { top: 100, bottom: 128, left: 992, right: 1020 };
    const p = menuPosition(right, MENU, VIEW, "right");
    expect(p.left).toBe(1000 - 160 - 4);
    expect(p.left + MENU.width).toBeLessThanOrEqual(VIEW.width);
  });

  it("jepit ke dalam viewport di kiri", () => {
    const left: Rect = { top: 100, bottom: 128, left: 0, right: 28 };
    const p = menuPosition(left, MENU, VIEW, "right");
    expect(p.left).toBe(4);
  });

  it("selalu dalam batas viewport (properti)", () => {
    for (const top of [0, 50, 400, 790]) {
      for (const left of [0, 20, 500, 990]) {
        const p = menuPosition(
          { top, bottom: top + 28, left, right: left + 28 },
          MENU,
          VIEW,
          "right",
        );
        expect(p.top).toBeGreaterThanOrEqual(0);
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.top + MENU.height).toBeLessThanOrEqual(VIEW.height);
        expect(p.left + MENU.width).toBeLessThanOrEqual(VIEW.width);
      }
    }
  });
});
