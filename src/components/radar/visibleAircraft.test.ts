import { describe, expect, it } from "vitest";

import { haversineMiles } from "./geo";
import {
  GROUND_MAX_ALT_FT,
  GROUND_NEAR_MI,
  visibleAircraftFor,
} from "./visibleAircraft";

type Ac = {
  hex: string;
  onGround?: boolean;
  altFt: number | null;
  lat: number;
  lon: number;
};

const FIELD = { lat: 39.0488, lon: -84.6678 }; // CVG-ish

function ac(partial: Partial<Ac> & Pick<Ac, "hex">): Ac {
  return {
    onGround: false,
    altFt: 5000,
    lat: FIELD.lat,
    lon: FIELD.lon,
    ...partial,
  };
}

const parked = ac({ hex: "gnd1", onGround: true, altFt: 0 });
const lowNear = ac({ hex: "low1", onGround: false, altFt: 400 });
const highNear = ac({ hex: "hi1", onGround: false, altFt: 3000 });
const parkedFar = ac({
  hex: "gndFar",
  onGround: true,
  altFt: 0,
  lat: FIELD.lat + 0.2, // ~14 mi north
  lon: FIELD.lon,
});

const all = [parked, lowNear, highNear, parkedFar];

describe("visibleAircraftFor", () => {
  it("overview + ground targets off: drops onGround only", () => {
    const out = visibleAircraftFor(all, null, false);
    expect(out.map((a) => a.hex).sort()).toEqual(["hi1", "low1"]);
  });

  it("overview + ground targets on: returns all", () => {
    const out = visibleAircraftFor(all, null, true);
    expect(out.map((a) => a.hex).sort()).toEqual([
      "gnd1",
      "gndFar",
      "hi1",
      "low1",
    ]);
  });

  it("ground mode + ground targets on: near low/onGround only", () => {
    const out = visibleAircraftFor(all, FIELD, true);
    expect(out.map((a) => a.hex).sort()).toEqual(["gnd1", "low1"]);
  });

  it("ground mode + ground targets off: near low airborne only", () => {
    const out = visibleAircraftFor(all, FIELD, false);
    expect(out.map((a) => a.hex)).toEqual(["low1"]);
  });

  it("ground mode: altFt === GROUND_MAX_ALT_FT is not low (< is exclusive)", () => {
    const atMaxAlt = ac({
      hex: "maxAlt",
      onGround: false,
      altFt: GROUND_MAX_ALT_FT,
    });
    const out = visibleAircraftFor([atMaxAlt, lowNear], FIELD, true);
    expect(out.map((a) => a.hex)).toEqual(["low1"]);
  });

  it("ground mode: distance === GROUND_NEAR_MI is included (<= is inclusive)", () => {
    let lo = FIELD.lat;
    let hi = FIELD.lat + 0.2;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const d = haversineMiles(FIELD.lat, FIELD.lon, mid, FIELD.lon);
      if (d <= GROUND_NEAR_MI) lo = mid;
      else hi = mid;
    }
    const atBoundary = ac({
      hex: "bound6",
      onGround: false,
      altFt: 100,
      lat: lo,
      lon: FIELD.lon,
    });
    const dist = haversineMiles(
      FIELD.lat,
      FIELD.lon,
      atBoundary.lat,
      atBoundary.lon,
    );
    expect(dist).toBeLessThanOrEqual(GROUND_NEAR_MI);
    expect(dist).toBeCloseTo(GROUND_NEAR_MI, 2);
    const out = visibleAircraftFor([atBoundary], FIELD, true);
    expect(out.map((a) => a.hex)).toEqual(["bound6"]);
  });
});
