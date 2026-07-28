import { describe, expect, it } from "vitest";

import { visibleAircraftFor } from "./visibleAircraft";

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
});
