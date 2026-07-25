import { describe, expect, it } from "vitest";

import {
  clamp,
  haversineMiles,
  milesToNm,
  viewportRadiusMiles,
} from "@/components/radar/geo";

describe("radar geo helpers", () => {
  it("computes haversine between nearby points", () => {
    // ~69 mi per degree latitude
    const d = haversineMiles(40, -84, 41, -84);
    expect(d).toBeGreaterThan(68);
    expect(d).toBeLessThan(70);
  });

  it("converts miles to nautical miles", () => {
    expect(milesToNm(100)).toBeCloseTo(86.8976, 3);
  });

  it("clamps values", () => {
    expect(clamp(3, 5, 50)).toBe(5);
    expect(clamp(25, 5, 50)).toBe(25);
    expect(clamp(80, 5, 50)).toBe(50);
  });

  it("estimates viewport radius from NE corner", () => {
    const r = viewportRadiusMiles(40.03, -84.19, 40.5, -83.7);
    expect(r).toBeGreaterThan(30);
    expect(r).toBeLessThan(80);
  });
});
