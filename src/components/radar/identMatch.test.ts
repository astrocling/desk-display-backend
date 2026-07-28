import { describe, expect, it } from "vitest";

import {
  aircraftMatchesIdent,
  isExactSquawkMatch,
  normalizeIdentQuery,
  pickBestIdentMatch,
} from "./identMatch";

type Ac = {
  hex: string;
  callsign: string;
  squawk: string;
  lat: number;
  lon: number;
};

const CENTER = { lat: 39.05, lon: -84.67 };

function ac(partial: Partial<Ac> & Pick<Ac, "hex">): Ac {
  return {
    callsign: "N123AB",
    squawk: "1200",
    lat: CENTER.lat,
    lon: CENTER.lon,
    ...partial,
  };
}

describe("normalizeIdentQuery", () => {
  it("trims, uppercases, strips spaces", () => {
    expect(normalizeIdentQuery("  aa l 529 ")).toBe("AAL529");
  });
});

describe("aircraftMatchesIdent", () => {
  it("empty query matches nothing", () => {
    expect(aircraftMatchesIdent(ac({ hex: "a" }), "")).toBe(false);
    expect(aircraftMatchesIdent(ac({ hex: "a" }), "   ")).toBe(false);
  });

  it("matches callsign substring", () => {
    const a = ac({ hex: "a", callsign: "AAL529" });
    expect(aircraftMatchesIdent(a, "529")).toBe(true);
    expect(aircraftMatchesIdent(a, "aal")).toBe(true);
    expect(aircraftMatchesIdent(a, "UAL")).toBe(false);
  });

  it("matches squawk digit substring", () => {
    const a = ac({ hex: "a", squawk: "0475", callsign: "N1" });
    expect(aircraftMatchesIdent(a, "475")).toBe(true);
    expect(aircraftMatchesIdent(a, "0475")).toBe(true);
    expect(aircraftMatchesIdent(a, "1200")).toBe(false);
  });

  it("matches if either field hits", () => {
    const a = ac({ hex: "a", callsign: "SWA100", squawk: "7700" });
    expect(aircraftMatchesIdent(a, "SWA")).toBe(true);
    expect(aircraftMatchesIdent(a, "7700")).toBe(true);
  });
});

describe("isExactSquawkMatch", () => {
  it("pads numeric query to 4 digits", () => {
    const a = ac({ hex: "a", squawk: "0075" });
    expect(isExactSquawkMatch(a, "75")).toBe(true);
    expect(isExactSquawkMatch(a, "0075")).toBe(true);
    expect(isExactSquawkMatch(a, "075")).toBe(true);
  });

  it("false for non-exact squawk", () => {
    const a = ac({ hex: "a", squawk: "0475" });
    expect(isExactSquawkMatch(a, "475")).toBe(false);
  });

  it("matches squawk longer than 4 digits without padding", () => {
    const a = ac({ hex: "a", squawk: "12001" });
    expect(isExactSquawkMatch(a, "12001")).toBe(true);
    expect(isExactSquawkMatch(a, "1200")).toBe(false);
  });
});

describe("pickBestIdentMatch", () => {
  it("returns null when no matches", () => {
    expect(pickBestIdentMatch([], CENTER, "529")).toBeNull();
  });

  it("prefers exact squawk over nearer callsign-only match", () => {
    const nearCallsign = ac({
      hex: "near",
      callsign: "XYZ75",
      squawk: "1200",
      lat: CENTER.lat,
      lon: CENTER.lon,
    });
    const farExact = ac({
      hex: "far",
      callsign: "N9",
      squawk: "0075",
      lat: CENTER.lat + 0.5,
      lon: CENTER.lon,
    });
    const best = pickBestIdentMatch([nearCallsign, farExact], CENTER, "75");
    expect(best?.hex).toBe("far");
  });

  it("among non-exact, picks closest then lower hex", () => {
    const far = ac({
      hex: "b",
      callsign: "AAL529",
      squawk: "1200",
      lat: CENTER.lat + 0.2,
      lon: CENTER.lon,
    });
    const nearHighHex = ac({
      hex: "c",
      callsign: "UAL529",
      squawk: "1200",
      lat: CENTER.lat + 0.01,
      lon: CENTER.lon,
    });
    const nearLowHex = ac({
      hex: "a",
      callsign: "DAL529",
      squawk: "1200",
      lat: CENTER.lat + 0.01,
      lon: CENTER.lon,
    });
    const best = pickBestIdentMatch(
      [far, nearHighHex, nearLowHex],
      CENTER,
      "529",
    );
    expect(best?.hex).toBe("a");
  });
});
