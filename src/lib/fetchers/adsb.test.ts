import { describe, expect, it, vi } from "vitest";
import {
  ADSB_UPSTREAMS,
  fetchAdsbNearby,
  normalizeAdsbPayload,
  type AdsbUpstream,
} from "./adsb";

describe("normalizeAdsbPayload", () => {
  it("keeps adsb.lol ac array", () => {
    const out = normalizeAdsbPayload({
      ac: [{ hex: "abc" }],
      now: 1,
      msg: "ok",
    });
    expect(out.ac).toEqual([{ hex: "abc" }]);
    expect(out.now).toBe(1);
    expect(out.msg).toBe("ok");
    expect(out.total).toBe(1);
  });

  it("maps adsb.fi aircraft to ac", () => {
    const out = normalizeAdsbPayload({
      aircraft: [{ hex: "def" }, { hex: "ghi" }],
      now: 2,
      resultCount: 2,
    });
    expect(out.ac).toHaveLength(2);
    expect(out.ac[0]).toEqual({ hex: "def" });
    expect(out.total).toBe(2);
    expect("aircraft" in out).toBe(false);
  });

  it("returns empty ac for garbage", () => {
    expect(normalizeAdsbPayload(null).ac).toEqual([]);
    expect(normalizeAdsbPayload("x").ac).toEqual([]);
    expect(normalizeAdsbPayload({}).ac).toEqual([]);
  });
});

describe("fetchAdsbNearby", () => {
  const upstreams: AdsbUpstream[] = [
    {
      name: "primary",
      buildUrl: (lat, lon, dist) =>
        `https://primary.test/${lat}/${lon}/${dist}`,
    },
    {
      name: "fallback",
      buildUrl: (lat, lon, dist) =>
        `https://fallback.test/${lat}/${lon}/${dist}`,
    },
  ];

  it("returns primary when healthy", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("primary.test");
      return new Response(JSON.stringify({ ac: [{ hex: "a1" }], now: 9 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await fetchAdsbNearby(39.9, -84.2, 25, upstreams, fetchImpl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.upstream).toBe("primary");
    expect(JSON.parse(result.body).ac).toEqual([{ hex: "a1" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back when primary returns 502", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("primary")) {
        return new Response("bad gateway", { status: 502 });
      }
      return new Response(
        JSON.stringify({ aircraft: [{ hex: "b2" }], now: 3 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const result = await fetchAdsbNearby(39.9, -84.2, 25, upstreams, fetchImpl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.upstream).toBe("fallback");
    expect(JSON.parse(result.body)).toMatchObject({
      ac: [{ hex: "b2" }],
      total: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back when primary times out / throws", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("primary")) {
        throw new Error("aborted");
      }
      return new Response(JSON.stringify({ ac: [{ hex: "c3" }] }), {
        status: 200,
      });
    });

    const result = await fetchAdsbNearby(1, 2, 10, upstreams, fetchImpl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.upstream).toBe("fallback");
  });

  it("returns error when every upstream fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    const result = await fetchAdsbNearby(1, 2, 10, upstreams, fetchImpl);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
    expect(result.upstream).toBe("fallback");
  });

  it("exposes the default upstream list (lol then fi)", () => {
    expect(ADSB_UPSTREAMS.map((u) => u.name)).toEqual(["adsb.lol", "adsb.fi"]);
  });
});
