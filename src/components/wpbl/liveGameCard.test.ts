import { describe, expect, it } from "vitest";

import type { WpblBoxPlayerLine, WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import {
  batterGameLine,
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
        position: "2b",
        stats: { ab: "2", h: "0", avg: ".000" },
      },
      {
        side: "home",
        name: "Ayami Sato",
        position: "p",
        stats: { ip: "5.1", era: "1.68" },
      },
    ];
    expect(findPlayerLine(lines, "Hondras")?.name).toBe("Amira Hondras");
    expect(findPlayerLine(lines, "Sato")?.stats.ip).toBe("5.1");
    expect(normalizePlayerName("Mo'ne Davis")).toBe("mo ne davis");
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
            position: "1b",
            stats: { ab: "2", h: "0", avg: ".250" },
          },
        ],
        pitching: [
          {
            side: "home",
            name: "Jacob Misiorowski",
            position: "p",
            stats: { ip: "5.1", era: "1.68" },
          },
        ],
      },
    };

    expect(keyPlayersFromDetail(detail)).toEqual({
      pitcherName: "Misiorowski",
      pitcherTeamAbbr: "MIL",
      pitcherStats: "5.1 IP · 1.68 ERA",
      batterName: "Olson",
      batterTeamAbbr: "ATL",
      batterStats: "0-2 · .250",
    });
    expect(batterGameLine(detail.boxscore.batting[0]!)).toBe("0-2");
  });
});
