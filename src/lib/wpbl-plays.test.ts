import { describe, expect, it } from "vitest";

import type {
  WpblBoxPlayerLine,
  WpblLiveSituation,
  WpblPlay,
} from "@/lib/types/wpbl-display";
import {
  atBatPitchLog,
  decodePitchSequence,
  filterWpblPlays,
  formatPlayInning,
  latestWpblPlay,
  lineupFollowers,
  lineupForSide,
  pitchKind,
  pitchesFromPlay,
  shortRunnerLabel,
} from "@/lib/wpbl-plays";

function play(
  partial: Partial<WpblPlay> & Pick<WpblPlay, "sequence" | "narrative">,
): WpblPlay {
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

function batter(
  partial: Partial<WpblBoxPlayerLine> &
    Pick<WpblBoxPlayerLine, "name" | "battingOrder" | "side">,
): WpblBoxPlayerLine {
  return {
    playerId: null,
    position: "cf",
    uniform: null,
    headshotUrl: null,
    stats: {},
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
    expect(
      formatPlayInning(
        play({ sequence: 1, narrative: "x", half: "bottom", inning: 5 }),
      ),
    ).toBe("Bot 5");
    expect(
      formatPlayInning(
        play({ sequence: 1, narrative: "x", half: null, inning: 2 }),
      ),
    ).toBe("Inn 2");
  });

  it("shortens runner names to last token", () => {
    expect(shortRunnerLabel("Mo'ne Davis")).toBe("Davis");
    expect(shortRunnerLabel("  ")).toBeNull();
  });
});

describe("decodePitchSequence / pitchesFromPlay", () => {
  it("decodes compact pitch codes", () => {
    const events = decodePitchSequence("BBKSFP");
    expect(events.map((e) => e.code)).toEqual(["B", "B", "K", "S", "F", "P"]);
    expect(pitchKind(events[0]!)).toBe("ball");
    expect(pitchKind(events[2]!)).toBe("strike");
    expect(pitchKind(events[4]!)).toBe("foul");
    expect(pitchKind(events[5]!)).toBe("in_play");
  });

  it("prefers structured pitch_events over sequence decode", () => {
    const fromEvents = pitchesFromPlay(
      play({
        sequence: 1,
        narrative: "x",
        pitchSequence: "BBB",
        pitchEvents: [
          {
            sequence: 1,
            code: "S",
            type: "swinging_strike",
            description: "Swinging strike",
          },
        ],
      }),
    );
    expect(fromEvents).toHaveLength(1);
    expect(fromEvents[0]!.code).toBe("S");
  });

  it("falls back to decoding pitch_sequence", () => {
    expect(
      pitchesFromPlay(
        play({ sequence: 1, narrative: "x", pitchSequence: "FK" }),
      ).map((e) => e.code),
    ).toEqual(["F", "K"]);
  });
});

describe("atBatPitchLog", () => {
  const sit: WpblLiveSituation = {
    inningNumber: 3,
    half: "top",
    balls: 1,
    strikes: 2,
    outs: 1,
    onFirst: false,
    onSecond: false,
    onThird: false,
    runnerFirst: null,
    runnerSecond: null,
    runnerThird: null,
    batterName: "Mo'ne Davis",
    pitcherName: "Kim",
  };

  it("labels matching batter as this at-bat", () => {
    const log = atBatPitchLog(sit, [
      play({
        sequence: 9,
        narrative: "Davis walked",
        batterName: "Mo'ne Davis",
        pitchSequence: "BBBB",
      }),
    ]);
    expect(log.source).toBe("current");
    expect(log.label).toBe("This at-bat");
    expect(log.pitches).toHaveLength(4);
  });

  it("labels prior batter as last at-bat", () => {
    const log = atBatPitchLog(sit, [
      play({
        sequence: 9,
        narrative: "Lansdell singled",
        batterName: "Ashton Lansdell",
        pitchSequence: "BHS",
      }),
    ]);
    expect(log.source).toBe("last");
    expect(log.label).toBe("Last at-bat");
  });
});

describe("lineupFollowers", () => {
  const batting = [
    batter({ side: "away", name: "A", battingOrder: 1, uniform: "1" }),
    batter({ side: "away", name: "B", battingOrder: 2, uniform: "2" }),
    batter({ side: "away", name: "C", battingOrder: 3, uniform: "3" }),
    batter({ side: "home", name: "H1", battingOrder: 1 }),
  ];

  it("builds unique order and on-deck / in-hole", () => {
    expect(lineupForSide(batting, "away").map((p) => p.name)).toEqual([
      "A",
      "B",
      "C",
    ]);
    const follow = lineupFollowers(batting, {
      inningNumber: 1,
      half: "top",
      balls: 0,
      strikes: 0,
      outs: 0,
      onFirst: false,
      onSecond: false,
      onThird: false,
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
      batterName: "A",
      pitcherName: null,
    });
    expect(follow.onDeck?.name).toBe("B");
    expect(follow.inHole?.name).toBe("C");
  });

  it("wraps the order after the last spot", () => {
    const follow = lineupFollowers(batting, {
      inningNumber: 1,
      half: "top",
      balls: 0,
      strikes: 0,
      outs: 0,
      onFirst: false,
      onSecond: false,
      onThird: false,
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
      batterName: "C",
      pitcherName: null,
    });
    expect(follow.onDeck?.name).toBe("A");
    expect(follow.inHole?.name).toBe("B");
  });
});
