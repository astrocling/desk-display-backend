import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWpbl, parseWpblHomepageHtml } from "@/lib/fetchers/wpbl";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/wpbl-homepage.html"),
  "utf8",
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseWpblHomepageHtml", () => {
  it("parses standings in source order with fixed abbreviations", () => {
    const parsed = parseWpblHomepageHtml(
      fixture,
      new Date("2026-08-10T18:00:00Z"),
    );

    expect(parsed.standings).toEqual([
      { abbr: "LA", name: "Queens", w: 3, l: 1, pct: ".750", gb: "—" },
      { abbr: "NY", name: "Heights", w: 2, l: 2, pct: ".500", gb: "1" },
      { abbr: "SF", name: "Firebells", w: 2, l: 2, pct: ".500", gb: "1" },
      { abbr: "BOS", name: "Hunters", w: 1, l: 3, pct: ".250", gb: "2" },
    ]);
  });

  it("keeps the Eastern calendar day plus live games and caps at four", () => {
    const parsed = parseWpblHomepageHtml(
      fixture,
      new Date("2026-08-12T16:00:00Z"),
    );

    expect(parsed.games).toHaveLength(4);
    expect(
      parsed.games.map(({ status, awayAbbr, homeAbbr }) => ({
        status,
        awayAbbr,
        homeAbbr,
      })),
    ).toEqual([
      { status: "live", awayAbbr: "BOS", homeAbbr: "LA" },
      { status: "scheduled", awayAbbr: "LA", homeAbbr: "SF" },
      { status: "scheduled", awayAbbr: "BOS", homeAbbr: "NY" },
      { status: "final", awayAbbr: "SF", homeAbbr: "BOS" },
    ]);
  });

  it("maps final runs and team nicknames", () => {
    const parsed = parseWpblHomepageHtml(
      fixture,
      new Date("2026-08-09T23:00:00Z"),
    );

    expect(parsed.games).toEqual([
      expect.objectContaining({
        status: "final",
        awayAbbr: "NY",
        homeAbbr: "BOS",
        awayName: "Heights",
        homeName: "Hunters",
        awayRuns: 7,
        homeRuns: 6,
        whenEt: null,
      }),
      expect.objectContaining({
        status: "live",
        awayAbbr: "BOS",
        homeAbbr: "LA",
      }),
    ]);
  });

  it("maps scheduled start time and Eastern display time", () => {
    const parsed = parseWpblHomepageHtml(
      fixture,
      new Date("2026-08-12T16:00:00Z"),
    );
    const scheduled = parsed.games.find(
      (game) => game.awayAbbr === "LA" && game.homeAbbr === "SF",
    );

    expect(scheduled).toMatchObject({
      status: "scheduled",
      awayRuns: null,
      homeRuns: null,
      startIso: "2026-08-12T22:30:00.000Z",
      whenEt: "Wed 8/12 6:30 PM",
    });
  });
});

describe("fetchWpbl", () => {
  it("soft-fails to empty arrays on an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    const result = await fetchWpbl();

    expect(result.games).toEqual([]);
    expect(result.standings).toEqual([]);
    expect(result.error).toContain("503");
  });
});
