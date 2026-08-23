import { describe, expect, it } from "vitest";

import type { WpblPlay } from "@/lib/types/wpbl-display";

import {
  basesStateKey,
  buildPlayTimeline,
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
    expect(
      isAdministrativePlay(
        play({
          sequence: 2,
          narrative: "Pinch hit for Jamie Mackay.",
          batterName: "Mo'ne Davis",
        }),
      ),
    ).toBe(true);
  });

  it("does not treat outs to a fielder as substitutions", () => {
    expect(
      isAdministrativePlay(
        play({
          sequence: 1,
          narrative: "London Studer lined out to 3b (0-1 K).",
          batterName: "London Studer",
        }),
      ),
    ).toBe(false);
    expect(
      isAdministrativePlay(
        play({
          sequence: 2,
          narrative: "Claire O'Sullivan flied out to cf (1-0 B).",
          batterName: "Claire O'Sullivan",
        }),
      ),
    ).toBe(false);
    expect(
      playTypeLabel(
        play({
          sequence: 3,
          narrative: "London Studer lined out to 3b (0-1 K).",
        }),
      ),
    ).toBe("Lineout");
  });
});

describe("buildPlayTimeline", () => {
  it("attaches each play's before-state bases under that play (not the next at-bat)", () => {
    // Newest-first: post-HR AB, then Lansdell HR with runners on 2nd/3rd.
    const afterHr = play({
      sequence: 12,
      narrative: "Next batter grounds out.",
      batterName: "Next Batter",
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
    });
    const hr = play({
      sequence: 11,
      narrative: "Ashton Lansdell homers to left; runners score.",
      batterName: "Ashton Lansdell",
      eventType: "home_run",
      isScoringPlay: true,
      runsScored: 3,
      runnerFirst: null,
      runnerSecond: "Runner Two",
      runnerThird: "Runner Three",
    });

    const items = buildPlayTimeline([afterHr, hr]);

    expect(items.map((item) => item.kind)).toEqual([
      "play",
      "bases",
      "play",
      "bases",
    ]);
    expect(items[0]).toMatchObject({ kind: "play", play: { sequence: 12 } });
    expect(items[1]).toMatchObject({
      kind: "bases",
      play: { sequence: 12 },
      key: "||",
    });
    expect(items[2]).toMatchObject({ kind: "play", play: { sequence: 11 } });
    expect(items[3]).toMatchObject({
      kind: "bases",
      play: { sequence: 11 },
      key: "|Runner Two|Runner Three",
    });
    expect(formatBasesState(hr)).toBe("Two on 2nd, Three on 3rd");
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
