import { describe, expect, it } from "vitest";

import type { WpblBoxPlayerLine, WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import {
  batterGameLine,
  batterRateLine,
  findPlayerLine,
  keyPlayersFromDetail,
  normalizePlayerName,
} from "./liveGameCard";

describe("normalizePlayerName / findPlayerLine", () => {
  it("matches short last names to full boxscore names", () => {
    const lines: WpblBoxPlayerLine[] = [
      {
        side: "away",
        name: "Amira Hondras",
        playerId: "p1",
        position: "2b",
        battingOrder: null,
        uniform: null,
        headshotUrl: null,
        stats: { ab: "2", h: "0", avg: ".000" },
      },
      {
        side: "home",
        name: "Ayami Sato",
        playerId: "p2",
        position: "p",
        battingOrder: null,
        uniform: null,
        headshotUrl: null,
        stats: { ip: "5.1", era: "1.68" },
      },
    ];
    expect(findPlayerLine(lines, "Hondras")?.name).toBe("Amira Hondras");
    expect(findPlayerLine(lines, "Sato")?.stats.ip).toBe("5.1");
    expect(normalizePlayerName("Mo'ne Davis")).toBe("mo ne davis");
  });
});

describe("batterRateLine", () => {
  it("returns season avg when present", () => {
    expect(
      batterRateLine({
        side: "away",
        name: "Edith De Leija",
        playerId: "x",
        position: "cf",
        battingOrder: null,
        uniform: null,
        headshotUrl: null,
        stats: { ab: "0", h: "0", avg: ".286", obp: "1.000", slg: ".000" },
      }),
    ).toBe(".286");
  });

  it("does not treat game OBP+SLG as batting average", () => {
    expect(
      batterRateLine({
        side: "away",
        name: "Edith De Leija",
        playerId: "x",
        position: "cf",
        battingOrder: null,
        uniform: null,
        headshotUrl: null,
        stats: { ab: "0", h: "0", obp: "1.000", slg: ".000" },
      }),
    ).toBeNull();
  });
});

describe("keyPlayersFromDetail", () => {
  it("builds pitcher/batter lines from situation + boxscore", () => {
    const detail: WpblGameDetailResponse = {
      updatedAt: "2026-08-21T12:00:00.000Z",
      game: {
        id: "g1",
        status: "live",
        startIso: null,
        whenEt: null,
        awayAbbr: "ATL",
        homeAbbr: "MIL",
        awayName: "Braves",
        homeName: "Brewers",
        awayRuns: 0,
        homeRuns: 2,
        venue: null,
        countsInStandings: true,
        inning: "Top 6",
        situation: {
          inningNumber: 6,
          half: "top",
          balls: 1,
          strikes: 2,
          outs: 1,
          onFirst: false,
          onSecond: true,
          onThird: false,
          runnerFirst: null,
          runnerSecond: "Acuña",
          runnerThird: null,
          batterName: "Olson",
          pitcherName: "Misiorowski",
        },
      },
      boxscore: {
        available: true,
        lineScore: null,
        batting: [
          {
            side: "away",
            name: "Matt Olson",
            playerId: "batter-1",
            position: "1b",
            battingOrder: null,
            uniform: null,
            headshotUrl: null,
            stats: { ab: "2", h: "0", avg: ".250" },
          },
        ],
        pitching: [
          {
            side: "home",
            name: "Jacob Misiorowski",
            playerId: "pitcher-1",
            position: "p",
            battingOrder: null,
            uniform: null,
            headshotUrl: null,
            stats: { ip: "5.1", era: "1.68" },
          },
        ],
        plays: [],
      },
    };

    expect(keyPlayersFromDetail(detail)).toEqual({
      pitcherName: "Misiorowski",
      pitcherId: "pitcher-1",
      pitcherTeamAbbr: "MIL",
      pitcherStats: "5.1 IP · 1.68 ERA",
      pitcherHeadshotUrl: null,
      batterName: "Olson",
      batterId: "batter-1",
      batterTeamAbbr: "ATL",
      batterStats: "0-2 · .250",
      batterHeadshotUrl: null,
    });
    expect(batterGameLine(detail.boxscore.batting[0]!)).toBe("0-2");
  });

  it("omits rate when season avg was not enriched (avoids fake 1.000)", () => {
    const detail: WpblGameDetailResponse = {
      updatedAt: "2026-08-21T12:00:00.000Z",
      game: {
        id: "g1",
        status: "live",
        startIso: null,
        whenEt: null,
        awayAbbr: "SF",
        homeAbbr: "BOS",
        awayName: "Firebells",
        homeName: "Belles",
        awayRuns: 8,
        homeRuns: 2,
        venue: null,
        countsInStandings: true,
        inning: "Bot 3",
        situation: {
          inningNumber: 3,
          half: "bottom",
          balls: 1,
          strikes: 2,
          outs: 1,
          onFirst: false,
          onSecond: false,
          onThird: false,
          runnerFirst: null,
          runnerSecond: null,
          runnerThird: null,
          batterName: "Edith De Leija",
          pitcherName: "Niki Eckert",
        },
      },
      boxscore: {
        available: true,
        lineScore: null,
        batting: [
          {
            side: "home",
            name: "Edith De Leija",
            playerId: "edith",
            position: "lf",
            battingOrder: null,
            uniform: null,
            headshotUrl: null,
            // Game OBP/SLG only — the old bug summed these to 1.000
            stats: { ab: "0", h: "0", obp: "1.000", slg: ".000", ops: "1.000" },
          },
        ],
        pitching: [
          {
            side: "away",
            name: "Niki Eckert",
            playerId: "niki",
            position: "p",
            battingOrder: null,
            uniform: null,
            headshotUrl: null,
            stats: { ip: "2.1" },
          },
        ],
        plays: [],
      },
    };

    expect(keyPlayersFromDetail(detail).batterStats).toBe("0-0");
    expect(keyPlayersFromDetail(detail).pitcherStats).toBe("2.1 IP");
  });
});
