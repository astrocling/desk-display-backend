import { describe, expect, it } from "vitest";

import type { WpblScheduleGame } from "@/lib/types/wpbl-display";

import { todayGameCardKind, todaySlateHasLiveGame } from "./todayGameCardKind";

function game(
  partial: Partial<WpblScheduleGame> & Pick<WpblScheduleGame, "id" | "status">,
): WpblScheduleGame {
  return {
    startIso: null,
    whenEt: null,
    awayAbbr: "NY",
    homeAbbr: "SF",
    awayName: "Heights",
    homeName: "Firebells",
    awayRuns: null,
    homeRuns: null,
    venue: null,
    countsInStandings: true,
    ...partial,
  };
}

describe("todayGameCardKind", () => {
  const now = new Date("2026-08-31T01:53:00.000Z"); // Aug 30, 9:53 PM ET

  it("routes a past-start scheduled game to the live detail card", () => {
    expect(
      todayGameCardKind(
        game({
          id: "g1",
          status: "scheduled",
          startIso: "2026-08-30T22:30:00.000Z",
          whenEt: "Sun 8/30 6:30 PM",
        }),
        now,
      ),
    ).toBe("live-detail");
  });

  it("keeps a future scheduled game on the day card", () => {
    expect(
      todayGameCardKind(
        game({
          id: "g2",
          status: "scheduled",
          startIso: "2026-08-31T02:30:00.000Z",
        }),
        now,
      ),
    ).toBe("day");
  });

  it("routes finals to the final detail card", () => {
    expect(
      todayGameCardKind(
        game({
          id: "g3",
          status: "final",
          startIso: "2026-08-30T22:30:00.000Z",
          awayRuns: 3,
          homeRuns: 2,
        }),
        now,
      ),
    ).toBe("final-detail");
  });
});

describe("todaySlateHasLiveGame", () => {
  it("is true only when a slate row is actually live", () => {
    expect(
      todaySlateHasLiveGame([
        game({
          id: "g1",
          status: "scheduled",
          startIso: "2026-08-30T22:30:00.000Z",
        }),
      ]),
    ).toBe(false);
    expect(
      todaySlateHasLiveGame([
        game({ id: "g2", status: "live", startIso: "2026-08-30T22:30:00.000Z" }),
      ]),
    ).toBe(true);
  });
});
