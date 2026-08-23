import { describe, expect, it } from "vitest";

import type { WpblPlay } from "@/lib/types/wpbl-display";

import {
  basesStateKey,
  formatBasesState,
  isAdministrativePlay,
  playTypeLabel,
} from "./wpbl-play-display";

function play(
  partial: Partial<WpblPlay> & Pick<WpblPlay, "sequence" | "narrative">,
): WpblPlay {
  return {
    inning: 1,
    half: "top",
    outs: 0,
    batterName: "Mo'ne Davis",
    pitcherName: "Kim",
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

describe("playTypeLabel", () => {
  it("maps structured event types", () => {
    expect(playTypeLabel(play({ sequence: 1, narrative: "x", eventType: "single" }))).toBe(
      "Single",
    );
    expect(playTypeLabel(play({ sequence: 2, narrative: "x", eventType: "home_run" }))).toBe(
      "Home Run",
    );
  });

  it("infers from narrative when event type is unknown", () => {
    expect(
      playTypeLabel(
        play({
          sequence: 1,
          narrative: "Bryce Harper homers (26) on a fly ball to right.",
        }),
      ),
    ).toBe("Home Run");
    expect(
      playTypeLabel(
        play({
          sequence: 2,
          narrative: "Trea Turner singled on a line drive to right field.",
        }),
      ),
    ).toBe("Single");
  });

  it("returns null for admin plays", () => {
    expect(
      playTypeLabel(play({ sequence: 1, narrative: "Maggie Fox to p.", batterName: null })),
    ).toBeNull();
  });
});

describe("isAdministrativePlay", () => {
  it("flags defensive substitutions", () => {
    expect(
      isAdministrativePlay(
        play({ sequence: 1, narrative: "Maggie Fox to p.", batterName: "Maggie Fox" }),
      ),
    ).toBe(true);
  });
});

describe("formatBasesState", () => {
  it("describes empty bases", () => {
    expect(formatBasesState(play({ sequence: 1, narrative: "x" }))).toBe("Bases empty");
  });

  it("lists occupied bases with short names", () => {
    expect(
      formatBasesState(
        play({
          sequence: 1,
          narrative: "x",
          runnerFirst: "Trea Turner",
          runnerThird: "Justin Crawford",
        }),
      ),
    ).toBe("Turner on 1st, Crawford on 3rd");
  });

  it("keys runner state for deduping", () => {
    const a = play({
      sequence: 1,
      narrative: "x",
      runnerFirst: "A",
      runnerSecond: "B",
    });
    const b = play({
      sequence: 2,
      narrative: "y",
      runnerFirst: "A",
      runnerSecond: "B",
    });
    expect(basesStateKey(a)).toBe(basesStateKey(b));
  });
});
