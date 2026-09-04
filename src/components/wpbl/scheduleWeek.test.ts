import { describe, expect, it } from "vitest";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

import {
  etYmd,
  gameStartYmd,
  homeScheduleTeaserGames,
  mondayOfWeekEt,
  partitionScheduleByWeek,
  sundayOfWeekEt,
  todaysSlateGames,
  yesterdaysFinalGames,
} from "./scheduleWeek";

function game(
  partial: Partial<WpblScheduleGame> & Pick<WpblScheduleGame, "id" | "status">,
): WpblScheduleGame {
  return {
    startIso: null,
    whenEt: null,
    awayAbbr: "LA",
    homeAbbr: "NY",
    awayName: "Queens",
    homeName: "Heights",
    awayRuns: null,
    homeRuns: null,
    venue: null,
    countsInStandings: true,
      gameType: "regular",
    ...partial,
  };
}

/** Friday Aug 21, 2026 afternoon ET */
const friEt = new Date("2026-08-21T18:00:00-04:00");

describe("mondayOfWeekEt / sundayOfWeekEt", () => {
  it("returns Mon–Sun for a Friday in ET", () => {
    expect(mondayOfWeekEt(friEt)).toBe("2026-08-17");
    expect(sundayOfWeekEt(friEt)).toBe("2026-08-23");
  });

  it("treats Sunday as end of the current week", () => {
    const sun = new Date("2026-08-23T15:00:00-04:00");
    expect(mondayOfWeekEt(sun)).toBe("2026-08-17");
    expect(sundayOfWeekEt(sun)).toBe("2026-08-23");
  });

  it("rolls to the next Monday on Monday morning", () => {
    const mon = new Date("2026-08-24T09:00:00-04:00");
    expect(mondayOfWeekEt(mon)).toBe("2026-08-24");
    expect(sundayOfWeekEt(mon)).toBe("2026-08-30");
  });
});

describe("etYmd / gameStartYmd", () => {
  it("formats ET calendar dates", () => {
    expect(etYmd(new Date("2026-08-22T02:00:00Z"))).toBe("2026-08-21");
  });

  it("returns null when startIso is missing", () => {
    expect(gameStartYmd(game({ id: "x", status: "scheduled" }))).toBeNull();
  });
});

describe("todaysSlateGames", () => {
  it("includes today's scheduled/final and any live game", () => {
    const games = [
      game({
        id: "yesterday-final",
        status: "final",
        startIso: "2026-08-20T23:00:00Z",
        awayRuns: 3,
        homeRuns: 1,
      }),
      game({
        id: "today-sched",
        status: "scheduled",
        startIso: "2026-08-21T23:00:00Z",
        whenEt: "Fri 7:00 PM ET",
      }),
      game({
        id: "today-final",
        status: "final",
        startIso: "2026-08-21T18:00:00Z",
        awayRuns: 5,
        homeRuns: 2,
      }),
      game({
        id: "live-late",
        status: "live",
        startIso: "2026-08-21T01:00:00Z",
        awayRuns: 1,
        homeRuns: 0,
      }),
      game({
        id: "tomorrow",
        status: "scheduled",
        startIso: "2026-08-22T23:00:00Z",
      }),
      game({
        id: "live-from-yesterday",
        status: "live",
        startIso: "2026-08-21T03:30:00Z",
        awayRuns: 2,
        homeRuns: 2,
      }),
    ];

    // After midnight UTC Aug 22 = still Aug 21 evening ET
    const slate = todaysSlateGames(games, friEt);
    expect(slate.map((g) => g.id)).toEqual([
      "live-late",
      "live-from-yesterday",
      "today-sched",
      "today-final",
    ]);
  });

  it("keeps a live game that started on the previous ET calendar day", () => {
    // Saturday 12:30 AM ET — Friday night game still live
    const satEarly = new Date("2026-08-22T00:30:00-04:00");
    const games = [
      game({
        id: "spillover-live",
        status: "live",
        startIso: "2026-08-21T23:00:00-04:00",
      }),
      game({
        id: "sat-sched",
        status: "scheduled",
        startIso: "2026-08-22T19:00:00-04:00",
      }),
    ];
    expect(todaysSlateGames(games, satEarly).map((g) => g.id)).toEqual([
      "spillover-live",
      "sat-sched",
    ]);
  });
});

describe("partitionScheduleByWeek", () => {
  it("splits past, this week, and future in chronological buckets", () => {
    const games = [
      game({
        id: "past-old",
        status: "final",
        startIso: "2026-08-10T21:00:00Z",
      }),
      game({
        id: "past-recent",
        status: "final",
        startIso: "2026-08-16T21:00:00Z",
      }),
      game({
        id: "week-mon",
        status: "final",
        startIso: "2026-08-17T23:00:00Z",
      }),
      game({
        id: "week-fri",
        status: "scheduled",
        startIso: "2026-08-21T23:00:00Z",
      }),
      game({
        id: "week-sun",
        status: "scheduled",
        startIso: "2026-08-23T23:00:00Z",
      }),
      game({
        id: "future",
        status: "scheduled",
        startIso: "2026-08-25T23:00:00Z",
      }),
      game({ id: "undated", status: "scheduled" }),
    ];

    const part = partitionScheduleByWeek(games, friEt);

    expect(part.weekStartYmd).toBe("2026-08-17");
    expect(part.weekEndYmd).toBe("2026-08-23");
    expect(part.weekLabel).toMatch(/Aug 17/);
    expect(part.past.map((g) => g.id)).toEqual(["past-recent", "past-old"]);
    expect(part.thisWeek.map((g) => g.id)).toEqual([
      "week-mon",
      "week-fri",
      "week-sun",
    ]);
    expect(part.future.map((g) => g.id)).toEqual(["future", "undated"]);
  });
});

describe("yesterdaysFinalGames", () => {
  it("returns finals from the previous ET calendar day", () => {
    const monMorning = new Date("2026-08-31T14:00:00-04:00");
    const games = [
      game({
        id: "sun-final",
        status: "final",
        startIso: "2026-08-30T23:30:00Z",
        awayRuns: 9,
        homeRuns: 11,
      }),
      game({
        id: "sat-final",
        status: "final",
        startIso: "2026-08-29T23:30:00Z",
        awayRuns: 6,
        homeRuns: 10,
      }),
      game({
        id: "sun-sched",
        status: "scheduled",
        startIso: "2026-08-30T22:30:00Z",
      }),
    ];

    expect(yesterdaysFinalGames(games, monMorning).map((g) => g.id)).toEqual([
      "sun-final",
    ]);
  });
});

describe("homeScheduleTeaserGames", () => {
  it("prefers upcoming then pads with recent finals", () => {
    const games = [
      game({
        id: "final-a",
        status: "final",
        startIso: "2026-08-18T23:00:00Z",
        awayRuns: 2,
        homeRuns: 1,
      }),
      game({
        id: "final-b",
        status: "final",
        startIso: "2026-08-19T23:00:00Z",
        awayRuns: 4,
        homeRuns: 3,
      }),
      game({
        id: "next-1",
        status: "scheduled",
        startIso: "2026-08-22T23:00:00Z",
      }),
      game({
        id: "next-2",
        status: "scheduled",
        startIso: "2026-08-24T23:00:00Z",
      }),
      game({
        id: "live",
        status: "live",
        startIso: "2026-08-21T20:00:00Z",
        awayRuns: 1,
        homeRuns: 0,
      }),
    ];

    const teaser = homeScheduleTeaserGames(games, { limit: 3 });
    expect(teaser.map((g) => g.id)).toEqual(["next-1", "next-2", "final-b"]);
  });

  it("excludes today's slate ids", () => {
    const games = [
      game({
        id: "today",
        status: "scheduled",
        startIso: "2026-08-21T23:00:00Z",
      }),
      game({
        id: "later",
        status: "scheduled",
        startIso: "2026-08-25T23:00:00Z",
      }),
    ];

    const teaser = homeScheduleTeaserGames(games, {
      limit: 5,
      excludeIds: new Set(["today"]),
    });
    expect(teaser.map((g) => g.id)).toEqual(["later"]);
  });
});
