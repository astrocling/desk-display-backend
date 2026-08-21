import { describe, expect, it } from "vitest";
import type {
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblLeadersResponse,
  WpblLeagueResponse,
} from "@/lib/types/wpbl-display";
import {
  mergeWpblLeadersBlob,
  mergeWpblLeagueBlob,
  shouldRefreshWpblGame,
  WPBL_LIVE_TTL_MS,
} from "./refresh";

function detail(
  partial: Partial<WpblGameDetailResponse> & { status: WpblGameStatus },
): WpblGameDetailResponse {
  return {
    updatedAt: partial.updatedAt ?? "2026-08-21T12:00:00.000Z",
    game: {
      id: "g1",
      status: partial.status,
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
      ...(partial.game ?? {}),
    },
    boxscore: partial.boxscore ?? {
      available: false,
      lineScore: null,
      batting: [],
      pitching: [],
    },
  };
}

const priorLeague: WpblLeagueResponse = {
  updatedAt: "2026-08-21T10:00:00.000Z",
  seasonId: "c9sgab9f9yx00z75",
  standings: [
    {
      teamId: "vhubhz8li07tmgq8",
      abbr: "SF",
      name: "Firebells",
      rank: 1,
      w: 5,
      l: 2,
      t: 0,
      pct: ".714",
      gb: null,
      rf: 40,
      ra: 25,
      diff: 15,
      l10: "5-2",
      streak: "W2",
    },
  ],
  games: [],
};

const freshLeagueNoStandings: WpblLeagueResponse = {
  updatedAt: "2026-08-21T12:00:00.000Z",
  seasonId: "c9sgab9f9yx00z75",
  standings: [],
  games: [
    {
      id: "g1",
      status: "scheduled",
      startIso: "2026-08-22T18:00:00.000Z",
      whenEt: "Sat 2:00 PM ET",
      awayAbbr: "LA",
      homeAbbr: "NY",
      awayName: "Queens",
      homeName: "Heights",
      awayRuns: null,
      homeRuns: null,
      venue: "Field",
      countsInStandings: true,
    },
  ],
};

function emptyLeaders(): WpblLeadersResponse {
  return {
    updatedAt: "2026-08-21T12:00:00.000Z",
    seasonId: "c9sgab9f9yx00z75",
    partial: true,
    qualifiers: { battingMinAb: 10 },
    batting: { avg: [], hr: [], rbi: [], h: [] },
    pitching: { era: [], so: [], w: [], sv: [] },
  };
}

function richLeaders(): WpblLeadersResponse {
  return {
    ...emptyLeaders(),
    partial: false,
    batting: {
      avg: [
        {
          playerId: "p1",
          name: "Slugger",
          teamAbbr: "SF",
          value: ".400",
          sortValue: 0.4,
        },
      ],
      hr: [],
      rbi: [],
      h: [],
    },
  };
}

describe("shouldRefreshWpblGame", () => {
  const now = new Date("2026-08-21T18:00:00Z");

  it("refreshes live blobs older than TTL", () => {
    const d = detail({
      status: "live",
      updatedAt: new Date(now.getTime() - WPBL_LIVE_TTL_MS - 1000).toISOString(),
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });

  it("skips live blobs inside TTL", () => {
    const d = detail({
      status: "live",
      updatedAt: new Date(now.getTime() - 1000).toISOString(),
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });

  it("refreshes when boxscore unavailable", () => {
    const d = detail({
      status: "final",
      updatedAt: now.toISOString(),
      boxscore: {
        available: false,
        lineScore: null,
        batting: [],
        pitching: [],
      },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });

  it("skips fresh final with boxscore", () => {
    const d = detail({
      status: "final",
      updatedAt: now.toISOString(),
      boxscore: {
        available: true,
        lineScore: null,
        batting: [],
        pitching: [],
      },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });
});

describe("mergeWpblLeagueBlob", () => {
  it("keeps prior standings when fresh standings are empty", () => {
    const merged = mergeWpblLeagueBlob(freshLeagueNoStandings, priorLeague);
    expect(merged.standings).toEqual(priorLeague.standings);
    expect(merged.games).toEqual(freshLeagueNoStandings.games);
    expect(merged.updatedAt).toBe(freshLeagueNoStandings.updatedAt);
  });

  it("uses fresh standings when present", () => {
    const fresh = {
      ...freshLeagueNoStandings,
      standings: [{ ...priorLeague.standings[0], w: 6 }],
    };
    const merged = mergeWpblLeagueBlob(fresh, priorLeague);
    expect(merged.standings[0].w).toBe(6);
  });
});

describe("mergeWpblLeadersBlob", () => {
  it("keeps prior leaders when fresh blob is empty", () => {
    const merged = mergeWpblLeadersBlob(emptyLeaders(), richLeaders());
    expect(merged.batting.avg).toEqual(richLeaders().batting.avg);
  });

  it("uses fresh leaders when they contain data", () => {
    const fresh = richLeaders();
    const prior = {
      ...richLeaders(),
      batting: {
        ...richLeaders().batting,
        avg: [{ ...richLeaders().batting.avg[0], value: ".300", sortValue: 0.3 }],
      },
    };
    const merged = mergeWpblLeadersBlob(fresh, prior);
    expect(merged.batting.avg[0].value).toBe(".400");
  });
});
