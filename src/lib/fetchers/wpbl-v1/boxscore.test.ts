import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapWpblGames } from "./games";
import { formatInningLabel, mapWpblBoxscore } from "./boxscore";

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
      stats: { ab: "4", h: "2", r: "1", rbi: "4" },
    });

    const ayamiPitching = box.pitching.find((p) => p.name === "Ayami Sato");
    expect(ayamiPitching).toMatchObject({
      side: "away",
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
