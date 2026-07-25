import { describe, expect, it } from "vitest";

import {
  RADAR_INTERESTING_REGS_DEFAULT,
  isValidWatchlistReg,
  normalizeWatchlistRegs,
} from "./radar-watchlist";

describe("radar watchlist", () => {
  it("seeds with CareFlight / Medflight defaults", () => {
    expect(RADAR_INTERESTING_REGS_DEFAULT).toContain("N730CF");
    expect(RADAR_INTERESTING_REGS_DEFAULT).toContain("N130NB");
    expect(RADAR_INTERESTING_REGS_DEFAULT.length).toBe(12);
  });

  it("normalizes, dedupes, and drops invalid ids", () => {
    expect(
      normalizeWatchlistRegs([" n730cf ", "N730CF", "bad id!", "AB", 12]),
    ).toEqual(["N730CF", "AB"]);
  });

  it("validates registration shape", () => {
    expect(isValidWatchlistReg("N730CF")).toBe(true);
    expect(isValidWatchlistReg("n130hb")).toBe(true);
    expect(isValidWatchlistReg("A")).toBe(false);
    expect(isValidWatchlistReg("TOO LONG TAILXX")).toBe(false);
  });
});
