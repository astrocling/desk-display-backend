import { describe, expect, it } from "vitest";

import {
  parseAirlineCode,
  parseAirportCodeList,
  parseAirportCodes,
  parseRouteLocations,
} from "./flight_routes_parse";

describe("parseAirportCodeList", () => {
  it("parses multi-stop chains", () => {
    expect(parseAirportCodeList("KDFW-KDAY-KDFW")).toEqual([
      "KDFW",
      "KDAY",
      "KDFW",
    ]);
  });

  it("returns empty for unknown", () => {
    expect(parseAirportCodeList("unknown")).toEqual([]);
    expect(parseAirportCodeList(null)).toEqual([]);
  });

  it("parses a single code", () => {
    expect(parseAirportCodeList("KDAY")).toEqual(["KDAY"]);
  });
});

describe("parseAirportCodes", () => {
  it("keeps first/last for tag arrival", () => {
    expect(parseAirportCodes("KDFW-KDAY-KORD")).toEqual({
      originIcao: "KDFW",
      arrivalIcao: "KORD",
    });
  });
});

describe("parseRouteLocations", () => {
  const codes = ["KDFW", "KDAY", "KDFW"];
  const airports = [
    { icao: "KDFW", location: "Dallas-Fort Worth" },
    { icao: "KDAY", location: "Dayton" },
    { icao: "KDFW", location: "Dallas-Fort Worth" },
  ];

  it("aligns locations when lengths and ICAOs match", () => {
    expect(parseRouteLocations(codes, airports)).toEqual([
      "Dallas-Fort Worth",
      "Dayton",
      "Dallas-Fort Worth",
    ]);
  });

  it("returns empty on length mismatch", () => {
    expect(parseRouteLocations(codes, airports.slice(0, 2))).toEqual([]);
  });

  it("returns empty on ICAO misalignment", () => {
    const bad = [
      { icao: "KORD", location: "Chicago" },
      { icao: "KDAY", location: "Dayton" },
      { icao: "KDFW", location: "Dallas-Fort Worth" },
    ];
    expect(parseRouteLocations(codes, bad)).toEqual([]);
  });
});

describe("parseAirlineCode", () => {
  it("normalizes airline codes", () => {
    expect(parseAirlineCode("jia")).toBe("JIA");
    expect(parseAirlineCode("")).toBeNull();
    expect(parseAirlineCode(12)).toBeNull();
  });
});
