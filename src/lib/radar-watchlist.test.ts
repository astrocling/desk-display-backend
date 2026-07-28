import { describe, expect, it } from "vitest";

import {
  RADAR_INTERESTING_ENTRIES_DEFAULT,
  RADAR_INTERESTING_REGS_DEFAULT,
  WATCHLIST_COLORS,
  isValidWatchlistReg,
  normalizeWatchlistEntries,
  normalizeWatchlistNote,
  normalizeWatchlistRegs,
  parseWatchlistColor,
} from "./radar-watchlist";

describe("radar watchlist", () => {
  it("seeds CareFlight / Medflight defaults with notes", () => {
    expect(RADAR_INTERESTING_ENTRIES_DEFAULT).toEqual([
      { id: "N730CF", note: "CAREFLT1" },
      { id: "N841CF", note: "CAREFLT1" },
      { id: "N520CF", note: "CAREFLT2" },
      { id: "N3842", note: "CAREFLT2" },
      { id: "N164CF", note: "CAREFLT3" },
      { id: "N942CF", note: "CAREFLT4" },
      { id: "N625CF", note: "CAREFLT4" },
      { id: "N130HB", note: "MEDFLT1" },
      { id: "N130JV", note: "MEDFLT2" },
      { id: "N130KH", note: "MEDFLT3" },
      { id: "N130MU", note: "MEDFLT6" },
      { id: "N130NB", note: "MEDFLT9" },
    ]);
    expect(RADAR_INTERESTING_REGS_DEFAULT).toEqual(
      RADAR_INTERESTING_ENTRIES_DEFAULT.map((e) => e.id),
    );
    expect(RADAR_INTERESTING_REGS_DEFAULT).toContain("N730CF");
    expect(RADAR_INTERESTING_REGS_DEFAULT).toContain("N130NB");
    expect(RADAR_INTERESTING_REGS_DEFAULT.length).toBe(12);
  });

  it("migrates legacy string arrays to entry objects", () => {
    expect(normalizeWatchlistEntries([" n730cf ", "N841CF"])).toEqual([
      { id: "N730CF" },
      { id: "N841CF" },
    ]);
  });

  it("normalizes object entries, dedupes, drops bad ids, truncates notes, invalid colors", () => {
    expect(
      normalizeWatchlistEntries([
        { id: " n730cf ", note: " care flt 1 ", color: "amber" },
        { id: "N730CF", note: "DUPLICATE" },
        { id: "bad id!", note: "X" },
        { id: "AB", note: "  ", color: "not-a-color" },
        { id: "N841CF", note: "THISNOTEISTOOLONG", color: "green" },
        12,
        "legacy",
        { id: "N520CF", color: "default" },
      ]),
    ).toEqual([
      { id: "N730CF", note: "CAREFLT1", color: "amber" },
      { id: "AB" },
      { id: "N841CF", note: "THISNOTEISTO", color: "green" },
      { id: "LEGACY" },
      { id: "N520CF" },
    ]);
  });

  it("normalizes notes and parses colors", () => {
    expect(normalizeWatchlistNote(" care flt 1 ")).toBe("CAREFLT1");
    expect(normalizeWatchlistNote("   ")).toBeUndefined();
    expect(normalizeWatchlistNote("THISNOTEISTOOLONG")).toBe("THISNOTEISTO");
    expect(parseWatchlistColor("amber")).toBe("amber");
    expect(parseWatchlistColor("default")).toBeUndefined();
    expect(parseWatchlistColor("nope")).toBeUndefined();
    expect(WATCHLIST_COLORS).toEqual([
      "default",
      "amber",
      "alert",
      "green",
      "violet",
    ]);
  });

  it("keeps normalizeWatchlistRegs as id wrapper", () => {
    expect(
      normalizeWatchlistRegs([" n730cf ", "N730CF", "bad id!", "AB", 12]),
    ).toEqual(["N730CF", "AB"]);
    expect(
      normalizeWatchlistRegs([{ id: "n841cf", note: "CAREFLT1" }]),
    ).toEqual(["N841CF"]);
  });

  it("validates registration shape", () => {
    expect(isValidWatchlistReg("N730CF")).toBe(true);
    expect(isValidWatchlistReg("n130hb")).toBe(true);
    expect(isValidWatchlistReg("A")).toBe(false);
    expect(isValidWatchlistReg("TOO LONG TAILXX")).toBe(false);
  });
});
