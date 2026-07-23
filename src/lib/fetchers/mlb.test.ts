import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMlb, formatWhenEt } from "@/lib/fetchers/mlb";

function buildEspnPayload(
  events: Array<{
    date: string;
    home: { abbr: string; nick?: string; score?: string };
    away: { abbr: string; nick?: string; score?: string };
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
              team: {
                abbreviation: event.away.abbr,
                shortDisplayName: event.away.nick,
              },
            },
            {
              homeAway: "home",
              score: event.home.score,
              team: {
                abbreviation: event.home.abbr,
                shortDisplayName: event.home.nick,
              },
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

function buildTeamPayload(abbr: string, groupId: string) {
  return {
    team: {
      abbreviation: abbr,
      shortDisplayName: abbr === "HOU" ? "Astros" : abbr,
      groups: { id: groupId },
    },
  };
}

function buildStandingsPayload(
  shortName: string,
  entries: Array<{
    abbr: string;
    overall: string;
    divisionGamesBehind: { display: string; value: number };
  }>,
) {
  return {
    name: shortName,
    shortName,
    standings: {
      entries: entries.map((entry) => ({
        team: { abbreviation: entry.abbr },
        stats: [
          {
            name: "overall",
            displayValue: entry.overall,
          },
          {
            name: "wins",
            displayValue: entry.overall.split("-")[0],
            value: Number(entry.overall.split("-")[0]),
          },
          {
            name: "losses",
            displayValue: entry.overall.split("-")[1],
            value: Number(entry.overall.split("-")[1]),
          },
          {
            name: "divisionGamesBehind",
            displayValue: entry.divisionGamesBehind.display,
            value: entry.divisionGamesBehind.value,
          },
        ],
      })),
    },
  };
}

const alWestStandings = buildStandingsPayload("AL West", [
  {
    abbr: "TEX",
    overall: "51-51",
    divisionGamesBehind: { display: "-", value: 0 },
  },
  {
    abbr: "SEA",
    overall: "51-52",
    divisionGamesBehind: { display: "0.5", value: 0.5 },
  },
  {
    abbr: "HOU",
    overall: "50-54",
    divisionGamesBehind: { display: "2", value: 2 },
  },
  {
    abbr: "ATH",
    overall: "43-59",
    divisionGamesBehind: { display: "8", value: 8 },
  },
  {
    abbr: "LAA",
    overall: "41-62",
    divisionGamesBehind: { display: "10.5", value: 10.5 },
  },
]);

const houLeadingStandings = buildStandingsPayload("AL West", [
  {
    abbr: "HOU",
    overall: "55-40",
    divisionGamesBehind: { display: "-", value: 0 },
  },
  {
    abbr: "SEA",
    overall: "53-41",
    divisionGamesBehind: { display: "1.5", value: 1.5 },
  },
  {
    abbr: "TEX",
    overall: "50-45",
    divisionGamesBehind: { display: "5", value: 5 },
  },
]);

function mockEspnFetch(handlers: {
  scoreboard?: (url: string) => unknown;
  team?: unknown;
  standings?: unknown | (() => unknown);
  teamOk?: boolean;
  standingsOk?: boolean;
}) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);

    if (url.includes("/standings")) {
      if (handlers.standingsOk === false) {
        return { ok: false, status: 500 } as Response;
      }
      const body =
        typeof handlers.standings === "function"
          ? handlers.standings()
          : (handlers.standings ?? alWestStandings);
      return { ok: true, json: async () => body } as Response;
    }

    if (url.includes("/teams/")) {
      if (handlers.teamOk === false) {
        return { ok: false, status: 500 } as Response;
      }
      return {
        ok: true,
        json: async () => handlers.team ?? buildTeamPayload("HOU", "3"),
      } as Response;
    }

    if (url.includes("scoreboard")) {
      const body = handlers.scoreboard?.(url);
      if (body === undefined) {
        return { ok: false, status: 404 } as Response;
      }
      return { ok: true, json: async () => body } as Response;
    }

    return { ok: false, status: 404 } as Response;
  });
}

describe("formatWhenEt", () => {
  it("formats a summer UTC instant in Eastern Daylight Time", () => {
    expect(formatWhenEt("2026-07-24T23:40:00Z")).toBe("Fri 7/24 7:40 PM");
  });

  it("formats a winter UTC instant in Eastern Standard Time", () => {
    expect(formatWhenEt("2026-01-15T01:00:00Z")).toBe("Wed 1/14 8:00 PM");
  });
});

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
        away: { abbr: "HOU", nick: "Astros", score: "4" },
        home: { abbr: "NYY", nick: "Yankees", score: "2" },
        state: "in",
        detail: "Top 7th",
      },
    ]);

    mockEspnFetch({
      scoreboard: () => payload,
    });

    const result = await fetchMlb("HOU");

    expect(result).toEqual({
      live: true,
      score: "4-2",
      inning: "Top 7",
      nextGame: null,
      matchup: null,
      whenEt: null,
      record: "50-54",
      standingLine: "3rd AL West · 2 GB",
      teamAbbr: "HOU",
      opponentAbbr: null,
      homeAway: null,
    });
    expect(result.teamAbbr).toBe("HOU");
    expect(result.opponentAbbr).toBeNull();
    expect(result.homeAway).toBeNull();
  });

  it("returns final score and searches for the next scheduled game", async () => {
    const today = buildEspnPayload([
      {
        date: "2026-07-23T01:00:00Z",
        away: { abbr: "HOU", nick: "Astros", score: "5" },
        home: { abbr: "TEX", nick: "Rangers", score: "3" },
        state: "post",
      },
    ]);
    const tomorrow = buildEspnPayload([
      {
        date: "2026-07-24T23:40:00Z",
        away: { abbr: "HOU", nick: "Astros", score: undefined },
        home: { abbr: "SEA", nick: "Mariners", score: undefined },
        state: "pre",
      },
    ]);

    mockEspnFetch({
      scoreboard: (url) => (url.includes("dates=") ? tomorrow : today),
    });

    const result = await fetchMlb("hou");

    expect(result).toEqual({
      live: false,
      score: "5-3",
      inning: null,
      nextGame: "2026-07-24T23:40:00Z",
      matchup: "Astros @ Mariners",
      whenEt: "Fri 7/24 7:40 PM",
      record: "50-54",
      standingLine: "3rd AL West · 2 GB",
      teamAbbr: "HOU",
      opponentAbbr: "SEA",
      homeAway: "away",
    });
    expect(result.teamAbbr).toBe("HOU");
    expect(result.opponentAbbr).toBe("SEA");
    expect(result.homeAway).toBe("away");
  });

  it("formats an away matchup as Astros @ Rangers", async () => {
    const payload = buildEspnPayload([
      {
        date: "2026-07-24T23:00:00Z",
        away: { abbr: "HOU", nick: "Astros" },
        home: { abbr: "TEX", nick: "Rangers" },
        state: "pre",
      },
    ]);

    mockEspnFetch({
      scoreboard: () => payload,
    });

    const result = await fetchMlb("HOU");

    expect(result.matchup).toBe("Astros @ Rangers");
    expect(result.live).toBe(false);
    expect(result.nextGame).toBe("2026-07-24T23:00:00Z");
    expect(result.teamAbbr).toBe("HOU");
    expect(result.opponentAbbr).toBe("TEX");
    expect(result.homeAway).toBe("away");
  });

  it("formats a home matchup as Astros vs. Rangers", async () => {
    const payload = buildEspnPayload([
      {
        date: "2026-07-24T23:00:00Z",
        away: { abbr: "TEX", nick: "Rangers" },
        home: { abbr: "HOU", nick: "Astros" },
        state: "pre",
      },
    ]);

    mockEspnFetch({
      scoreboard: () => payload,
    });

    const result = await fetchMlb("HOU");

    expect(result.matchup).toBe("Astros vs. Rangers");
    expect(result.homeAway).toBe("home");
    expect(result.teamAbbr).toBe("HOU");
    expect(result.opponentAbbr).toBe("TEX");
  });

  it("uses GU for a division leader based on second place games behind", async () => {
    const payload = buildEspnPayload([
      {
        date: "2026-07-24T23:00:00Z",
        away: { abbr: "HOU", nick: "Astros" },
        home: { abbr: "SEA", nick: "Mariners" },
        state: "pre",
      },
    ]);

    mockEspnFetch({
      scoreboard: () => payload,
      standings: houLeadingStandings,
    });

    const result = await fetchMlb("HOU");

    expect(result.record).toBe("55-40");
    expect(result.standingLine).toBe("1st AL West · 1.5 GU");
  });

  it("keeps scoreboard fields when standings fetch fails", async () => {
    const payload = buildEspnPayload([
      {
        date: "2026-07-24T23:40:00Z",
        away: { abbr: "HOU", nick: "Astros" },
        home: { abbr: "SEA", nick: "Mariners" },
        state: "pre",
      },
    ]);

    mockEspnFetch({
      scoreboard: () => payload,
      standingsOk: false,
    });

    const result = await fetchMlb("HOU");

    expect(result).toEqual({
      live: false,
      score: null,
      inning: null,
      nextGame: "2026-07-24T23:40:00Z",
      matchup: "Astros @ Mariners",
      whenEt: "Fri 7/24 7:40 PM",
      record: null,
      standingLine: null,
      teamAbbr: "HOU",
      opponentAbbr: "SEA",
      homeAway: "away",
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
