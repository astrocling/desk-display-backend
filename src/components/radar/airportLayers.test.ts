import { describe, expect, it } from "vitest";
import {
  addPinnedDesignator,
  filterAirportsForDisplay,
  matchesAirportPreset,
  normalizeDesignator,
  readPinnedDesignators,
  softCapAirports,
  writePinnedDesignators,
} from "./airportLayers";

const towered = {
  icao: "KDAY",
  ident: "KDAY",
  towered: true,
  publicUse: true,
  pavedRunwayFt: 10900,
};
const publicPaved = {
  icao: "I69",
  ident: "I69",
  towered: false,
  publicUse: true,
  pavedRunwayFt: 3500,
};
const publicShort = {
  icao: "MGY",
  ident: "MGY",
  towered: false,
  publicUse: true,
  pavedRunwayFt: 2500,
};
const privateStrip = {
  icao: "0OH7",
  ident: "0OH7",
  towered: false,
  publicUse: false,
  pavedRunwayFt: 2000,
};

describe("matchesAirportPreset", () => {
  it("towered only", () => {
    expect(matchesAirportPreset(towered, "towered")).toBe(true);
    expect(matchesAirportPreset(publicPaved, "towered")).toBe(false);
  });
  it("public use", () => {
    expect(matchesAirportPreset(publicShort, "public")).toBe(true);
    expect(matchesAirportPreset(privateStrip, "public")).toBe(false);
  });
  it("public + paved >= 3000", () => {
    expect(matchesAirportPreset(publicPaved, "public_paved")).toBe(true);
    expect(matchesAirportPreset(publicShort, "public_paved")).toBe(false);
  });
  it("all includes private", () => {
    expect(matchesAirportPreset(privateStrip, "all")).toBe(true);
  });
});

describe("filterAirportsForDisplay", () => {
  it("includes pinned under towered preset", () => {
    const out = filterAirportsForDisplay(
      [towered, publicPaved],
      "towered",
      new Set(["I69"]),
    );
    expect(out.map((a) => a.icao).sort()).toEqual(["I69", "KDAY"]);
  });
});

describe("pins storage", () => {
  it("normalizes and dedupes", () => {
    expect(normalizeDesignator(" i69 ")).toBe("I69");
    expect(addPinnedDesignator(["I69"], "i69")).toEqual(["I69"]);
    expect(addPinnedDesignator([], "i69")).toEqual(["I69"]);
  });
  it("corrupt localStorage yields empty", () => {
    const storage = {
      getItem: () => "{not-json",
      setItem: () => {},
    };
    expect(readPinnedDesignators(storage)).toEqual([]);
  });
  it("round-trips", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    writePinnedDesignators(["KDAY", "I69"], storage);
    expect(readPinnedDesignators(storage)).toEqual(["KDAY", "I69"]);
  });
});

describe("softCapAirports", () => {
  it("flags when capped", () => {
    const list = Array.from({ length: 5 }, (_, i) => i);
    const { airports, capped } = softCapAirports(list, 3);
    expect(airports).toHaveLength(3);
    expect(capped).toBe(true);
  });

  it("keeps all pinned when over cap", () => {
    const list = ["a", "b", "c", "pin1", "pin2", "pin3"];
    const pinned = new Set(["pin1", "pin2", "pin3"]);
    const { airports, capped } = softCapAirports(list, 3, (id) =>
      pinned.has(id),
    );
    expect(airports).toEqual(["pin1", "pin2", "pin3"]);
    expect(capped).toBe(true);
  });

  it("fills remaining capacity with non-pinned after pinned", () => {
    const list = ["a", "b", "c", "d", "pin1", "pin2"];
    const pinned = new Set(["pin1", "pin2"]);
    const { airports, capped } = softCapAirports(list, 4, (id) =>
      pinned.has(id),
    );
    expect(airports).toEqual(["pin1", "pin2", "a", "b"]);
    expect(capped).toBe(true);
  });
});
