import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeCron, isCronAuthorized } from "@/lib/cron-auth";

vi.mock("@/lib/config", () => ({
  getConfig: () => ({ cronSecret: "test-secret" }),
}));

describe("cron auth", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a matching Bearer token", () => {
    const request = new Request("http://localhost/api/cron/weather", {
      headers: { Authorization: "Bearer test-secret" },
    });

    expect(isCronAuthorized(request)).toBe(true);
    expect(authorizeCron(request)).toBeNull();
  });

  it("rejects missing or invalid auth", () => {
    const missing = new Request("http://localhost/api/cron/weather");
    const wrongBearer = new Request("http://localhost/api/cron/weather", {
      headers: { Authorization: "Bearer wrong" },
    });
    const spoofedCronHeader = new Request("http://localhost/api/cron/weather", {
      headers: { "x-vercel-cron": "1" },
    });

    expect(isCronAuthorized(missing)).toBe(false);
    expect(isCronAuthorized(wrongBearer)).toBe(false);
    expect(isCronAuthorized(spoofedCronHeader)).toBe(false);

    expect(authorizeCron(spoofedCronHeader)?.status).toBe(401);
  });
});
