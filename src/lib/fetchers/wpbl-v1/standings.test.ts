import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatGb, mapTeamStatsToStanding } from "./standings";

const sf = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/team-stats-sf.json"), "utf8"),
);

describe("mapTeamStatsToStanding", () => {
  it("maps standing block to display row", () => {
    expect(mapTeamStatsToStanding(sf)).toEqual({
      teamId: "vhubhz8li07tmgq8",
      abbr: "SF",
      name: "Firebells",
      rank: 1,
      w: 5,
      l: 3,
      t: 0,
      pct: ".625",
      gb: "—",
      rf: 76,
      ra: 53,
      diff: 23,
      l10: "5-3",
      streak: "L1",
      clinchedSeed: null,
    });
  });
});

describe("formatGb", () => {
  it("uses em dash for zero", () => {
    expect(formatGb(0)).toBe("—");
    expect(formatGb(0.5)).toBe("0.5");
    expect(formatGb(2)).toBe("2");
  });
});
