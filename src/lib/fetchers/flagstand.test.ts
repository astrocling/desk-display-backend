import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

describe("fetchFlagstand", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSql.mockReset();
    process.env.DATABASE_URL = "postgres://example";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
  });

  it("soft-fails when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    const { fetchFlagstand } = await import("@/lib/fetchers/flagstand");
    const result = await fetchFlagstand();

    expect(result).toEqual({
      lastResult: null,
      nextRace: null,
      error: "DATABASE_URL not configured",
    });
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("filters race nights to the internal organization", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "org-internal" }])
      .mockResolvedValueOnce([
        {
          id: "race-complete",
          name: "Round 4",
          scheduledAt: "2026-07-20T00:00:00.000Z",
          track_name: "Charlotte",
          season_name: "2026 S1",
          series_name: "UMP Modifieds",
          league_name: "SSR Oval",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "race-next",
          name: "Round 5",
          scheduledAt: "2026-07-27T00:00:00.000Z",
          status: "SCHEDULED",
          track_name: "Bristol",
          season_name: "2026 S1",
          series_name: "UMP Modifieds",
          league_name: "SSR Oval",
        },
      ]);

    const { fetchFlagstand } = await import("@/lib/fetchers/flagstand");
    const result = await fetchFlagstand(["league-1"]);

    expect(result.error).toBeUndefined();
    expect(result.lastResult).toEqual({
      id: "race-complete",
      name: "Round 4",
      scheduledAt: "2026-07-20T00:00:00.000Z",
      trackName: "Charlotte",
      leagueName: "SSR Oval",
      seasonName: "2026 S1",
      seriesName: "UMP Modifieds",
    });
    expect(result.nextRace).toEqual({
      id: "race-next",
      name: "Round 5",
      scheduledAt: "2026-07-27T00:00:00.000Z",
      status: "SCHEDULED",
      trackName: "Bristol",
      leagueName: "SSR Oval",
      seasonName: "2026 S1",
      seriesName: "UMP Modifieds",
    });

    expect(mockSql).toHaveBeenCalledTimes(3);
    const orgQuery = String(mockSql.mock.calls[0][0]);
    expect(orgQuery).toContain('"Organization"');
    expect(orgQuery).toContain('"isInternal" = true');
  });
});
