import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BATTING_MIN_AB,
  buildWpblLeaders,
  LEADERS_BOARD_STORE_LIMIT,
  mapPlayerStatsToInput,
  rosterPlayerName,
} from "./leaders";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

const players = [
  {
    playerId: "p1",
    name: "High Avg",
    teamId: "vhubhz8li07tmgq8",
    batting: { at_bats: 20, hits: 8, home_runs: 1, rbi: 5 },
    pitching: { outs_pitched: 0, era: 0, strikeouts: 0, wins: 0, saves: 0 },
  },
  {
    playerId: "p2",
    name: "Tiny Sample",
    teamId: "v4gisr4rbgmn67b0",
    batting: { at_bats: 4, hits: 3, home_runs: 2, rbi: 4 },
    pitching: { outs_pitched: 0, era: 0, strikeouts: 0, wins: 0, saves: 0 },
  },
  {
    playerId: "p3",
    name: "Ace",
    teamId: "fttth861nft1j2s7",
    batting: { at_bats: 0, hits: 0, home_runs: 0, rbi: 0 },
    pitching: { outs_pitched: 30, era: 1.8, strikeouts: 10, wins: 2, saves: 0 },
  },
];

const fixturePlayers = JSON.parse(
  readFileSync(join(fixtureDir, "fixtures/player-stats-sample.json"), "utf8"),
);

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
    expect(leaders.partial).toBe(false);
  });

  it("stores up to 50 entries per board", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      playerId: `p${i}`,
      name: `Player ${i}`,
      teamId: "vhubhz8li07tmgq8",
      batting: { at_bats: 20, hits: i, home_runs: i, rbi: i },
      pitching: { outs_pitched: 0, era: 0, strikeouts: 0, wins: 0, saves: 0 },
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
        home_runs: 1,
        rbi: 7,
      },
      pitching: {
        outs_pitched: 30,
        era: 1.8,
        strikeouts: 10,
        wins: 2,
        saves: 0,
      },
    });

    const leaders = buildWpblLeaders([mapped]);
    expect(leaders.batting.avg[0].value).toBe(".407");
    expect(leaders.batting.hr[0].value).toBe("1");
    expect(leaders.batting.avg[0].headshotUrl).toBe(
      "https://example.com/jill.webp",
    );
    expect(leaders.batting.avg[0].position).toBe("P/UT.");
  });
});
