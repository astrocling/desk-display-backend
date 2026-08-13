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
        status: "live",
        awayAbbr: "BOS",
        homeAbbr: "LA",
      }),
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

  it("collapses duplicate same-matchup scheduled slots to the latest tip", () => {
    const html = `
      <a class="game game-link" href="/games/a">
        <span class="badge scheduled">Upcoming</span>
        <div class="teams">Boston Hunters at New York Heights</div>
        <div class="meta">Thu, Aug 13 · 10:30 PM UTC</div>
        <div class="score">0-0</div>
      </a>
      <a class="game game-link" href="/games/b">
        <span class="badge scheduled">Upcoming</span>
        <div class="teams">Boston Hunters at New York Heights</div>
        <div class="meta">Thu, Aug 13 · 11:30 PM UTC</div>
        <div class="score">0-0</div>
      </a>
      <a class="game game-link" href="/games/c">
        <span class="badge scheduled">Upcoming</span>
        <div class="teams">Boston Hunters at New York Heights</div>
        <div class="meta">Thu, Aug 13 · 11:30 PM UTC</div>
        <div class="score">0-0</div>
      </a>
    `;

    const parsed = parseWpblHomepageHtml(
      html,
      new Date("2026-08-13T16:00:00Z"),
    );

    expect(parsed.games).toEqual([
      expect.objectContaining({
        status: "scheduled",
        awayAbbr: "BOS",
        homeAbbr: "NY",
        startIso: "2026-08-13T23:30:00.000Z",
        whenEt: "Thu 8/13 7:30 PM",
      }),
    ]);
  });

  it("prefers a final over a ghost scheduled slot for the same matchup", () => {
    const html = `
      <a class="game game-link" href="/games/ghost">
        <span class="badge scheduled">Upcoming</span>
        <div class="teams">New York Heights at Boston Hunters</div>
        <div class="meta">Sun, Aug 9 · 10:30 PM UTC</div>
        <div class="score">0-0</div>
      </a>
      <a class="game game-link" href="/games/real">
        <span class="badge final">final - 8 innings</span>
        <div class="teams">New York Heights at Boston Hunters</div>
        <div class="meta">Sun, Aug 9 · 11:30 PM UTC</div>
        <div class="score">7-6</div>
      </a>
    `;

    const parsed = parseWpblHomepageHtml(
      html,
      new Date("2026-08-09T23:00:00Z"),
    );

    expect(parsed.games).toEqual([
      expect.objectContaining({
        status: "final",
        awayAbbr: "NY",
        homeAbbr: "BOS",
        awayRuns: 7,
        homeRuns: 6,
        startIso: "2026-08-09T23:30:00.000Z",
      }),
    ]);
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
