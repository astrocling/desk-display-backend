import { describe, expect, it } from "vitest";

import type { WpblPlay } from "@/lib/types/wpbl-display";
import {
  filterWpblPlays,
  formatPlayInning,
  latestWpblPlay,
  shortRunnerLabel,
} from "@/lib/wpbl-plays";

function play(partial: Partial<WpblPlay> & Pick<WpblPlay, "sequence" | "narrative">): WpblPlay {
  return {
    inning: 1,
    half: "top",
    outs: 0,
    batterName: null,
    pitcherName: null,
    runnerFirst: null,
    runnerSecond: null,
    runnerThird: null,
    eventType: "unknown",
    isHit: false,
    isScoringPlay: false,
    runsScored: 0,
    pitchSequence: null,
    pitchEvents: [],
    finalBalls: null,
    finalStrikes: null,
    finalFouls: null,
    ...partial,
  };
}

describe("latestWpblPlay", () => {
  it("returns null for empty list", () => {
    expect(latestWpblPlay([])).toBeNull();
  });

  it("picks highest sequence even if unsorted", () => {
    const latest = latestWpblPlay([
      play({ sequence: 3, narrative: "c" }),
      play({ sequence: 10, narrative: "latest" }),
      play({ sequence: 1, narrative: "a" }),
    ]);
    expect(latest?.narrative).toBe("latest");
  });
});

describe("filterWpblPlays", () => {
  const plays = [
    play({ sequence: 1, narrative: "a" }),
    play({
      sequence: 2,
      narrative: "score",
      isScoringPlay: true,
      runsScored: 1,
    }),
    play({ sequence: 3, narrative: "b" }),
  ];

  it("returns newest-first for all plays", () => {
    expect(filterWpblPlays(plays, "all").map((p) => p.sequence)).toEqual([
      3, 2, 1,
    ]);
  });

  it("filters scoring plays newest-first", () => {
    expect(filterWpblPlays(plays, "scoring").map((p) => p.sequence)).toEqual([
      2,
    ]);
  });
});

describe("formatPlayInning / shortRunnerLabel", () => {
  it("formats half-inning labels", () => {
    expect(formatPlayInning(play({ sequence: 1, narrative: "x", half: "bottom", inning: 5 }))).toBe(
      "Bot 5",
    );
    expect(formatPlayInning(play({ sequence: 1, narrative: "x", half: null, inning: 2 }))).toBe(
      "Inn 2",
    );
  });

  it("shortens runner names to last token", () => {
    expect(shortRunnerLabel("Mo'ne Davis")).toBe("Davis");
    expect(shortRunnerLabel("  ")).toBeNull();
  });
});
