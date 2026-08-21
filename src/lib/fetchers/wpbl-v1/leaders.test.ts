import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BATTING_MIN_AB, buildWpblLeaders } from "./leaders";

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
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/player-stats-sample.json"),
    "utf8",
  ),
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

  it("ranks fixture players and caps boards at 10", () => {
    const leaders = buildWpblLeaders(fixturePlayers);
    expect(leaders.batting.avg.length).toBeLessThanOrEqual(10);
    expect(leaders.pitching.era[0].sortValue).toBeLessThanOrEqual(
      leaders.pitching.era.at(-1)?.sortValue ?? Infinity,
    );
  });
});
