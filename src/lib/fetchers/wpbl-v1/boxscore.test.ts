import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapWpblGames } from "./games";
import {
  enrichLiveKeyPlayerSeasonRates,
  formatInningLabel,
  formatSeasonAvg,
  mapWpblBoxscore,
  mapWpblLiveSituation,
  mapWpblPlays,
} from "./boxscore";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/boxscore-trimmed.json"),
    "utf8",
  ),
);

const playsFixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/plays-trimmed.json"),
    "utf8",
  ),
);

const gamesFixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/games-sample.json"),
    "utf8",
  ),
);

describe("mapWpblBoxscore", () => {
  const gameMeta = mapWpblGames(gamesFixture)[0];

  it("maps line score, batting, and pitching from trimmed fixture", () => {
    const box = mapWpblBoxscore(fixture, gameMeta);

    expect(box.available).toBe(true);
    expect(box.lineScore).not.toBeNull();
    expect(box.lineScore!.teams[0]).toMatchObject({
      side: "away",
      abbr: "LA",
      name: "Queens",
      runs: 10,
      hits: 10,
      errors: 2,
      lob: 5,
    });
    expect(box.lineScore!.teams[0].innings).toHaveLength(7);
    expect(box.lineScore!.maxInning).toBe(7);

    const amiraBatting = box.batting.find((p) => p.name === "Amira Hondras");
    expect(amiraBatting).toMatchObject({
      side: "away",
      position: "2B",
      battingOrder: 7,
      uniform: "7",
      headshotUrl: null,
      stats: { ab: "4", h: "2", r: "1", rbi: "4" },
    });
    expect(amiraBatting?.playerId).toBeTruthy();

    const ayamiPitching = box.pitching.find((p) => p.name === "Ayami Sato");
    expect(ayamiPitching).toMatchObject({
      side: "away",
      position: "P",
      battingOrder: null,
      stats: { ip: "3.0", h: "10", r: "7", er: "4" },
    });
    expect(ayamiPitching?.playerId).toBeTruthy();

    expect(box.batting.some((p) => p.name === "Caitlin Eynon")).toBe(false);
    expect(box.pitching.some((p) => p.name === "Caitlin Eynon")).toBe(false);
    expect(box.plays).toEqual([]);
    expect(box.tracking).toEqual([]);
  });

  it("maps TrackMan tracking_activity when present", () => {
    const trackingFixture = JSON.parse(
      readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          "fixtures/tracking-trimmed.json",
        ),
        "utf8",
      ),
    );
    const box = mapWpblBoxscore(
      {
        boxscore: {
          ...fixture.boxscore,
          tracking_activity: trackingFixture.tracking_activity,
        },
      },
      gameMeta,
    );
    expect(box.tracking).toHaveLength(7);
    expect(box.tracking[0]!.pitchType).toBe("Fastball");
  });

  it("maps plays from boxscore when present", () => {
    const box = mapWpblBoxscore(
      { boxscore: { ...fixture.boxscore, plays: playsFixture.plays } },
      gameMeta,
    );
    expect(box.plays).toHaveLength(5);
    expect(box.plays[0]).toMatchObject({
      sequence: 1,
      inning: 1,
      half: "top",
      batterName: "Mo'ne Davis",
      narrative: "Mo'ne Davis reached first on an error by ss (0-1 F).",
      pitchSequence: "FP",
    });
    expect(box.plays[0]!.pitchEvents).toEqual([
      { sequence: 1, code: "F", type: "foul", description: "Foul" },
      { sequence: 2, code: "P", type: "in_play", description: "In play" },
    ]);
    const scoring = box.plays.find((p) => p.isScoringPlay);
    expect(scoring).toMatchObject({
      sequence: 7,
      eventType: "single",
      isHit: true,
      runsScored: 2,
    });
  });

  it("includes rate stats when present in hitting map", () => {
    const box = mapWpblBoxscore(fixture, gameMeta);
    const jamie = box.batting.find((p) => p.name === "Jamie Mackay");
    expect(jamie?.stats.obp).toBe(".500");
    expect(jamie?.stats.slg).toBe(".333");
  });

  it("uppercases player positions from the boxscore payload", () => {
    const box = mapWpblBoxscore(fixture, gameMeta);
    expect(box.batting.find((p) => p.name === "Kylee Lahners")?.position).toBe(
      "DH/1B",
    );
    expect(box.batting.find((p) => p.name === "Mo'ne Davis")?.position).toBe(
      "CF",
    );
  });

  it("treats teams with null line/players as unavailable boxscore", () => {
    const box = mapWpblBoxscore(
      {
        boxscore: {
          game_status: "Not Started",
          teams: [
            {
              side: "away",
              id: "v4gisr4rbgmn67b0",
              name: "Los Angeles Queens",
              line: null,
              totals: null,
              players: null,
            },
            {
              side: "home",
              id: "fttth861nft1j2s7",
              name: "New York Heights",
              line: null,
              totals: null,
              players: null,
            },
          ],
        },
      },
      gameMeta,
    );
    expect(box.available).toBe(false);
    expect(box.lineScore).toBeNull();
    expect(box.plays).toEqual([]);
  });
});

describe("mapWpblPlays", () => {
  it("skips plays missing narrative or sequence", () => {
    expect(
      mapWpblPlays([
        { sequence: 1, inning: 1, half: "top", narrative: "" },
        { inning: 1, half: "top", narrative: "No sequence" },
        {
          sequence: 2,
          inning: 1,
          half: "top",
          narrative: "Valid walk",
          event_type: "walk",
          is_scoring_play: false,
          runs_scored: 0,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        sequence: 2,
        narrative: "Valid walk",
        eventType: "walk",
        isScoringPlay: false,
      }),
    ]);
  });

  it("treats runs_scored > 0 as a scoring play", () => {
    const [play] = mapWpblPlays([
      {
        sequence: 9,
        inning: 3,
        half: "bottom",
        narrative: "Home run",
        is_scoring_play: false,
        runs_scored: 1,
      },
    ]);
    expect(play?.isScoringPlay).toBe(true);
    expect(play?.runsScored).toBe(1);
  });
});

describe("formatSeasonAvg", () => {
  it("formats hits/ab like leaders AVG", () => {
    expect(formatSeasonAvg(11, 27)).toBe(".407");
    expect(formatSeasonAvg(1, 1)).toBe("1.000");
  });

  it("returns null when there are no at-bats", () => {
    expect(formatSeasonAvg(0, 0)).toBeNull();
  });
});

describe("enrichLiveKeyPlayerSeasonRates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches batter avg and pitcher era from season player stats", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/players/batter-id/stats")) {
        return {
          ok: true,
          json: async () => ({
            player_id: "batter-id",
            batting: { at_bats: 20, hits: 6 },
            pitching: {},
          }),
        };
      }
      if (String(url).includes("/players/pitcher-id/stats")) {
        return {
          ok: true,
          json: async () => ({
            player_id: "pitcher-id",
            batting: {},
            pitching: { era: 2.45 },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const boxscore = {
      available: true,
      lineScore: null,
      batting: [
        {
          side: "home" as const,
          name: "Edith De Leija",
          playerId: "batter-id",
          position: "lf",
          battingOrder: null,
          uniform: null,
          headshotUrl: null,
          stats: {
            ab: "0",
            h: "0",
            obp: "1.000",
            slg: ".000",
          } as Record<string, string | number | null>,
        },
      ],
      pitching: [
        {
          side: "away" as const,
          name: "Niki Eckert",
          playerId: "pitcher-id",
          position: "p",
          battingOrder: null,
          uniform: null,
          headshotUrl: null,
          stats: { ip: "2.1" } as Record<string, string | number | null>,
        },
      ],
      plays: [],
    tracking: [],
    };

    await enrichLiveKeyPlayerSeasonRates(
      boxscore,
      {
        inningNumber: 3,
        half: "bottom",
        balls: 1,
        strikes: 2,
        outs: 1,
        onFirst: false,
        onSecond: false,
        onThird: false,
        runnerFirst: null,
        runnerSecond: null,
        runnerThird: null,
        batterName: "De Leija",
        pitcherName: "Eckert",
      },
      "c9sgab9f9yx00z75",
    );

    expect(boxscore.batting[0]!.stats.avg).toBe(".300");
    expect(boxscore.pitching[0]!.stats.era).toBe("2.45");
    // Game OBP/SLG left alone — they must not be used as AVG
    expect(boxscore.batting[0]!.stats.obp).toBe("1.000");
  });
});

describe("formatInningLabel", () => {
  it("returns Top/Bot labels for live games", () => {
    expect(
      formatInningLabel("live", { inning: 5, half: "top" }),
    ).toBe("Top 5");
    expect(
      formatInningLabel("live", { inning: 5, half: "bottom" }),
    ).toBe("Bot 5");
  });

  it("returns null for non-live or incomplete status", () => {
    expect(formatInningLabel("final", { inning: 7, half: "top" })).toBeNull();
    expect(formatInningLabel("live", { inning: 0, half: "top" })).toBeNull();
    expect(formatInningLabel("scheduled", null)).toBeNull();
  });
});

describe("mapWpblLiveSituation", () => {
  it("returns null when not live", () => {
    expect(
      mapWpblLiveSituation("final", {
        inning: 5,
        half: "top",
        outs: 1,
        balls: 2,
        strikes: 1,
      }),
    ).toBeNull();
  });

  it("maps count, bases, and names from boxscore status", () => {
    expect(
      mapWpblLiveSituation("live", {
        inning: 6,
        half: "top",
        outs: 1,
        balls: 1,
        strikes: 2,
        batter_name: "Olson",
        pitcher_name: "Misiorowski",
        first_base: "Runner",
        second_base: "",
        third_base: "",
        bases_occupied: [1],
      }),
    ).toEqual({
      inningNumber: 6,
      half: "top",
      balls: 1,
      strikes: 2,
      outs: 1,
      onFirst: true,
      onSecond: false,
      onThird: false,
      runnerFirst: "Runner",
      runnerSecond: null,
      runnerThird: null,
      batterName: "Olson",
      pitcherName: "Misiorowski",
    });
  });

  it("uses bases_occupied when named bases are empty", () => {
    const sit = mapWpblLiveSituation("live", {
      inning: 3,
      half: "bottom",
      outs: 2,
      balls: 0,
      strikes: 0,
      first_base: "",
      second_base: "",
      third_base: "",
      bases_occupied: [2, 3],
    });
    expect(sit).toMatchObject({
      onFirst: false,
      onSecond: true,
      onThird: true,
      runnerFirst: null,
      runnerSecond: null,
      runnerThird: null,
      outs: 2,
    });
  });
});
