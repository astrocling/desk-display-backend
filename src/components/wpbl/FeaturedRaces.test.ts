import { describe, expect, it } from "vitest";

import { formatRaceDelta } from "./FeaturedRaces";

describe("formatRaceDelta", () => {
  it("formats counting leads as +N", () => {
    expect(formatRaceDelta(12, 10)).toBe("+2");
    expect(formatRaceDelta(7, 7)).toBe("tied");
  });

  it("formats rate / ERA gaps with trimmed decimals", () => {
    expect(formatRaceDelta(0.312, 0.3)).toBe("+0.012");
    expect(formatRaceDelta(1.93, 2.15)).toBe("+0.22");
  });
});
