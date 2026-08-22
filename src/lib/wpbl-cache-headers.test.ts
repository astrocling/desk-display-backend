import { describe, expect, it } from "vitest";

import {
  jsonWithCache,
  WPBL_API_CACHE_CONTROL,
  WPBL_LIVE_API_CACHE_CONTROL,
} from "./wpbl-cache-headers";

describe("wpbl-cache-headers", () => {
  it("sets Cache-Control on JSON responses", async () => {
    const res = jsonWithCache({ ok: true }, WPBL_API_CACHE_CONTROL);
    expect(res.headers.get("Cache-Control")).toBe(WPBL_API_CACHE_CONTROL);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("uses a shorter TTL for live payloads", () => {
    expect(WPBL_LIVE_API_CACHE_CONTROL).toContain("s-maxage=5");
  });
});
