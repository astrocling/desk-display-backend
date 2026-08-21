import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapWpblGames, resolveSeasonId } from "./games";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/games-sample.json"), "utf8"),
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

describe("resolveSeasonId", () => {
  it("reads season_id from first game", () => {
    expect(resolveSeasonId(fixture)).toBe("c9sgab9f9yx00z75");
  });
});
