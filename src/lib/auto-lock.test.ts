import { describe, expect, it } from "vitest";
import {
  isAutoLockPaused,
  pauseAutoLock,
  resumeAutoLock,
  withAutoLockPaused,
} from "./auto-lock";

describe("auto-lock pause", () => {
  it("pause menahan lock, resume melepasnya", () => {
    expect(isAutoLockPaused()).toBe(false);
    pauseAutoLock();
    expect(isAutoLockPaused()).toBe(true);
    resumeAutoLock();
    expect(isAutoLockPaused()).toBe(false);
  });

  it("bersarang: baru lepas saat SEMUA resume dipanggil", () => {
    pauseAutoLock();
    pauseAutoLock();
    resumeAutoLock();
    expect(isAutoLockPaused()).toBe(true);
    resumeAutoLock();
    expect(isAutoLockPaused()).toBe(false);
  });

  it("resume berlebih tidak membuat hitungan negatif", () => {
    resumeAutoLock();
    expect(isAutoLockPaused()).toBe(false);
  });

  it("withAutoLockPaused melepas setelah sukses", async () => {
    const value = await withAutoLockPaused(async () => 42);
    expect(value).toBe(42);
    expect(isAutoLockPaused()).toBe(false);
  });

  it("withAutoLockPaused tetap melepas saat fungsi melempar", async () => {
    await expect(
      withAutoLockPaused(async () => {
        throw new Error("batal");
      }),
    ).rejects.toThrow("batal");
    expect(isAutoLockPaused()).toBe(false);
  });

  it("menahan lock SELAMA fungsi berjalan", async () => {
    let during = false;
    await withAutoLockPaused(async () => {
      during = isAutoLockPaused();
    });
    expect(during).toBe(true);
  });
});
