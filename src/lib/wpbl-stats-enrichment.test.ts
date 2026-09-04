import { describe, expect, it } from "vitest";

import {
  buildCyWatch,
  buildMvpWatch,
  buildTeamSeries,
} from "@/lib/wpbl-stats-enrichment";
import type {
  WpblLeadersResponse,
  WpblScheduleGame,
} from "@/lib/types/wpbl-display";
import {
  rankAndFilterEntries,
} from "@/components/wpbl/leadersCategories";

const leaders = {
  updatedAt: "2026-09-01T00:00:00.000Z",
  seasonId: "season",
  partial: false,
  qualifiers: { battingMinAb: 10, pitchingMinOuts: 9 },
  dataNotes: [],
  batting: {
    avg: [
      {
        playerId: "a",
        name: "Alice",
        teamAbbr: "LA",
        value: ".350",
        sortValue: 0.35,
        position: "CF",
        headshotUrl: null,
      },
    ],
    obp: [],
    slg: [],
    ops: [
      {
        playerId: "a",
        name: "Alice",
        teamAbbr: "LA",
        value: "1.000",
        sortValue: 1,
        position: "CF",
        headshotUrl: null,
      },
      {
        playerId: "b",
        name: "Bea",
        teamAbbr: "NY",
        value: ".800",
        sortValue: 0.8,
        position: "SS",
        headshotUrl: null,
      },
    ],
    hr: [
      {
        playerId: "b",
        name: "Bea",
        teamAbbr: "NY",
        value: "5",
        sortValue: 5,
        position: "SS",
        headshotUrl: null,
      },
      {
        playerId: "a",
        name: "Alice",
        teamAbbr: "LA",
        value: "2",
        sortValue: 2,
        position: "CF",
        headshotUrl: null,
      },
    ],
    rbi: [
      {
        playerId: "b",
        name: "Bea",
        teamAbbr: "NY",
        value: "12",
        sortValue: 12,
        position: "SS",
        headshotUrl: null,
      },
    ],
    h: [],
    r: [],
    doubles: [],
    sb: [],
  },
  pitching: {
    era: [
      {
        playerId: "p1",
        name: "Pat",
        teamAbbr: "SF",
        value: "1.50",
        sortValue: 1.5,
        position: "P",
        headshotUrl: null,
      },
    ],
    whip: [
      {
        playerId: "p1",
        name: "Pat",
        teamAbbr: "SF",
        value: "0.90",
        sortValue: 0.9,
        position: "P",
        headshotUrl: null,
      },
    ],
    ip: [
      {
        playerId: "p1",
        name: "Pat",
        teamAbbr: "SF",
        value: "20.0",
        sortValue: 60,
        position: "P",
        headshotUrl: null,
      },
    ],
    so: [
      {
        playerId: "p1",
        name: "Pat",
        teamAbbr: "SF",
        value: "25",
        sortValue: 25,
        position: "P",
        headshotUrl: null,
      },
    ],
    w: [
      {
        playerId: "p1",
        name: "Pat",
        teamAbbr: "SF",
        value: "3",
        sortValue: 3,
        position: "P",
        headshotUrl: null,
      },
    ],
    l: [],
    sv: [],
  },
} satisfies WpblLeadersResponse;

describe("award watch", () => {
  it("ranks MVP candidates with transparent scoring", () => {
    const mvp = buildMvpWatch(leaders, 5);
    expect(mvp[0]?.playerId).toBe("b");
    expect(mvp.some((c) => c.playerId === "a")).toBe(true);
  });

  it("ranks Cy candidates", () => {
    const cy = buildCyWatch(leaders, 3);
    expect(cy[0]?.playerId).toBe("p1");
    expect(cy[0]?.score).toBeGreaterThan(0);
  });
});

describe("buildTeamSeries", () => {
  it("tallies final head-to-head results", () => {
    const games: WpblScheduleGame[] = [
      {
        id: "1",
        status: "final",
        startIso: "2026-08-01T00:00:00Z",
        whenEt: null,
        awayAbbr: "LA",
        homeAbbr: "NY",
        awayName: "Queens",
        homeName: "Heights",
        awayRuns: 5,
        homeRuns: 3,
        venue: null,
        countsInStandings: true,
        gameType: "regular",
      },
      {
        id: "2",
        status: "final",
        startIso: "2026-08-02T00:00:00Z",
        whenEt: null,
        awayAbbr: "NY",
        homeAbbr: "LA",
        awayName: "Heights",
        homeName: "Queens",
        awayRuns: 4,
        homeRuns: 2,
        venue: null,
        countsInStandings: true,
        gameType: "regular",
      },
      {
        id: "3",
        status: "scheduled",
        startIso: "2026-09-10T00:00:00Z",
        whenEt: null,
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
    ];

    const series = buildTeamSeries(games);
    const lan = series.find((s) => s.teamA === "LA" && s.teamB === "NY");
    expect(lan).toMatchObject({
      aWins: 1,
      bWins: 1,
      gamesPlayed: 2,
      aRuns: 7,
      bRuns: 7,
    });
  });
});

describe("rankAndFilterEntries", () => {
  it("keeps league rank when filtering by team", () => {
    const ranked = rankAndFilterEntries(leaders.batting.hr, "LA", 10);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.leagueRank).toBe(2);
    expect(ranked[0]?.playerId).toBe("a");
  });
});
