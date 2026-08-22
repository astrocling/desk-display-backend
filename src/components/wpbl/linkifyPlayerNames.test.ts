import { describe, expect, it } from "vitest";

import type { WpblBoxPlayerLine } from "@/lib/types/wpbl-display";
import {
  resolvePlayerId,
  resolvePlayerIdFromBox,
} from "@/lib/wpbl-player-match";

import { rosterFromBoxLines } from "./linkifyPlayerNames";

const batting: WpblBoxPlayerLine[] = [
  {
    side: "away",
    name: "Mo'ne Davis",
    playerId: "mone",
    position: "CF",
    battingOrder: 1,
    uniform: "3",
    stats: {},
  },
  {
    side: "away",
    name: "Amira Hondras",
    playerId: "amira",
    position: "2B",
    battingOrder: 2,
    uniform: null,
    stats: {},
  },
];

const pitching: WpblBoxPlayerLine[] = [
  {
    side: "home",
    name: "Ayami Sato",
    playerId: "ayami",
    position: "P",
    battingOrder: null,
    uniform: "18",
    stats: {},
  },
];

describe("resolvePlayerId", () => {
  it("resolves short and full names", () => {
    expect(resolvePlayerId(batting, "Davis")).toBe("mone");
    expect(resolvePlayerId(batting, "Mo'ne Davis")).toBe("mone");
    expect(resolvePlayerIdFromBox(batting, pitching, "Sato")).toBe("ayami");
  });
});

describe("rosterFromBoxLines", () => {
  it("dedupes by id and sorts longest name first", () => {
    const roster = rosterFromBoxLines(batting, pitching);
    expect(roster.map((p) => p.playerId)).toEqual(["amira", "mone", "ayami"]);
    expect(roster[0].name.length).toBeGreaterThanOrEqual(roster[1].name.length);
  });
});
