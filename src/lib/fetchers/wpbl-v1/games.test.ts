import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collapseDuplicateMatchups,
  fetchWpblGamesPayload,
  mapWpblGames,
  resolveSeasonId,
} from "./games";
import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

vi.mock("./client", () => ({
  fetchWpblJson: vi.fn(),
}));

import { fetchWpblJson } from "./client";

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
      gameType: "regular",
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
    expect(games[0].gameType).toBe("regular");
  });

  it("maps postseason game_type and Presto isPostSeason", () => {
    const games = mapWpblGames({
      count: 2,
      games: [
        {
          game_id: "playoff1",
          season_id: "c9sgab9f9yx00z75",
          home_team_id: "vhubhz8li07tmgq8",
          away_team_id: "9f08or2mffx81409",
          home_team_name: "San Francisco Firebells",
          away_team_name: "Boston Hunters",
          status: "Not Started",
          scheduled_start: "2026-09-09T23:00:00Z",
          counts_in_standings: false,
          game_type: "playoff",
        },
        {
          game_id: "playoff2",
          season_id: "c9sgab9f9yx00z75",
          home_team_id: "v4gisr4rbgmn67b0",
          away_team_id: "fttth861nft1j2s7",
          home_team_name: "Los Angeles Queens",
          away_team_name: "New York Heights",
          status: "Not Started",
          scheduled_start: "2026-09-10T23:00:00Z",
          counts_in_standings: false,
          game_type: "regular",
          presto_data: { eventType: { isPostSeason: true } },
        },
      ],
    });
    expect(games.map((g) => g.gameType)).toEqual([
      "postseason",
      "postseason",
    ]);
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
      gameType: "regular",
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
      gameType: "regular",
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

describe("fetchWpblGamesPayload", () => {
  beforeEach(() => {
    vi.mocked(fetchWpblJson).mockReset();
  });

  it("paginates when the schedule exceeds one API page", async () => {
    const page0 = {
      games: Array.from({ length: 50 }, (_, i) => ({
        game_id: `page0-${i}`,
        season_id: "c9sgab9f9yx00z75",
        home_team_id: "fttth861nft1j2s7",
        away_team_id: "v4gisr4rbgmn67b0",
        home_team_name: "New York Heights",
        away_team_name: "Los Angeles Queens",
        status: "Final",
        scheduled_start: "2026-08-01T21:00:00Z",
      })),
    };
    const page1 = {
      games: [
        {
          game_id: "sep-game",
          season_id: "c9sgab9f9yx00z75",
          home_team_id: "9f08or2mffx81409",
          away_team_id: "vhubhz8li07tmgq8",
          home_team_name: "Boston Hunters",
          away_team_name: "San Francisco Firebells",
          status: "Not Started",
          scheduled_start: "2026-09-02T23:30:00Z",
        },
      ],
    };
    vi.mocked(fetchWpblJson)
      .mockResolvedValueOnce(page0)
      .mockResolvedValueOnce(page1);

    const payload = await fetchWpblGamesPayload();
    expect(payload.games).toHaveLength(51);
    expect(payload.games[50]?.game_id).toBe("sep-game");
    expect(fetchWpblJson).toHaveBeenCalledTimes(2);
    expect(fetchWpblJson).toHaveBeenNthCalledWith(
      1,
      "/v1/games?limit=50&offset=0",
    );
    expect(fetchWpblJson).toHaveBeenNthCalledWith(
      2,
      "/v1/games?limit=50&offset=50",
    );
  });
});
