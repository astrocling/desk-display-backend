import { describe, expect, it } from "vitest";

import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import { normalizeWpblGameDetail } from "@/lib/fetchers/wpbl-v1/normalize-game-detail";

describe("normalizeWpblGameDetail", () => {
  it("fills missing plays and runner name fields on stale blobs", () => {
    const stale = {
      updatedAt: "2026-08-21T12:00:00.000Z",
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
        venue: null,
        countsInStandings: true,
        inning: "Top 3",
        situation: {
          inningNumber: 3,
          half: "top",
          balls: 1,
          strikes: 2,
          outs: 1,
          onFirst: true,
          onSecond: false,
          onThird: false,
          batterName: "Davis",
          pitcherName: "Kim",
        },
      },
      boxscore: {
        available: true,
        lineScore: null,
        batting: [],
        pitching: [],
      },
    } as unknown as WpblGameDetailResponse;

    const next = normalizeWpblGameDetail(stale);
    expect(next.boxscore.plays).toEqual([]);
    expect(next.game.situation).toMatchObject({
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
      onFirst: true,
    });
    expect(next.boxscore.batting).toEqual([]);
  });

  it("backfills missing headshotUrl on roster lines", () => {
    const stale = {
      updatedAt: "2026-08-21T12:00:00.000Z",
      game: {
        id: "g1",
        status: "final",
        startIso: null,
        whenEt: null,
        awayAbbr: "LA",
        homeAbbr: "NY",
        awayName: "Queens",
        homeName: "Heights",
        awayRuns: 1,
        homeRuns: 2,
        venue: null,
        countsInStandings: true,
        inning: null,
        situation: null,
      },
      boxscore: {
        available: true,
        lineScore: null,
        batting: [
          {
            playerId: "p1",
            name: "A",
            teamSide: "away",
            position: "CF",
            battingOrder: 1,
            uniform: "7",
            ab: 1,
            r: 0,
            h: 0,
            rbi: 0,
            bb: 0,
            so: 0,
          },
        ],
        pitching: [],
        plays: [],
      },
    } as unknown as WpblGameDetailResponse;

    const next = normalizeWpblGameDetail(stale);
    expect(next.boxscore.batting[0]?.headshotUrl).toBeNull();
  });
});
