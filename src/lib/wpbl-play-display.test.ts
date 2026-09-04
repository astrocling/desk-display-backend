import { describe, expect, it } from "vitest";

import type { WpblPlay } from "@/lib/types/wpbl-display";

import {
  basesStateKey,
  buildPlayTimeline,
  countEnteringOutcome,
  enrichPlayNarrative,
  formatBasesState,
  formatHalfInningHeader,
  formatScoreLine,
  formatSituationalLine,
  groupPlaysByHalfInning,
  isAdministrativePlay,
  outsAfterPlay,
  playSummaryParts,
  playTypeLabel,
  runningScoresBySequence,
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

describe("enrichPlayNarrative / playSummaryParts", () => {
  it("rewrites WPBL copy toward MLB Gameday voice", () => {
    expect(
      enrichPlayNarrative(
        "Ashton Lansdell walked (3-2 BBBKFB); Mo'ne Davis advanced to second.",
      ),
    ).toBe("Ashton Lansdell walks. Mo'ne Davis to 2nd.");

    expect(
      enrichPlayNarrative(
        "Maggie Fox singled up the middle, 2 RBI (1-0 B); Ashton Lansdell scored, unearned; Mo'ne Davis scored, unearned.",
      ),
    ).toBe(
      "Maggie Fox singles up the middle, 2 RBI. Ashton Lansdell scores. Mo'ne Davis scores.",
    );

    expect(
      enrichPlayNarrative("Mo'ne Davis reached first on an error by ss (0-1 F)."),
    ).toBe("Mo'ne Davis reaches on an error by shortstop.");

    expect(
      enrichPlayNarrative("London Studer lined out to 3b (0-1 K)."),
    ).toBe("London Studer lines out to third baseman.");
  });

  it("appends resulting outs when the play records an out", () => {
    const summary = playSummaryParts(
      play({
        sequence: 1,
        narrative: "Braden Montgomery struck out swinging (1-2 FFS).",
        outs: 0,
        eventType: "strikeout",
        pitchSequence: "FFS",
        finalBalls: 0,
        finalStrikes: 3,
      }),
    );
    expect(summary.body).toBe("Braden Montgomery strikes out swinging.");
    expect(summary.outsPhrase).toBe("1 out");
  });

  it("uses MLB called-strike language for looking punchouts", () => {
    expect(
      enrichPlayNarrative("Jaida Lee struck out looking (1-2 CFS)."),
    ).toBe("Jaida Lee called out on strikes.");
  });
});

describe("situational count and half-inning grouping", () => {
  it("formats half-inning headers with ordinals", () => {
    expect(
      formatHalfInningHeader(play({ sequence: 1, narrative: "x", half: "top", inning: 3 })),
    ).toBe("Top 3rd");
    expect(
      formatHalfInningHeader(
        play({ sequence: 1, narrative: "x", half: "bottom", inning: 1 }),
      ),
    ).toBe("Bottom 1st");
  });

  it("groups newest-first plays by half-inning", () => {
    const groups = groupPlaysByHalfInning([
      play({ sequence: 10, narrative: "a", inning: 2, half: "top" }),
      play({ sequence: 9, narrative: "b", inning: 2, half: "top" }),
      play({ sequence: 8, narrative: "c", inning: 1, half: "bottom" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Top 2nd", "Bottom 1st"]);
    expect(groups[0]!.plays.map((p) => p.sequence)).toEqual([10, 9]);
  });

  it("computes count entering the outcome pitch", () => {
    const walk = play({
      sequence: 1,
      narrative: "walk",
      eventType: "walk",
      pitchSequence: "BBBKFB",
      finalBalls: 4,
      finalStrikes: 2,
    });
    expect(countEnteringOutcome(walk)).toEqual({ balls: 3, strikes: 2 });
    expect(formatSituationalLine({ ...walk, outs: 0 })).toBe("3 - 2, 0 Outs");
  });

  it("tracks running score by sequence", () => {
    const scores = runningScoresBySequence([
      play({
        sequence: 1,
        narrative: "single",
        half: "top",
        isScoringPlay: true,
        runsScored: 2,
      }),
      play({
        sequence: 2,
        narrative: "hr",
        half: "bottom",
        isScoringPlay: true,
        runsScored: 1,
      }),
    ]);
    expect(scores.get(1)).toEqual({ away: 2, home: 0 });
    expect(scores.get(2)).toEqual({ away: 2, home: 1 });
    expect(formatScoreLine(scores.get(2)!, "CWS", "HOU")).toBe("CWS 2, HOU 1");
  });

  it("computes outs after a strikeout", () => {
    expect(
      outsAfterPlay(
        play({
          sequence: 1,
          narrative: "struck out",
          eventType: "strikeout",
          outs: 1,
        }),
      ),
    ).toBe(2);
  });
});
