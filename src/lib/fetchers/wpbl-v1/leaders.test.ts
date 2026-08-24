import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BATTING_MIN_AB,
  buildWpblLeaders,
  LEADERS_BOARD_STORE_LIMIT,
  leadersBlobNeedsRebuild,
  mapPlayerStatsToInput,
  normalizeWpblLeadersBlob,
  PITCHING_MIN_OUTS,
  rosterPlayerName,
  WPBL_LEADERS_DATA_NOTES,
  WPBL_LEADERS_SCHEMA_VERSION,
  type WpblPlayerSeasonInput,
} from "./leaders";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

function batting(
  partial: Partial<WpblPlayerSeasonInput["batting"]> &
    Pick<WpblPlayerSeasonInput["batting"], "at_bats" | "hits" | "home_runs" | "rbi">,
): WpblPlayerSeasonInput["batting"] {
  return {
    doubles: 0,
    triples: 0,
    runs: 0,
    walks: 0,
    hit_by_pitch: 0,
    sacrifice_flies: 0,
    stolen_bases: 0,
    ...partial,
  };
}

function pitching(
  partial: Partial<WpblPlayerSeasonInput["pitching"]> &
    Pick<
      WpblPlayerSeasonInput["pitching"],
      "outs_pitched" | "era" | "strikeouts" | "wins" | "saves"
    >,
): WpblPlayerSeasonInput["pitching"] {
  return {
    losses: 0,
    hits_allowed: 0,
    walks: 0,
    ...partial,
  };
}

const players: WpblPlayerSeasonInput[] = [
  {
    playerId: "p1",
    name: "High Avg",
    teamId: "vhubhz8li07tmgq8",
    batting: batting({
      at_bats: 20,
      hits: 8,
      home_runs: 1,
      rbi: 5,
      walks: 4,
      hit_by_pitch: 0,
      sacrifice_flies: 0,
      doubles: 2,
      stolen_bases: 3,
      runs: 6,
    }),
    pitching: pitching({
      outs_pitched: 0,
      era: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
    }),
  },
  {
    playerId: "p2",
    name: "Tiny Sample",
    teamId: "v4gisr4rbgmn67b0",
    batting: batting({ at_bats: 4, hits: 3, home_runs: 2, rbi: 4 }),
    pitching: pitching({
      outs_pitched: 0,
      era: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
    }),
  },
  {
    playerId: "p3",
    name: "Ace",
    teamId: "fttth861nft1j2s7",
    batting: batting({ at_bats: 0, hits: 0, home_runs: 0, rbi: 0 }),
    pitching: pitching({
      outs_pitched: 30,
      era: 1.8,
      strikeouts: 10,
      wins: 2,
      saves: 0,
      hits_allowed: 8,
      walks: 2,
      losses: 1,
    }),
  },
  {
    playerId: "p4",
    name: "Reliever",
    teamId: "vhubhz8li07tmgq8",
    batting: batting({ at_bats: 0, hits: 0, home_runs: 0, rbi: 0 }),
    pitching: pitching({
      outs_pitched: 2,
      era: 0,
      strikeouts: 1,
      wins: 0,
      saves: 0,
    }),
  },
];

const fixturePlayers = JSON.parse(
  readFileSync(join(fixtureDir, "fixtures/player-stats-sample.json"), "utf8"),
) as WpblPlayerSeasonInput[];

const teamPlayersFixture = JSON.parse(
  readFileSync(join(fixtureDir, "fixtures/team-players-trimmed.json"), "utf8"),
);

const playerStatsApiFixture = JSON.parse(
  readFileSync(join(fixtureDir, "fixtures/player-stats-api-trimmed.json"), "utf8"),
);

describe("buildWpblLeaders", () => {
  it("excludes sub-qualifier AVG but still ranks HR", () => {
    const leaders = buildWpblLeaders(players);
    expect(BATTING_MIN_AB).toBe(10);
    expect(leaders.batting.avg.map((e) => e.playerId)).toEqual(["p1"]);
    expect(leaders.batting.avg[0].value).toBe(".400");
    expect(leaders.batting.hr[0].playerId).toBe("p2");
    expect(leaders.pitching.era[0]).toMatchObject({
      playerId: "p3",
      value: "1.80",
      teamAbbr: "NY",
    });
    expect(leaders.qualifiers.battingMinAb).toBe(10);
    expect(leaders.qualifiers.pitchingMinOuts).toBe(9);
    expect(leaders.partial).toBe(false);
    expect(leaders.schemaVersion).toBe(WPBL_LEADERS_SCHEMA_VERSION);
    expect(leaders.dataNotes).toEqual(WPBL_LEADERS_DATA_NOTES);
  });

  it("excludes sub-qualifier ERA but still ranks SO", () => {
    const leaders = buildWpblLeaders(players);
    expect(PITCHING_MIN_OUTS).toBe(9);
    expect(leaders.pitching.era.map((e) => e.playerId)).toEqual(["p3"]);
    expect(leaders.pitching.so.map((e) => e.playerId)).toContain("p4");
  });

  it("ranks OBP/OPS/IP/WHIP from confident counting fields", () => {
    const leaders = buildWpblLeaders(players);
    // OBP = (8+4)/(20+4) = .500 — ignores unreliable PA
    expect(leaders.batting.obp[0]).toMatchObject({
      playerId: "p1",
      value: ".500",
    });
    expect(leaders.batting.ops[0].playerId).toBe("p1");
    expect(leaders.batting.sb[0]).toMatchObject({ playerId: "p1", value: "3" });
    expect(leaders.pitching.ip[0]).toMatchObject({
      playerId: "p3",
      value: "10.0",
    });
    // WHIP = (8+2)/10 = 1.00
    expect(leaders.pitching.whip[0]).toMatchObject({
      playerId: "p3",
      value: "1.00",
    });
    expect(leaders.pitching.l[0]).toMatchObject({ playerId: "p3", value: "1" });
    expect(leaders.pitching.ip.map((e) => e.playerId)).not.toContain("p4");
  });

  it("normalizes older Redis blobs missing new boards", () => {
    const legacy = {
      updatedAt: "2026-08-21T12:00:00.000Z",
      seasonId: "c9sgab9f9yx00z75",
      partial: false,
      qualifiers: { battingMinAb: 10, pitchingMinOuts: 9 },
      batting: {
        avg: [
          {
            playerId: "p1",
            name: "A",
            teamAbbr: "SF",
            value: ".400",
            sortValue: 0.4,
            position: null,
            headshotUrl: null,
          },
        ],
        hr: [],
        rbi: [],
        h: [],
      },
      pitching: {
        era: [
          {
            playerId: "p2",
            name: "P",
            teamAbbr: "NY",
            value: "2.00",
            sortValue: 2,
            position: "P",
            headshotUrl: null,
          },
        ],
        so: [],
        w: [],
        sv: [],
      },
    } as unknown as import("@/lib/types/wpbl-display").WpblLeadersResponse;

    expect(leadersBlobNeedsRebuild(legacy)).toBe(true);

    const normalized = normalizeWpblLeadersBlob(legacy);
    expect(normalized.batting.obp).toEqual([]);
    expect(normalized.pitching.ip).toEqual([]);
    expect(normalized.batting.avg).toHaveLength(1);
    expect(normalized.schemaVersion).toBe(1);
    expect(normalized.dataNotes).toEqual(WPBL_LEADERS_DATA_NOTES);
  });

  it("does not rebuild current-schema blobs with enriched boards", () => {
    const leaders = buildWpblLeaders(players);
    expect(leadersBlobNeedsRebuild({
      ...leaders,
      updatedAt: "2026-08-21T12:00:00.000Z",
      seasonId: "c9sgab9f9yx00z75",
    })).toBe(false);
  });

  it("stores up to 50 entries per board", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      playerId: `p${i}`,
      name: `Player ${i}`,
      teamId: "vhubhz8li07tmgq8",
      batting: batting({ at_bats: 20, hits: i, home_runs: i, rbi: i }),
      pitching: pitching({
        outs_pitched: 0,
        era: 0,
        strikeouts: 0,
        wins: 0,
        saves: 0,
      }),
    }));
    const leaders = buildWpblLeaders(many);
    expect(LEADERS_BOARD_STORE_LIMIT).toBe(50);
    expect(leaders.batting.hr).toHaveLength(50);
    expect(leaders.batting.hr[0].sortValue).toBeGreaterThan(
      leaders.batting.hr.at(-1)?.sortValue ?? 0,
    );
  });

  it("ranks fixture players with non-zero AVG and HR leaders", () => {
    const leaders = buildWpblLeaders(fixturePlayers);
    expect(leaders.batting.avg.length).toBeGreaterThan(0);
    expect(leaders.batting.hr.length).toBeGreaterThan(0);
    expect(leaders.pitching.era[0].sortValue).toBeLessThanOrEqual(
      leaders.pitching.era.at(-1)?.sortValue ?? Infinity,
    );
    expect(leaders.pitching.ip[0].playerId).toBe("p-bos-starter");
    expect(leaders.batting.sb[0].playerId).toBe("jc062foc8ijjn7d2");
  });
});

describe("mapPlayerStatsToInput", () => {
  it("maps live API field names from trimmed fixtures", () => {
    const rosterPlayer = teamPlayersFixture.players[0];
    expect(rosterPlayerName(rosterPlayer)).toBe("Jill Albayati");

    const mapped = mapPlayerStatsToInput(
      playerStatsApiFixture,
      rosterPlayer.team_id,
      rosterPlayerName(rosterPlayer),
      {
        position: rosterPlayer.position,
        headshotUrl: "https://example.com/jill.webp",
      },
    );

    expect(mapped).toMatchObject({
      playerId: "bpyqct4a85lh306g",
      name: "Jill Albayati",
      teamId: "vhubhz8li07tmgq8",
      position: "P/UT.",
      headshotUrl: "https://example.com/jill.webp",
      batting: {
        at_bats: 27,
        hits: 11,
        doubles: 5,
        home_runs: 1,
        rbi: 7,
        runs: 9,
        walks: 6,
        hit_by_pitch: 1,
        stolen_bases: 0,
      },
      pitching: {
        outs_pitched: 30,
        era: 1.8,
        strikeouts: 10,
        wins: 2,
        losses: 0,
        saves: 0,
        hits_allowed: 11,
        walks: 3,
      },
    });

    const leaders = buildWpblLeaders([mapped]);
    expect(leaders.batting.avg[0].value).toBe(".407");
    expect(leaders.batting.hr[0].value).toBe("1");
    expect(leaders.pitching.ip[0].value).toBe("10.0");
    expect(leaders.pitching.whip[0].value).toBe("1.40");
    expect(leaders.batting.avg[0].headshotUrl).toBe(
      "https://example.com/jill.webp",
    );
    expect(leaders.batting.avg[0].position).toBe("P/UT.");
  });
});
