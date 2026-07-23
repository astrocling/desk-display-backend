import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMlb } from "@/lib/fetchers/mlb";

function buildEspnPayload(
  events: Array<{
    date: string;
    home: { abbr: string; score?: string };
    away: { abbr: string; score?: string };
    state: "pre" | "in" | "post";
    detail?: string;
  }>,
) {
  return {
    events: events.map((event, index) => ({
      id: String(index + 1),
      date: event.date,
      competitions: [
        {
          date: event.date,
          competitors: [
            {
              homeAway: "away",
              score: event.away.score,
              team: { abbreviation: event.away.abbr },
            },
            {
              homeAway: "home",
              score: event.home.score,
              team: { abbreviation: event.home.abbr },
            },
          ],
          status: {
            type: {
              state: event.state,
              detail: event.detail,
            },
          },
        },
      ],
    })),
  };
}

describe("fetchMlb", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns live score and inning for an in-progress team game", async () => {
    const payload = buildEspnPayload([
      {
        date: "2026-07-23T23:00:00Z",
        away: { abbr: "HOU", score: "4" },
        home: { abbr: "NYY", score: "2" },
        state: "in",
        detail: "Top 7th",
      },
    ]);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    } as Response);

    const result = await fetchMlb("HOU");

    expect(result).toEqual({
      live: true,
      score: "4-2",
      inning: "Top 7",
      nextGame: null,
    });
  });

  it("returns final score and searches for the next scheduled game", async () => {
    const today = buildEspnPayload([
      {
        date: "2026-07-23T01:00:00Z",
        away: { abbr: "HOU", score: "5" },
        home: { abbr: "TEX", score: "3" },
        state: "post",
      },
    ]);
    const tomorrow = buildEspnPayload([
      {
        date: "2026-07-24T23:00:00Z",
        away: { abbr: "HOU", score: undefined },
        home: { abbr: "SEA", score: undefined },
        state: "pre",
      },
    ]);

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => today,
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => tomorrow,
      } as Response);

    const result = await fetchMlb("hou");

    expect(result).toEqual({
      live: false,
      score: "5-3",
      inning: null,
      nextGame: "2026-07-24T23:00:00Z",
    });
  });

  it("throws when ESPN returns a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    await expect(fetchMlb("HOU")).rejects.toThrow(
      "ESPN scoreboard request failed: 503",
    );
  });
});
