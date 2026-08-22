import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapWpblGames } from "./games";
import { formatInningLabel, mapWpblBoxscore, mapWpblLiveSituation } from "./boxscore";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/boxscore-trimmed.json"),
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
      stats: { ab: "4", h: "2", r: "1", rbi: "4" },
    });

    const ayamiPitching = box.pitching.find((p) => p.name === "Ayami Sato");
    expect(ayamiPitching).toMatchObject({
      side: "away",
      position: "P",
      stats: { ip: "3.0", h: "10", r: "7", er: "4" },
    });

    expect(box.batting.some((p) => p.name === "Caitlin Eynon")).toBe(false);
    expect(box.pitching.some((p) => p.name === "Caitlin Eynon")).toBe(false);
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
      outs: 2,
    });
  });
});
