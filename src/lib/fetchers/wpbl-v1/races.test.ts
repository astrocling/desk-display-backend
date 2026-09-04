import { describe, expect, it } from "vitest";

import {
  buildRaceSeriesForPlayer,
  buildWpblRacesBlob,
  cumulativeRacePoints,
  racePlayerIdsToLoad,
} from "./races";
import type {
  WpblLeadersResponse,
  WpblPlayerDetailResponse,
  WpblPlayerGameLogEntry,
} from "@/lib/types/wpbl-display";

function logEntry(
  partial: Partial<WpblPlayerGameLogEntry> & {
    gameId: string;
    startIso: string;
  },
): WpblPlayerGameLogEntry {
  return {
    side: "home",
    result: "W",
    teamRuns: 5,
    opponentRuns: 2,
    opponentAbbr: "NY",
    opponentName: "Heights",
    isFinal: true,
    batting: null,
    pitching: null,
    fielding: null,
    ...partial,
  };
}

const emptyLeaders = {
  updatedAt: "2026-09-01T00:00:00.000Z",
  seasonId: "season",
  partial: false,
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
} satisfies WpblLeadersResponse;

describe("cumulativeRacePoints", () => {
  it("accumulates counting stats oldest to newest", () => {
    const points = cumulativeRacePoints(
      [
        logEntry({
          gameId: "g2",
          startIso: "2026-08-20T18:00:00Z",
          batting: { hr: 2, ab: 4, h: 2, r: 2, rbi: 2, bb: 0, so: 0 },
        }),
        logEntry({
          gameId: "g1",
          startIso: "2026-08-15T18:00:00Z",
          batting: { hr: 1, ab: 3, h: 1, r: 1, rbi: 1, bb: 0, so: 0 },
        }),
      ],
      "hr",
    );
    expect(points.map((p) => p.value)).toEqual([1, 3]);
    expect(points.map((p) => p.date)).toEqual(["2026-08-15", "2026-08-20"]);
  });

  it("reads pitching SO", () => {
    const points = cumulativeRacePoints(
      [
        logEntry({
          gameId: "g1",
          startIso: "2026-08-15T18:00:00Z",
          pitching: { so: 5, ip: "5.0", h: 3, r: 1, er: 1, bb: 1 },
        }),
      ],
      "so",
    );
    expect(points).toEqual([
      { date: "2026-08-15", gameId: "g1", value: 5 },
    ]);
  });
});

describe("buildWpblRacesBlob", () => {
  it("builds series for leaders present in the player map", () => {
    const leaders: WpblLeadersResponse = {
      ...emptyLeaders,
      batting: {
        ...emptyLeaders.batting,
        hr: [
          {
            playerId: "p1",
            name: "A",
            teamAbbr: "LA",
            value: "3",
            sortValue: 3,
            position: "CF",
            headshotUrl: null,
          },
        ],
      },
    };

    const player: WpblPlayerDetailResponse = {
      updatedAt: "2026-09-01T00:00:00.000Z",
      seasonId: "season",
      partial: false,
      player: {
        id: "p1",
        name: "A",
        firstName: "A",
        lastName: "",
        teamId: "t",
        teamAbbr: "LA",
        teamName: "Queens",
        position: "CF",
        uniform: null,
        bats: null,
        throws: null,
        hometown: null,
        birthdate: null,
        status: null,
        headshotUrl: null,
        profileUrl: null,
      },
      season: {
        sourceThrough: null,
        batting: null,
        pitching: null,
        fielding: null,
      },
      gameLog: [
        logEntry({
          gameId: "g1",
          startIso: "2026-08-15T18:00:00Z",
          batting: { hr: 3, ab: 4, h: 3, r: 3, rbi: 3, bb: 0, so: 0 },
        }),
      ],
    };

    const blob = buildWpblRacesBlob({
      leaders,
      playersById: new Map([["p1", player]]),
    });

    expect(blob.races.hr).toHaveLength(1);
    expect(blob.races.hr[0]?.total).toBe(3);
    expect(racePlayerIdsToLoad(leaders)).toEqual(["p1"]);
  });

  it("marks partial when a leader player is missing", () => {
    const leaders: WpblLeadersResponse = {
      ...emptyLeaders,
      batting: {
        ...emptyLeaders.batting,
        hr: [
          {
            playerId: "missing",
            name: "Ghost",
            teamAbbr: "NY",
            value: "1",
            sortValue: 1,
            position: null,
            headshotUrl: null,
          },
        ],
      },
    };
    const blob = buildWpblRacesBlob({
      leaders,
      playersById: new Map(),
    });
    expect(blob.partial).toBe(true);
    expect(blob.races.hr).toEqual([]);
  });
});

describe("buildRaceSeriesForPlayer", () => {
  it("returns null when there are no dated games", () => {
    expect(
      buildRaceSeriesForPlayer(
        { id: "p", name: "P", teamAbbr: "SF", headshotUrl: null },
        [],
        "hr",
      ),
    ).toBeNull();
  });
});
