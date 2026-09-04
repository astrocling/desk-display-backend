import { describe, expect, it } from "vitest";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

import {
  compareWpblSchedule,
  isRecentFinal,
  sortWpblSchedule,
} from "./scheduleSort";

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

const now = new Date("2026-08-21T18:00:00Z");

describe("isRecentFinal", () => {
  it("returns true for finals within 14 days", () => {
    expect(
      isRecentFinal(
        game({
          id: "1",
          status: "final",
          startIso: "2026-08-15T21:00:00Z",
        }),
        now,
      ),
    ).toBe(true);
  });

  it("returns false for older finals", () => {
    expect(
      isRecentFinal(
        game({
          id: "2",
          status: "final",
          startIso: "2026-07-01T21:00:00Z",
        }),
        now,
      ),
    ).toBe(false);
  });
});

describe("sortWpblSchedule", () => {
  it("orders live, upcoming, recent finals, then older finals", () => {
    const games = [
      game({
        id: "old-final",
        status: "final",
        startIso: "2026-07-01T21:00:00Z",
      }),
      game({
        id: "upcoming-late",
        status: "scheduled",
        startIso: "2026-08-25T21:00:00Z",
      }),
      game({
        id: "live",
        status: "live",
        startIso: "2026-08-21T17:00:00Z",
      }),
      game({
        id: "recent-final",
        status: "final",
        startIso: "2026-08-18T21:00:00Z",
      }),
      game({
        id: "upcoming-soon",
        status: "scheduled",
        startIso: "2026-08-22T17:00:00Z",
      }),
    ];

    expect(sortWpblSchedule(games, now).map((g) => g.id)).toEqual([
      "live",
      "upcoming-soon",
      "upcoming-late",
      "recent-final",
      "old-final",
    ]);
  });

  it("sorts recent finals most-recent first", () => {
    const games = [
      game({
        id: "a",
        status: "final",
        startIso: "2026-08-10T21:00:00Z",
      }),
      game({
        id: "b",
        status: "final",
        startIso: "2026-08-18T21:00:00Z",
      }),
    ];

    expect(sortWpblSchedule(games, now).map((g) => g.id)).toEqual(["b", "a"]);
  });
});

describe("compareWpblSchedule", () => {
  it("places other status last", () => {
    const other = game({ id: "other", status: "other" });
    const scheduled = game({
      id: "sched",
      status: "scheduled",
      startIso: "2026-08-30T21:00:00Z",
    });
    expect(compareWpblSchedule(other, scheduled, now)).toBeGreaterThan(0);
  });
});
