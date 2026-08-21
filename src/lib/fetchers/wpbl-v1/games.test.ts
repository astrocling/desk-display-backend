import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collapseDuplicateMatchups,
  mapWpblGames,
  resolveSeasonId,
} from "./games";
import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/games-sample.json"),
    "utf8",
  ),
);

describe("mapWpblGames", () => {
  it("maps ids, status, abbrs, scores, and whenEt for scheduled", () => {
    const games = mapWpblGames(fixture);
    expect(games[0]).toMatchObject({
      id: "8alsgvzc90ypwphl",
      status: "final",
      awayAbbr: "LA",
      homeAbbr: "NY",
      awayName: "Queens",
      homeName: "Heights",
      awayRuns: 10,
      homeRuns: 8,
      whenEt: null,
      countsInStandings: true,
    });
    expect(games[1]).toMatchObject({
      status: "scheduled",
      awayAbbr: "SF",
      homeAbbr: "BOS",
      awayRuns: null,
      homeRuns: null,
    });
    expect(games[1].whenEt).toMatch(/PM$/);
    expect(games[1].startIso).toBe("2026-08-22T17:00:00Z");
  });
});

describe("collapseDuplicateMatchups", () => {
  it("prefers final over scheduled ghost for same matchup day", () => {
    const games: WpblScheduleGame[] = [
      {
        id: "ghost",
        status: "scheduled",
        startIso: "2026-08-01T22:00:00Z",
        whenEt: "Sat 8/1 6:00 PM",
        awayAbbr: "LA",
        homeAbbr: "NY",
        awayName: "Queens",
        homeName: "Heights",
        awayRuns: null,
        homeRuns: null,
        venue: null,
        countsInStandings: true,
      },
      {
        id: "real",
        status: "final",
        startIso: "2026-08-01T21:00:00Z",
        whenEt: null,
        awayAbbr: "LA",
        homeAbbr: "NY",
        awayName: "Queens",
        homeName: "Heights",
        awayRuns: 10,
        homeRuns: 8,
        venue: null,
        countsInStandings: true,
      },
    ];
    const collapsed = collapseDuplicateMatchups(games);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe("real");
    expect(collapsed[0].status).toBe("final");
  });
});

describe("resolveSeasonId", () => {
  it("reads season_id from first game", () => {
    expect(resolveSeasonId(fixture)).toBe("c9sgab9f9yx00z75");
  });
});
