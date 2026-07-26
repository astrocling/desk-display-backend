import { describe, expect, it } from "vitest";

import {
  bearingDegFromCenter,
  bearingDegFromOffset,
  crossedBySweep,
  inSweepGate,
} from "./radarScope";

describe("radarScope", () => {
  it("bearing from offset is clockwise from north", () => {
    expect(bearingDegFromOffset(0, 1)).toBeCloseTo(0, 5);
    expect(bearingDegFromOffset(1, 0)).toBeCloseTo(90, 5);
    expect(bearingDegFromOffset(0, -1)).toBeCloseTo(180, 5);
    expect(bearingDegFromOffset(-1, 0)).toBeCloseTo(270, 5);
  });

  it("bearing from center matches offset math", () => {
    // Due east of center ≈ 90°
    expect(bearingDegFromCenter(40, -84, 40, -83.9)).toBeCloseTo(90, 0);
    // Due north ≈ 0°
    expect(bearingDegFromCenter(40, -84, 40.1, -84)).toBeCloseTo(0, 0);
  });

  it("illuminates only just after the beam passes", () => {
    expect(inSweepGate(10, 8, 5)).toBe(true);
    expect(inSweepGate(10, 10, 5)).toBe(true);
    expect(inSweepGate(10, 4, 5)).toBe(false); // already 6° behind
    expect(inSweepGate(10, 12, 5)).toBe(false); // still ahead of beam
  });

  it("gate wraps through north", () => {
    expect(inSweepGate(2, 359, 5)).toBe(true);
    expect(inSweepGate(2, 350, 5)).toBe(false);
  });

  it("crossedBySweep catches bearings skipped between frames", () => {
    // Frame jumped 10°; gate alone at end would miss mid-span targets.
    expect(crossedBySweep(0, 10, 6, 5)).toBe(true);
    expect(crossedBySweep(0, 10, 11, 5)).toBe(false);
    expect(crossedBySweep(350, 10, 355, 5)).toBe(true);
    // First frame: only the live gate (bearing 15 is still ahead of beam).
    expect(crossedBySweep(null, 10, 15, 5)).toBe(false);
    expect(crossedBySweep(null, 10, 8, 5)).toBe(true);
  });
});
