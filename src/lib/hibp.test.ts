import { afterEach, describe, expect, it, vi } from "vitest";
import { breachCount, breachCounts } from "./hibp";

// Catatan: `rangeCache` di hibp.ts bersifat module-level, jadi tiap test memakai
// password UNIK (bukan "password" bersama) agar tidak saling mem-cache.
const SHA1_PASSWORD = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";

/** SHA-1 huruf besar → untuk menghitung prefix/suffix target secara dinamis. */
async function sha1Upper(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Respons tiruan minimal yang dipakai `fetchRange`. */
function textResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("breachCount", () => {
  it("password kosong → 0 tanpa memanggil jaringan", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await breachCount("")).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("menemukan jumlah kemunculan dari respons range", async () => {
    const pw = "vec-count-1";
    const suffix = (await sha1Upper(pw)).slice(5);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => textResponse(`${suffix}:12345\r\n`)),
    );

    expect(await breachCount(pw)).toBe(12345);
  });

  it("k-anonymity: hanya prefix 5 karakter dikirim, plus Add-Padding", async () => {
    const pw = "vec-anon-1";
    const hash = await sha1Upper(pw);
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      textResponse(""),
    );
    vi.stubGlobal("fetch", fetchMock);

    await breachCount(pw);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
    );
    // Suffix penuh (sisa hash) TIDAK boleh bocor keluar perangkat.
    expect(url).not.toContain(hash.slice(5));
    expect(init.headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("vektor SHA-1 tetap cocok (kunci regresi hash)", async () => {
    expect(await sha1Upper("password")).toBe(SHA1_PASSWORD);
  });

  it("mengembalikan 0 bila suffix tidak ada di respons", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        textResponse("0000000000000000000000000000000000:5\r\n"),
      ),
    );

    expect(await breachCount("vec-miss-1")).toBe(0);
  });

  it("melempar bila respons HTTP tidak ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => textResponse("", false, 503)),
    );

    await expect(breachCount("vec-503-1")).rejects.toThrow(/503/);
  });

  it("cache: password sama hanya memicu satu fetch", async () => {
    const pw = "vec-cache-1";
    const suffix = (await sha1Upper(pw)).slice(5);
    const fetchMock = vi.fn(async () => textResponse(`${suffix}:9\r\n`));
    vi.stubGlobal("fetch", fetchMock);

    expect(await breachCount(pw)).toBe(9);
    expect(await breachCount(pw)).toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("breachCounts", () => {
  it("memisahkan item sukses (counts) dari item gagal (failed)", async () => {
    const ok = "vec-mix-ok";
    const okPrefix = (await sha1Upper(ok)).slice(0, 5);
    const okSuffix = (await sha1Upper(ok)).slice(5);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith(okPrefix)) {
          return textResponse(`${okSuffix}:7\r\n`);
        }
        throw new Error("network down");
      }),
    );

    const { counts, failed } = await breachCounts([ok, "vec-mix-bad"]);

    expect(counts.get(0)).toBe(7);
    expect(counts.has(1)).toBe(false);
    expect(failed).toEqual([1]);
  });

  it("melewati password kosong (tidak masuk counts/failed, tanpa fetch)", async () => {
    const pw = "vec-skip-1";
    const suffix = (await sha1Upper(pw)).slice(5);
    const fetchMock = vi.fn(async () => textResponse(`${suffix}:3\r\n`));
    vi.stubGlobal("fetch", fetchMock);

    const { counts, failed } = await breachCounts(["", pw, ""]);

    expect(failed).toEqual([]);
    expect([...counts.entries()]).toEqual([[1, 3]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("concurrency=1: fetch tidak pernah tumpang-tindih", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return textResponse("");
      }),
    );

    await breachCounts(["vec-c1", "vec-c2", "vec-c3"], 1);

    expect(maxInFlight).toBe(1);
  });

  it("concurrency=2: dua fetch benar-benar berjalan bersamaan", async () => {
    const gate = Promise.withResolvers<void>();
    const bothStarted = Promise.withResolvers<void>();
    let started = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        started += 1;
        if (started === 2) bothStarted.resolve();
        await gate.promise;
        inFlight -= 1;
        return textResponse("");
      }),
    );

    const run = breachCounts(["vec-p1", "vec-p2"], 2);
    await bothStarted.promise;
    gate.resolve();
    await run;

    expect(maxInFlight).toBe(2);
  });

  it("failed terurut naik", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("nope");
      }),
    );

    const { counts, failed } = await breachCounts(["vec-f1", "vec-f2", "vec-f3"], 1);

    expect(counts.size).toBe(0);
    expect(failed).toEqual([0, 1, 2]);
  });
});
