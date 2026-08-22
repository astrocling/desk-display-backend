import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  computeAvg,
  computeObp,
  computeOps,
  computeSlg,
  computeWhip,
  ipToOuts,
  outsToIp,
} from "./player-rates";
import {
  mapBattingSeason,
  mapFieldingSeason,
  mapPitchingSeason,
  mapPlayerDetail,
  mapPlayerGameLog,
  type WpblApiPlayerGames,
  type WpblApiPlayerProfile,
  type WpblApiPlayerSeasonStats,
} from "./player";

const dir = dirname(fileURLToPath(import.meta.url));

const profile = JSON.parse(
  readFileSync(join(dir, "fixtures/player-profile-albayati.json"), "utf8"),
) as WpblApiPlayerProfile;

const stats = JSON.parse(
  readFileSync(join(dir, "fixtures/player-stats-albayati.json"), "utf8"),
) as WpblApiPlayerSeasonStats;

const games = JSON.parse(
  readFileSync(join(dir, "fixtures/player-games-albayati.json"), "utf8"),
) as WpblApiPlayerGames;

describe("player-rates", () => {
  it("formats AVG like leaders", () => {
    expect(computeAvg(13, 32)).toBe(".406");
  });

  it("computes OBP with SF in the denominator", () => {
    expect(
      computeObp({ hits: 13, walks: 6, hbp: 1, atBats: 32, sf: 0 }),
    ).toBe(".513");
  });

  it("computes SLG from components when total_bases is 0", () => {
    // 13 H, 6 2B, 0 3B, 1 HR → 1B=6 → TB = 6 + 12 + 0 + 4 = 22
    expect(
      computeSlg({
        hits: 13,
        doubles: 6,
        triples: 0,
        homeRuns: 1,
        atBats: 32,
        totalBases: 0,
      }),
    ).toBe(".688");
  });

  it("computes OPS from OBP + SLG strings", () => {
    expect(computeOps(".513", ".688")).toBe("1.201");
  });

  it("computes WHIP from outs", () => {
    // 11 H + 3 BB over 30 outs (10 IP) → 1.40
    expect(computeWhip(11, 3, 30)).toBe("1.40");
  });

  it("converts outs ↔ IP", () => {
    expect(outsToIp(31)).toBe("10.1");
    expect(ipToOuts("10.1")).toBe(31);
    expect(ipToOuts("10.0")).toBe(30);
  });
});

describe("map season groups", () => {
  it("maps batting with computed rates from Albayati fixture", () => {
    const batting = mapBattingSeason(stats.batting);
    expect(batting).toMatchObject({
      g: 9,
      ab: 32,
      h: 13,
      doubles: 6,
      hr: 1,
      rbi: 7,
      avg: ".406",
      obp: ".513",
      slg: ".688",
      ops: "1.201",
    });
  });

  it("maps pitching with ERA and WHIP", () => {
    const pitching = mapPitchingSeason(stats.pitching);
    expect(pitching).toMatchObject({
      g: 3,
      gs: 2,
      w: 2,
      l: 0,
      ip: "10.0",
      so: 10,
      era: "1.80",
      whip: "1.40",
    });
  });

  it("maps fielding percentage", () => {
    const fielding = mapFieldingSeason(stats.fielding);
    expect(fielding).toMatchObject({
      g: 9,
      po: 7,
      a: 10,
      e: 1,
      fpct: ".944",
    });
  });

  it("returns null when a group has no activity", () => {
    expect(mapBattingSeason({ at_bats: 0, hits: 0, games_played: 0 })).toBeNull();
    expect(
      mapPitchingSeason({ outs_pitched: 0, games_played: 0 }),
    ).toBeNull();
  });
});

describe("mapPlayerGameLog", () => {
  it("sorts newest first and maps batting/pitching lines", () => {
    const log = mapPlayerGameLog(games.games);
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].gameId).toBeTruthy();
    expect(log.some((g) => g.pitching != null)).toBe(true);
    expect(log.some((g) => g.batting != null)).toBe(true);

    const withPitch = log.find((g) => g.pitching != null);
    expect(withPitch?.pitching).toMatchObject({
      ip: "4.0",
      so: "5",
    });
    expect(withPitch?.opponentAbbr).toMatch(/^(LA|NY|SF|BOS)$/);
  });
});

describe("mapPlayerDetail", () => {
  it("assembles identity + season + log", () => {
    const detail = mapPlayerDetail({
      profile,
      stats,
      games,
      headshotMap: new Map(),
      seasonId: "c9sgab9f9yx00z75",
      partial: false,
    });

    expect(detail.player).toMatchObject({
      id: "bpyqct4a85lh306g",
      name: "Jill Albayati",
      teamAbbr: "SF",
      teamName: "Firebells",
      position: "P/UT.",
      uniform: "18",
      bats: "R",
      throws: "R",
      hometown: "Anaheim, Calif.",
    });
    expect(detail.season.batting?.avg).toBe(".406");
    expect(detail.season.pitching?.era).toBe("1.80");
    expect(detail.season.fielding?.fpct).toBe(".944");
    expect(detail.gameLog.length).toBeGreaterThan(0);
    expect(detail.partial).toBe(false);
  });

  it("tolerates missing stats/games as partial empty season", () => {
    const detail = mapPlayerDetail({
      profile,
      stats: null,
      games: null,
      headshotMap: new Map([["bpyqct4a85lh306g", "https://example.com/h.jpg"]]),
      seasonId: "c9sgab9f9yx00z75",
      partial: true,
    });
    expect(detail.partial).toBe(true);
    expect(detail.season.batting).toBeNull();
    expect(detail.gameLog).toEqual([]);
    expect(detail.player.headshotUrl).toBe("https://example.com/h.jpg");
  });
});
