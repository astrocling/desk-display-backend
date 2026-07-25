import { describe, expect, it } from "vitest";

import {
  SCORES_LIVE_TTL_MS,
  shouldRefreshLiveScores,
} from "@/lib/scores-refresh";
import type { MlbScores, ScoresBlob } from "@/lib/types/scores";

const emptyMlb: MlbScores = {
  live: false,
  score: null,
  inning: null,
  nextGame: null,
  matchup: null,
  whenEt: null,
  record: null,
  standingLine: null,
  teamAbbr: "HOU",
  opponentAbbr: null,
  homeAway: null,
  teamRuns: null,
  opponentRuns: null,
  balls: null,
  strikes: null,
  outs: null,
  onFirst: null,
  onSecond: null,
  onThird: null,
  batterName: null,
  pitcherName: null,
};

function makeBlob(
  updatedAt: string,
  mlb: Partial<MlbScores> = {},
): ScoresBlob {
  return {
    mlb: { ...emptyMlb, ...mlb },
    flagstand: { lastResult: null, nextRace: null },
    updatedAt,
  };
}

describe("shouldRefreshLiveScores", () => {
  const now = new Date("2026-07-24T20:30:00Z");

  it("skips refresh inside the TTL window even when live", () => {
    const b = makeBlob(
      new Date(now.getTime() - SCORES_LIVE_TTL_MS + 5_000).toISOString(),
      { live: true },
    );
    expect(shouldRefreshLiveScores(b, now)).toBe(false);
  });

  it("refreshes a live blob past the TTL", () => {
    const b = makeBlob(
      new Date(now.getTime() - SCORES_LIVE_TTL_MS - 1_000).toISOString(),
      { live: true },
    );
    expect(shouldRefreshLiveScores(b, now)).toBe(true);
  });

  it("refreshes when nextGame start is in the past and TTL expired", () => {
    const b = makeBlob(
      new Date(now.getTime() - SCORES_LIVE_TTL_MS - 1_000).toISOString(),
      { live: false, nextGame: "2026-07-24T19:40:00Z" },
    );
    expect(shouldRefreshLiveScores(b, now)).toBe(true);
  });

  it("does not refresh a future nextGame when not live", () => {
    const b = makeBlob(
      new Date(now.getTime() - SCORES_LIVE_TTL_MS - 1_000).toISOString(),
      { live: false, nextGame: "2026-07-25T23:40:00Z" },
    );
    expect(shouldRefreshLiveScores(b, now)).toBe(false);
  });
});
