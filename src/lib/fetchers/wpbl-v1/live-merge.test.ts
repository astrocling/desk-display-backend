import { describe, expect, it } from "vitest";

import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import {
  applyWpblLiveBoxscore,
  applyWpblLiveEnvelope,
  applyWpblLiveGameState,
  asWpblBoxscorePayload,
  parseWpblLiveEnvelope,
  preferFresherGameDetail,
  preserveSeasonRates,
} from "./live-merge";

function baseDetail(
  partial?: Partial<WpblGameDetailResponse>,
): WpblGameDetailResponse {
  return {
    updatedAt: "2026-08-22T12:00:00.000Z",
    game: {
      id: "g1",
      status: "live",
      startIso: null,
      whenEt: null,
      awayAbbr: "LA",
      homeAbbr: "NY",
      awayName: "Queens",
      homeName: "Heights",
      awayRuns: 1,
      homeRuns: 2,
      venue: "Field",
      countsInStandings: true,
      inning: "Top 3",
      situation: {
        inningNumber: 3,
        half: "top",
        balls: 1,
        strikes: 1,
        outs: 0,
        onFirst: false,
        onSecond: false,
        onThird: false,
        runnerFirst: null,
        runnerSecond: null,
        runnerThird: null,
        batterName: "Davis",
        pitcherName: "Kim",
      },
    },
    boxscore: {
      available: true,
      lineScore: null,
      batting: [
        {
          side: "away",
          name: "Mo'ne Davis",
          playerId: "batter-1",
          position: "CF",
          battingOrder: 1,
          uniform: "3",
          headshotUrl: null,
          stats: { ab: "1", h: "0", avg: ".312" },
        },
      ],
      pitching: [
        {
          side: "home",
          name: "Rakyung Kim",
          playerId: "pitcher-1",
          position: "P",
          battingOrder: null,
          uniform: "17",
          headshotUrl: null,
          stats: { ip: "2.0", era: "1.80" },
        },
      ],
      plays: [],
    tracking: [],
    },
    ...partial,
  };
}

describe("asWpblBoxscorePayload", () => {
  it("accepts wrapped and bare boxscore objects", () => {
    expect(asWpblBoxscorePayload({ boxscore: { game_status: "Live" } })).toEqual(
      { boxscore: { game_status: "Live" } },
    );
    expect(
      asWpblBoxscorePayload({ game_status: "Live", plays: [] })?.boxscore,
    ).toMatchObject({ game_status: "Live" });
    expect(asWpblBoxscorePayload(null)).toBeNull();
  });
});

describe("parseWpblLiveEnvelope", () => {
  it("parses subscribed / boxscore / game snapshot envelopes", () => {
    expect(parseWpblLiveEnvelope({ type: "subscribed" }).type).toBe("subscribed");
    expect(
      parseWpblLiveEnvelope({
        type: "boxscore_snapshot",
        data: { boxscore: { game_status: "Live", plays: [] } },
      }),
    ).toEqual({
      type: "boxscore",
      boxscore: { game_status: "Live", plays: [] },
    });
    expect(
      parseWpblLiveEnvelope({
        type: "boxscore_updated",
        data: { new_value: { game_status: "Live" } },
      }),
    ).toEqual({ type: "boxscore", boxscore: { game_status: "Live" } });

    const game = parseWpblLiveEnvelope({
      type: "game_snapshot",
      data: {
        game: { status: "Live" },
        state: { away_score: 3, home_score: 1, inning: 4, half: "bottom", outs: 2 },
      },
    });
    expect(game).toMatchObject({
      type: "game_state",
      gameStatus: "Live",
      state: { away_score: 3, home_score: 1, inning: 4, half: "bottom", outs: 2 },
    });
  });

  it("parses path-based score updates", () => {
    expect(
      parseWpblLiveEnvelope({
        type: "game_updated",
        data: { path: "score.away", new_value: 4 },
      }),
    ).toEqual({
      type: "game_state",
      state: { away_score: 4 },
      gameStatus: null,
    });
  });
});

describe("preserveSeasonRates / applyWpblLiveBoxscore", () => {
  it("keeps enriched season AVG/ERA across remaps", () => {
    const next = preserveSeasonRates(
      [
        {
          side: "away",
          name: "Mo'ne Davis",
          playerId: "batter-1",
          position: "CF",
          battingOrder: 1,
          uniform: "3",
          headshotUrl: null,
          stats: { ab: "2", h: "1", avg: ".500" },
        },
      ],
      baseDetail().boxscore.batting,
    );
    expect(next[0]!.stats.avg).toBe(".312");
  });

  it("maps a live boxscore update onto the detail blob", () => {
    const prior = baseDetail();
    const next = applyWpblLiveBoxscore(prior, {
      game_status: "Live",
      status: {
        inning: 5,
        half: "bottom",
        outs: 1,
        balls: 2,
        strikes: 2,
        batter_name: "Perez",
        pitcher_name: "Sato",
        first_base: "Runner",
        second_base: "",
        third_base: "",
        bases_occupied: [1],
        away_runs: 4,
        home_runs: 3,
      },
      teams: [
        {
          side: "away",
          id: "v4gisr4rbgmn67b0",
          name: "Los Angeles Queens",
          line: [{ inning: 1, runs: 1 }],
          totals: { runs: 4, hits: 5, errors: 0, left_on_base: 2 },
          players: [
            {
              id: "batter-1",
              name: "Mo'ne Davis",
              spot: "1",
              uniform: "3",
              headshotUrl: null,
              position: "cf",
              hitting: { ab: "3", h: "1" },
            },
          ],
        },
        {
          side: "home",
          id: "fttth861nft1j2s7",
          name: "New York Heights",
          line: [{ inning: 1, runs: 0 }],
          totals: { runs: 3, hits: 4, errors: 0, left_on_base: 1 },
          players: [
            {
              id: "pitcher-1",
              name: "Rakyung Kim",
              position: "p",
              pitching: { ip: "4.0", er: "2" },
            },
          ],
        },
      ],
      plays: [
        {
          sequence: 1,
          inning: 1,
          half: "top",
          narrative: "Davis singled.",
          batter_name: "Mo'ne Davis",
          pitcher_name: "Rakyung Kim",
          event_type: "single",
          is_hit: true,
          is_scoring_play: false,
          runs_scored: 0,
          pitch_sequence: "BHS",
        },
      ],
    });

    expect(next.game.awayRuns).toBe(4);
    expect(next.game.homeRuns).toBe(3);
    expect(next.game.inning).toBe("Bot 5");
    expect(next.game.situation).toMatchObject({
      half: "bottom",
      balls: 2,
      strikes: 2,
      outs: 1,
      batterName: "Perez",
      runnerFirst: "Runner",
      onFirst: true,
    });
    expect(next.boxscore.plays).toHaveLength(1);
    expect(next.boxscore.batting[0]!.stats.avg).toBe(".312");
    expect(next.boxscore.pitching[0]!.stats.era).toBe("1.80");
  });
});

describe("applyWpblLiveGameState", () => {
  it("patches score and count from a game snapshot", () => {
    const next = applyWpblLiveGameState(
      baseDetail(),
      {
        away_score: 5,
        home_score: 5,
        inning: 7,
        half: "top",
        outs: 2,
        balls: 0,
        strikes: 2,
      },
      "Live",
    );
    expect(next.game.awayRuns).toBe(5);
    expect(next.game.homeRuns).toBe(5);
    expect(next.game.inning).toBe("Top 7");
    expect(next.game.situation).toMatchObject({
      outs: 2,
      balls: 0,
      strikes: 2,
      half: "top",
    });
  });

  it("ignores zeroed inning/half placeholders from game.state", () => {
    const next = applyWpblLiveGameState(
      baseDetail(),
      {
        away_score: 8,
        home_score: 5,
        inning: 0,
        half: "",
        outs: 0,
      },
      "In Progress - Bottom of 7th",
    );
    expect(next.game.awayRuns).toBe(8);
    expect(next.game.homeRuns).toBe(5);
    expect(next.game.inning).toBe("Top 3");
    expect(next.game.situation).toMatchObject({
      inningNumber: 3,
      half: "top",
    });
  });
});

describe("preferFresherGameDetail", () => {
  it("keeps a later-inning blob over a stale top-of-1st snapshot", () => {
    const early = baseDetail({
      game: {
        ...baseDetail().game,
        awayRuns: 0,
        homeRuns: 0,
        inning: "Top 1",
        situation: {
          ...baseDetail().game.situation!,
          inningNumber: 1,
          half: "top",
        },
      },
      boxscore: {
        ...baseDetail().boxscore,
        lineScore: {
          maxInning: 1,
          teams: [],
        },
        plays: [],
      },
    });
    const late = baseDetail({
      updatedAt: "2026-08-22T13:00:00.000Z",
      game: {
        ...baseDetail().game,
        awayRuns: 8,
        homeRuns: 5,
        inning: "Bot 7",
        situation: {
          ...baseDetail().game.situation!,
          inningNumber: 7,
          half: "bottom",
        },
      },
      boxscore: {
        ...baseDetail().boxscore,
        lineScore: {
          maxInning: 7,
          teams: [],
        },
        plays: Array.from({ length: 80 }, (_, i) => ({
          sequence: i + 1,
          inning: 7,
          half: "bottom" as const,
          outs: 0,
          batterName: null,
          pitcherName: null,
          runnerFirst: null,
          runnerSecond: null,
          runnerThird: null,
          narrative: `Play ${i}`,
          eventType: "unknown",
          isHit: false,
          isScoringPlay: false,
          runsScored: 0,
          pitchSequence: null,
          pitchEvents: [],
          finalBalls: null,
          finalStrikes: null,
          finalFouls: null,
        })),
      },
    });

    expect(preferFresherGameDetail(late, early)).toBe(late);
    expect(
      applyWpblLiveBoxscore(late, {
        game_status: "Live",
        status: {
          inning: 1,
          half: "top",
          outs: 0,
          away_runs: 0,
          home_runs: 0,
        },
        teams: [],
        plays: [],
      }).game.inning,
    ).toBe("Bot 7");
  });
});

describe("applyWpblLiveEnvelope", () => {
  it("routes boxscore envelopes through the boxscore merger", () => {
    const next = applyWpblLiveEnvelope(baseDetail(), {
      type: "boxscore",
      boxscore: {
        game_status: "Final",
        status: { away_runs: 10, home_runs: 8, complete: true },
        teams: [],
        plays: [],
      tracking: [],
      },
    });
    expect(next.game.status).toBe("final");
    expect(next.game.awayRuns).toBe(10);
    expect(next.game.situation).toBeNull();
  });
});
