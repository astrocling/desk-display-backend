import { describe, expect, it } from "vitest";
import type {
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblLeadersResponse,
  WpblLeagueResponse,
  WpblPlayerDetailResponse,
} from "@/lib/types/wpbl-display";
import {
  leaderPlayerIdsToWarm,
  mergeWpblLeadersBlob,
  mergeWpblLeagueBlob,
  shouldRefreshWpblGame,
  shouldRefreshWpblLeague,
  shouldRefreshWpblPlayer,
  wpblGameMayBeLive,
  wpblGamesNeedLivePoll,
  WPBL_LEAGUE_LIVE_TTL_MS,
  WPBL_LEAGUE_MAX_AGE_MS,
  WPBL_LIVE_TTL_MS,
  WPBL_PLAYER_TTL_MS,
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
      plays: [],
    tracking: [],
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
    schemaVersion: 2,
    partial: true,
    qualifiers: { battingMinAb: 10, pitchingMinOuts: 9 },
    dataNotes: [],
    batting: {
      avg: [],
      obp: [],
      slg: [],
      ops: [],
      hr: [],
      rbi: [],
      h: [],
      r: [],
      doubles: [],
      sb: [],
    },
    pitching: {
      era: [],
      whip: [],
      ip: [],
      so: [],
      w: [],
      l: [],
      sv: [],
    },
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
          position: "CF",
          headshotUrl: null,
        },
      ],
      obp: [],
      slg: [],
      ops: [],
      hr: [],
      rbi: [],
      h: [],
      r: [],
      doubles: [],
      sb: [],
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
        plays: [],
      tracking: [],
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
        plays: [],
      tracking: [],
      },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });

  it("refreshes scheduled games whose start time has passed", () => {
    const d = detail({
      status: "scheduled",
      updatedAt: now.toISOString(),
      game: { startIso: "2026-08-21T17:00:00.000Z" },
      boxscore: {
        available: true,
        lineScore: null,
        batting: [],
        pitching: [],
        plays: [],
      tracking: [],
      },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });
});

describe("wpblGameMayBeLive", () => {
  const now = new Date("2026-08-21T18:00:00Z");

  it("returns true for live status", () => {
    expect(
      wpblGameMayBeLive({ status: "live", startIso: null }, { now }),
    ).toBe(true);
  });

  it("returns true when schedule marks live before detail catches up", () => {
    expect(
      wpblGameMayBeLive(
        { status: "scheduled", startIso: "2026-08-21T19:00:00.000Z" },
        { scheduleLive: true, now },
      ),
    ).toBe(true);
  });

  it("returns true when a scheduled start time is due", () => {
    expect(
      wpblGameMayBeLive(
        { status: "scheduled", startIso: "2026-08-21T17:00:00.000Z" },
        { now },
      ),
    ).toBe(true);
  });

  it("returns false for a future scheduled start", () => {
    expect(
      wpblGameMayBeLive(
        { status: "scheduled", startIso: "2026-08-21T19:00:00.000Z" },
        { now },
      ),
    ).toBe(false);
  });
});

describe("shouldRefreshWpblLeague", () => {
  const now = new Date("2026-08-21T18:00:00Z");

  it("skips refresh inside the TTL window", () => {
    const blob: WpblLeagueResponse = {
      ...freshLeagueNoStandings,
      updatedAt: new Date(now.getTime() - WPBL_LEAGUE_LIVE_TTL_MS + 5_000).toISOString(),
      games: [
        {
          id: "live1",
          status: "live",
          startIso: "2026-08-21T17:00:00.000Z",
          whenEt: null,
          awayAbbr: "LA",
          homeAbbr: "NY",
          awayName: "Queens",
          homeName: "Heights",
          awayRuns: 1,
          homeRuns: 2,
          venue: null,
          countsInStandings: true,
        },
      ],
    };
    expect(shouldRefreshWpblLeague(blob, now)).toBe(false);
  });

  it("refreshes when a live game is stale", () => {
    const blob: WpblLeagueResponse = {
      ...freshLeagueNoStandings,
      updatedAt: new Date(now.getTime() - WPBL_LEAGUE_LIVE_TTL_MS - 1_000).toISOString(),
      games: [
        {
          id: "live1",
          status: "live",
          startIso: "2026-08-21T17:00:00.000Z",
          whenEt: null,
          awayAbbr: "LA",
          homeAbbr: "NY",
          awayName: "Queens",
          homeName: "Heights",
          awayRuns: 1,
          homeRuns: 2,
          venue: null,
          countsInStandings: true,
        },
      ],
    };
    expect(shouldRefreshWpblLeague(blob, now)).toBe(true);
  });

  it("refreshes when a scheduled start is due and TTL expired", () => {
    const blob: WpblLeagueResponse = {
      ...freshLeagueNoStandings,
      updatedAt: new Date(now.getTime() - WPBL_LEAGUE_LIVE_TTL_MS - 1_000).toISOString(),
      games: [
        {
          id: "g1",
          status: "scheduled",
          startIso: "2026-08-21T17:00:00.000Z",
          whenEt: null,
          awayAbbr: "LA",
          homeAbbr: "NY",
          awayName: "Queens",
          homeName: "Heights",
          awayRuns: null,
          homeRuns: null,
          venue: null,
          countsInStandings: true,
        },
      ],
    };
    expect(shouldRefreshWpblLeague(blob, now)).toBe(true);
  });

  it("refreshes an all-final slate once the max age TTL expires", () => {
    const blob: WpblLeagueResponse = {
      ...freshLeagueNoStandings,
      updatedAt: new Date(
        now.getTime() - WPBL_LEAGUE_MAX_AGE_MS - 1_000,
      ).toISOString(),
      games: [
        {
          id: "final1",
          status: "final",
          startIso: "2026-08-30T23:30:00.000Z",
          whenEt: null,
          awayAbbr: "NY",
          homeAbbr: "SF",
          awayName: "Heights",
          homeName: "Firebells",
          awayRuns: 9,
          homeRuns: 11,
          venue: null,
          countsInStandings: true,
        },
      ],
    };
    expect(shouldRefreshWpblLeague(blob, now)).toBe(true);
  });
});

describe("wpblGamesNeedLivePoll", () => {
  it("detects live and due scheduled games", () => {
    const now = new Date("2026-08-21T18:00:00Z");
    expect(
      wpblGamesNeedLivePoll(
        [
          {
            id: "g1",
            status: "scheduled",
            startIso: "2026-08-21T19:00:00.000Z",
            whenEt: null,
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
            id: "g2",
            status: "scheduled",
            startIso: "2026-08-21T17:00:00.000Z",
            whenEt: null,
            awayAbbr: "SF",
            homeAbbr: "BOS",
            awayName: "Firebells",
            homeName: "Hunters",
            awayRuns: null,
            homeRuns: null,
            venue: null,
            countsInStandings: true,
          },
        ],
        now,
      ),
    ).toBe(true);
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

describe("shouldRefreshWpblPlayer", () => {
  const player = (updatedAt: string): WpblPlayerDetailResponse => ({
    updatedAt,
    seasonId: "c9sgab9f9yx00z75",
    partial: false,
    player: {
      id: "p1",
      name: "Test",
      firstName: "Test",
      lastName: "",
      teamId: "vhubhz8li07tmgq8",
      teamAbbr: "SF",
      teamName: "Firebells",
      position: "CF",
      uniform: "1",
      bats: "R",
      throws: "R",
      hometown: null,
      birthdate: null,
      status: "ACTIVE",
      headshotUrl: null,
      profileUrl: null,
    },
    season: {
      sourceThrough: null,
      batting: null,
      pitching: null,
      fielding: null,
    },
    gameLog: [],
  });

  it("refreshes when older than TTL", () => {
    const now = new Date("2026-08-22T12:10:00.000Z");
    const updatedAt = new Date(
      now.getTime() - WPBL_PLAYER_TTL_MS - 1,
    ).toISOString();
    expect(shouldRefreshWpblPlayer(player(updatedAt), now)).toBe(true);
  });

  it("skips refresh when fresh", () => {
    const now = new Date("2026-08-22T12:10:00.000Z");
    const updatedAt = new Date(
      now.getTime() - WPBL_PLAYER_TTL_MS + 60_000,
    ).toISOString();
    expect(shouldRefreshWpblPlayer(player(updatedAt), now)).toBe(false);
  });
});

describe("leaderPlayerIdsToWarm", () => {
  function entry(
    playerId: string,
    name = playerId,
  ): WpblLeadersResponse["batting"]["avg"][number] {
    return {
      playerId,
      name,
      teamAbbr: "SF",
      value: "1",
      sortValue: 1,
      position: null,
      headshotUrl: null,
    };
  }

  it("dedupes across boards and respects per-board limit", () => {
    const leaders: WpblLeadersResponse = {
      ...emptyLeaders(),
      batting: {
        avg: [entry("a"), entry("b"), entry("c")],
        obp: [],
        slg: [],
        ops: [],
        hr: [entry("a"), entry("d")],
        rbi: [],
        h: [],
        r: [],
        doubles: [],
        sb: [],
      },
      pitching: {
        era: [entry("e")],
        whip: [],
        ip: [],
        so: [],
        w: [],
        l: [],
        sv: [],
      },
    };
    expect(leaderPlayerIdsToWarm(leaders, 2)).toEqual(["a", "b", "d", "e"]);
  });

  it("returns empty when boards are empty", () => {
    expect(leaderPlayerIdsToWarm(emptyLeaders())).toEqual([]);
  });
});
