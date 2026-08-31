import { describe, expect, it, vi } from "vitest";

import { collapseDuplicateMatchups, mapWpblGames } from "./games";
import { fetchMissingFinalApiGames } from "./team-games";

vi.mock("./client", () => ({
  fetchWpblJson: vi.fn(),
}));

import { fetchWpblJson } from "./client";

const mockedFetch = vi.mocked(fetchWpblJson);

describe("fetchMissingFinalApiGames", () => {
  it("returns finals that are absent from the league games list", async () => {
    mockedFetch.mockImplementation(async (path: string) => {
      if (path.includes("/teams/vhubhz8li07tmgq8/games")) {
        return {
          games: [
            {
              game_id: "gstfxmwv1zkcza31",
              scheduled_start: "2026-08-30T23:30:00Z",
              opponent_team_id: "fttth861nft1j2s7",
              opponent_team_name: "New York Heights",
              side: "home",
              is_final: true,
              runs: 11,
              opponent_runs: 9,
            },
          ],
        };
      }
      return { games: [] };
    });

    const listPayload = {
      games: [
        {
          game_id: "pvp728vuqo0l7sh2",
          season_id: "c9sgab9f9yx00z75",
          home_team_id: "vhubhz8li07tmgq8",
          away_team_id: "fttth861nft1j2s7",
          home_team_name: "",
          away_team_name: "",
          status: "Not Started",
          scheduled_start: "2026-08-30T22:30:00Z",
          counts_in_standings: true,
        },
      ],
    };

    const extras = await fetchMissingFinalApiGames(listPayload);
    expect(extras).toHaveLength(1);
    expect(extras[0]).toMatchObject({
      game_id: "gstfxmwv1zkcza31",
      status: "Final",
      away_team_id: "fttth861nft1j2s7",
      home_team_id: "vhubhz8li07tmgq8",
      presto_data: { score: { away: "9", home: "11" } },
    });
  });

  it("dedupes the same final returned from multiple team feeds", async () => {
    mockedFetch.mockImplementation(async (path: string) => {
      const row = {
        game_id: "gstfxmwv1zkcza31",
        scheduled_start: "2026-08-30T23:30:00Z",
        opponent_team_id: "fttth861nft1j2s7",
        side: "home",
        is_final: true,
        runs: 11,
        opponent_runs: 9,
      };
      if (path.includes("/teams/vhubhz8li07tmgq8/games")) {
        return { games: [row] };
      }
      if (path.includes("/teams/fttth861nft1j2s7/games")) {
        return {
          games: [
            {
              ...row,
              side: "away",
              opponent_team_id: "vhubhz8li07tmgq8",
              runs: 9,
              opponent_runs: 11,
            },
          ],
        };
      }
      return { games: [] };
    });

    const extras = await fetchMissingFinalApiGames({ games: [] });
    expect(extras).toHaveLength(1);
  });
});

describe("schedule merge integration", () => {
  it("collapses a ghost scheduled slot when a team-final row exists", () => {
    const payload = {
      games: [
        {
          game_id: "pvp728vuqo0l7sh2",
          season_id: "c9sgab9f9yx00z75",
          home_team_id: "vhubhz8li07tmgq8",
          away_team_id: "fttth861nft1j2s7",
          home_team_name: "",
          away_team_name: "",
          status: "Not Started",
          scheduled_start: "2026-08-30T22:30:00Z",
          counts_in_standings: true,
        },
        {
          game_id: "gstfxmwv1zkcza31",
          season_id: "c9sgab9f9yx00z75",
          home_team_id: "vhubhz8li07tmgq8",
          away_team_id: "fttth861nft1j2s7",
          home_team_name: "San Francisco Firebells",
          away_team_name: "New York Heights",
          status: "Final",
          scheduled_start: "2026-08-30T23:30:00Z",
          counts_in_standings: true,
          presto_data: { score: { away: "9", home: "11" } },
        },
      ],
    };

    const games = collapseDuplicateMatchups(mapWpblGames(payload));
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: "gstfxmwv1zkcza31",
      status: "final",
      awayAbbr: "NY",
      homeAbbr: "SF",
      awayRuns: 9,
      homeRuns: 11,
    });
  });
});
