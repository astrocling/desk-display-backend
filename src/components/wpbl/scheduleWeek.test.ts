import { describe, expect, it } from "vitest";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

import {
  etYmd,
  gameStartYmd,
  mondayOfWeekEt,
  partitionScheduleByWeek,
  sundayOfWeekEt,
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
