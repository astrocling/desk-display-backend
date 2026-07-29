import { describe, expect, it } from "vitest";

import type { MapAirport } from "@/lib/fetchers/map_context";

import {
  buildCatalogByIdent,
  lookupAirportByDesignator,
} from "./airport_lookup";

const CLERMONT: MapAirport = {
  icao: "KI69",
  ident: "KI69",
  name: "Clermont County Airport",
  lat: 39.0784,
  lon: -84.210197,
  towered: false,
  publicUse: true,
  pavedRunwayFt: 3567,
};

const DAYTON: MapAirport = {
  icao: "KDAY",
  ident: "KDAY",
  name: "Dayton International Airport",
  lat: 39.902375,
  lon: -84.219375,
  towered: true,
  publicUse: true,
  pavedRunwayFt: 10900,
};

describe("lookupAirportByDesignator", () => {
  const designators = {
    I69: "KI69",
    KI69: "KI69",
    KDAY: "KDAY",
    DAY: "KDAY",
  };
  const catalogByIdent = buildCatalogByIdent([CLERMONT, DAYTON]);

  it("resolves a local designator case-insensitively", () => {
    expect(
      lookupAirportByDesignator("i69", designators, catalogByIdent),
    ).toEqual({
      ok: true,
      ident: "KI69",
      icao: "KI69",
      name: "Clermont County Airport",
    });
  });

  it("resolves a primary ident directly from the catalog", () => {
    expect(
      lookupAirportByDesignator("kday", designators, catalogByIdent),
    ).toEqual({
      ok: true,
      ident: "KDAY",
      icao: "KDAY",
      name: "Dayton International Airport",
    });
  });

  it("returns not_found for unknown designators", () => {
    expect(
      lookupAirportByDesignator("ZZZZ", designators, catalogByIdent),
    ).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns not_found for blank queries", () => {
    expect(lookupAirportByDesignator("  ", designators, catalogByIdent)).toEqual(
      {
        ok: false,
        error: "not_found",
      },
    );
  });
});
