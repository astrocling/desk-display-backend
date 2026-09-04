import { describe, expect, it } from "vitest";
import type { WpblScheduleGame, WpblStandingRow } from "@/lib/types/wpbl-display";
import { applyClinchedSeeds, isRemainingRegularSeasonGame } from "./clinch";

function row(
  partial: Pick<WpblStandingRow, "abbr" | "w" | "l" | "rank"> &
    Partial<WpblStandingRow>,
): WpblStandingRow {
  return {
    teamId: partial.teamId ?? partial.abbr,
    abbr: partial.abbr,
    name: partial.name ?? partial.abbr,
    rank: partial.rank,
    w: partial.w,
    l: partial.l,
    t: partial.t ?? 0,
    pct: partial.pct ?? null,
    gb: partial.gb ?? null,
    rf: partial.rf ?? 0,
    ra: partial.ra ?? 0,
    diff: partial.diff ?? 0,
    l10: partial.l10 ?? null,
    streak: partial.streak ?? null,
    clinchedSeed: partial.clinchedSeed ?? null,
  };
}

function game(
  partial: Pick<
    WpblScheduleGame,
    "id" | "awayAbbr" | "homeAbbr" | "startIso" | "status"
  > &
    Partial<WpblScheduleGame>,
): WpblScheduleGame {
  return {
    id: partial.id,
    status: partial.status,
    startIso: partial.startIso,
    whenEt: null,
    awayAbbr: partial.awayAbbr,
    homeAbbr: partial.homeAbbr,
    awayName: partial.awayAbbr,
    homeName: partial.homeAbbr,
    awayRuns: null,
    homeRuns: null,
    venue: null,
    countsInStandings: partial.countsInStandings ?? true,
    gameType: partial.gameType ?? "regular",
  };
}

describe("isRemainingRegularSeasonGame", () => {
  const now = new Date("2026-09-04T18:00:00.000Z");

  it("keeps today and future non-final regular games", () => {
    expect(
      isRemainingRegularSeasonGame(
        game({
          id: "1",
          awayAbbr: "SF",
          homeAbbr: "NY",
          startIso: "2026-09-04T22:30:00Z",
          status: "scheduled",
        }),
        now,
      ),
    ).toBe(true);
  });

  it("drops finals, postseason, and past ghost slots", () => {
    expect(
      isRemainingRegularSeasonGame(
        game({
          id: "2",
          awayAbbr: "SF",
          homeAbbr: "BOS",
          startIso: "2026-09-04T22:30:00Z",
          status: "final",
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isRemainingRegularSeasonGame(
        game({
          id: "3",
          awayAbbr: "SF",
          homeAbbr: "BOS",
          startIso: "2026-09-09T23:00:00Z",
          status: "scheduled",
          gameType: "postseason",
          countsInStandings: false,
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isRemainingRegularSeasonGame(
        game({
          id: "4",
          awayAbbr: "LA",
          homeAbbr: "NY",
          startIso: "2026-08-01T22:00:00Z",
          status: "scheduled",
        }),
        now,
      ),
    ).toBe(false);
  });
});

describe("applyClinchedSeeds", () => {
  const now = new Date("2026-09-04T18:00:00.000Z");

  it("marks sole clinched seeds from remaining schedule", () => {
    const standings = [
      row({ abbr: "SF", rank: 1, w: 9, l: 4 }),
      row({ abbr: "LA", rank: 2, w: 7, l: 7 }),
      row({ abbr: "NY", rank: 2, w: 7, l: 7 }),
      row({ abbr: "BOS", rank: 4, w: 4, l: 9 }),
    ];
    const games = [
      game({
        id: "a",
        awayAbbr: "SF",
        homeAbbr: "NY",
        startIso: "2026-09-04T22:30:00Z",
        status: "scheduled",
      }),
      game({
        id: "b",
        awayAbbr: "LA",
        homeAbbr: "BOS",
        startIso: "2026-09-05T22:30:00Z",
        status: "scheduled",
      }),
      game({
        id: "c",
        awayAbbr: "BOS",
        homeAbbr: "SF",
        startIso: "2026-09-06T22:30:00Z",
        status: "scheduled",
      }),
    ];

    const next = applyClinchedSeeds(standings, games, now);
    expect(next.map((r) => [r.abbr, r.clinchedSeed])).toEqual([
      ["SF", 1],
      ["LA", null],
      ["NY", null],
      ["BOS", 4],
    ]);
  });

  it("does not clinch when win ranges still overlap", () => {
    const standings = [
      row({ abbr: "SF", rank: 1, w: 8, l: 4 }),
      row({ abbr: "LA", rank: 2, w: 7, l: 5 }),
      row({ abbr: "NY", rank: 3, w: 6, l: 6 }),
      row({ abbr: "BOS", rank: 4, w: 5, l: 7 }),
    ];
    const games = [
      game({
        id: "a",
        awayAbbr: "SF",
        homeAbbr: "LA",
        startIso: "2026-09-05T22:30:00Z",
        status: "scheduled",
      }),
      game({
        id: "b",
        awayAbbr: "NY",
        homeAbbr: "BOS",
        startIso: "2026-09-05T23:30:00Z",
        status: "scheduled",
      }),
    ];

    const next = applyClinchedSeeds(standings, games, now);
    expect(next.every((r) => r.clinchedSeed == null)).toBe(true);
  });
});
