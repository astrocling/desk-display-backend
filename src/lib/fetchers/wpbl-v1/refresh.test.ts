import { describe, expect, it } from "vitest";
import { WPBL_LIVE_TTL_MS, shouldRefreshWpblGame } from "./refresh";
import type {
  WpblGameDetailResponse,
  WpblGameStatus,
} from "@/lib/types/wpbl-display";

function detail(
  partial: Partial<WpblGameDetailResponse> & { status: WpblGameStatus },
): WpblGameDetailResponse {
  return {
    updatedAt: partial.updatedAt ?? "2026-08-21T12:00:00.000Z",
    game: {
      id: "g1",
      status: partial.status,
      startIso: null,
      whenEt: null,
      awayAbbr: "LA",
      homeAbbr: "NY",
      awayName: "Queens",
      homeName: "Heights",
      awayRuns: 1,
      homeRuns: 2,
      venue: null,
      countsInStandings: true,
      inning: null,
      ...(partial.game ?? {}),
    },
    boxscore: partial.boxscore ?? {
      available: false,
      lineScore: null,
      batting: [],
      pitching: [],
    },
  };
}

describe("shouldRefreshWpblGame", () => {
  const now = new Date("2026-08-21T18:00:00Z");

  it("refreshes live blobs older than TTL", () => {
    const d = detail({
      status: "live",
      updatedAt: new Date(now.getTime() - WPBL_LIVE_TTL_MS - 1000).toISOString(),
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });

  it("skips live blobs inside TTL", () => {
    const d = detail({
      status: "live",
      updatedAt: new Date(now.getTime() - 1000).toISOString(),
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });

  it("refreshes when boxscore unavailable", () => {
    const d = detail({
      status: "final",
      updatedAt: now.toISOString(),
      boxscore: {
        available: false,
        lineScore: null,
        batting: [],
        pitching: [],
      },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });

  it("skips fresh final with boxscore", () => {
    const d = detail({
      status: "final",
      updatedAt: now.toISOString(),
      boxscore: {
        available: true,
        lineScore: null,
        batting: [],
        pitching: [],
      },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });
});
