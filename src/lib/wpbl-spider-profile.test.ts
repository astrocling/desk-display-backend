import { describe, expect, it } from "vitest";

import type {
  WpblLeaderEntry,
  WpblLeadersResponse,
  WpblPlayerBattingSeason,
  WpblPlayerPitchingSeason,
} from "@/lib/types/wpbl-display";
import {
  buildPlayerSpiderProfiles,
  parseStatNumber,
  percentileRank,
} from "@/lib/wpbl-spider-profile";

function entry(sortValue: number, playerId = "x"): WpblLeaderEntry {
  return {
    playerId,
    name: playerId,
    teamAbbr: "SF",
    value: String(sortValue),
    sortValue,
    position: null,
    headshotUrl: null,
  };
}

function emptyLeaders(
  overrides: Partial<WpblLeadersResponse> = {},
): WpblLeadersResponse {
  return {
    updatedAt: "2026-09-05T00:00:00.000Z",
    seasonId: "season",
    schemaVersion: 2,
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
    ...overrides,
  };
}

describe("percentileRank", () => {
  it("ranks mid-pack values near the 50th percentile", () => {
    expect(percentileRank(5, [1, 3, 5, 7, 9])).toBe(50);
  });

  it("gives a high percentile to the top value when higher is better", () => {
    expect(percentileRank(9, [1, 3, 5, 7, 9])).toBe(90);
  });

  it("inverts ERA-style axes so lower is stronger", () => {
    expect(percentileRank(1, [1, 2, 3, 4, 5], false)).toBe(90);
    expect(percentileRank(5, [1, 2, 3, 4, 5], false)).toBe(10);
  });

  it("returns null for empty populations", () => {
    expect(percentileRank(1, [])).toBeNull();
  });
});

describe("parseStatNumber", () => {
  it("parses leading-dot batting rates", () => {
    expect(parseStatNumber(".312")).toBeCloseTo(0.312);
  });

  it("parses ERA / WHIP strings", () => {
    expect(parseStatNumber("1.93")).toBeCloseTo(1.93);
  });
});

describe("buildPlayerSpiderProfiles", () => {
  const batting: WpblPlayerBattingSeason = {
    g: 12,
    ab: 40,
    r: 8,
    h: 14,
    doubles: 3,
    triples: 0,
    hr: 2,
    rbi: 9,
    bb: 5,
    so: 6,
    hbp: 1,
    sf: 0,
    sb: 4,
    cs: 1,
    avg: ".350",
    obp: ".426",
    slg: ".525",
    ops: ".951",
  };

  const pitching: WpblPlayerPitchingSeason = {
    g: 5,
    gs: 3,
    w: 2,
    l: 1,
    sv: 0,
    ip: "15.0",
    h: 12,
    r: 4,
    er: 3,
    bb: 3,
    so: 18,
    hr: 1,
    era: "1.80",
    whip: "1.00",
  };

  it("builds batting axes against leader boards", () => {
    const leaders = emptyLeaders({
      batting: {
        avg: [entry(0.2), entry(0.3), entry(0.35), entry(0.4)],
        obp: [entry(0.3), entry(0.4), entry(0.426), entry(0.5)],
        slg: [entry(0.4), entry(0.5), entry(0.525), entry(0.6)],
        ops: [entry(0.7), entry(0.9), entry(0.951), entry(1.1)],
        hr: [entry(0), entry(1), entry(2), entry(5)],
        rbi: [entry(2), entry(5), entry(9), entry(12)],
        h: [],
        r: [],
        doubles: [],
        sb: [entry(0), entry(2), entry(4), entry(8)],
      },
    });

    const profiles = buildPlayerSpiderProfiles(
      { batting, pitching: null },
      leaders,
    );
    expect(profiles.batting).not.toBeNull();
    expect(profiles.batting!.qualified).toBe(true);
    expect(profiles.batting!.axes.map((a) => a.id)).toEqual([
      "avg",
      "obp",
      "slg",
      "ops",
      "hr",
      "rbi",
      "sb",
    ]);
    expect(profiles.pitching).toBeNull();
  });

  it("omits rate axes when under the AB qualifier", () => {
    const leaders = emptyLeaders({
      batting: {
        avg: [entry(0.3)],
        obp: [entry(0.4)],
        slg: [entry(0.5)],
        ops: [entry(0.9)],
        hr: [entry(0), entry(1), entry(2)],
        rbi: [entry(1), entry(5), entry(9)],
        h: [],
        r: [],
        doubles: [],
        sb: [entry(0), entry(2), entry(4)],
      },
    });

    const profiles = buildPlayerSpiderProfiles(
      { batting: { ...batting, ab: 5 }, pitching: null },
      leaders,
    );
    expect(profiles.batting).not.toBeNull();
    expect(profiles.batting!.qualified).toBe(false);
    expect(profiles.batting!.axes.map((a) => a.id)).toEqual([
      "hr",
      "rbi",
      "sb",
    ]);
  });

  it("builds pitching axes with inverted ERA/WHIP strength", () => {
    const leaders = emptyLeaders({
      pitching: {
        era: [entry(1.5), entry(1.8), entry(3.0), entry(5.0)],
        whip: [entry(0.9), entry(1.0), entry(1.3), entry(1.6)],
        ip: [entry(9), entry(30), entry(45), entry(60)],
        so: [entry(5), entry(10), entry(18), entry(25)],
        w: [entry(0), entry(1), entry(2), entry(4)],
        l: [],
        sv: [entry(0), entry(1), entry(3)],
      },
    });

    const profiles = buildPlayerSpiderProfiles(
      { batting: null, pitching },
      leaders,
    );
    expect(profiles.pitching).not.toBeNull();
    const era = profiles.pitching!.axes.find((a) => a.id === "era");
    const whip = profiles.pitching!.axes.find((a) => a.id === "whip");
    expect(era?.percentile).toBeGreaterThan(50);
    expect(whip?.percentile).toBeGreaterThan(50);
  });

  it("returns null sides when fewer than three axes plot", () => {
    const leaders = emptyLeaders({
      batting: {
        avg: [],
        obp: [],
        slg: [],
        ops: [],
        hr: [entry(2)],
        rbi: [],
        h: [],
        r: [],
        doubles: [],
        sb: [],
      },
    });
    const profiles = buildPlayerSpiderProfiles(
      { batting, pitching: null },
      leaders,
    );
    expect(profiles.batting).toBeNull();
  });
});
