import { describe, expect, it } from "vitest";

import { expandAircraftType, expandAirline, labelAirline, labelAircraftType } from "@/lib/radar-expand";
import {
  formatSelectionCities,
  formatSelectionFooterLeft,
  formatSelectionHdg,
  formatSelectionRoute,
  formatSelectionTelemetryRow1,
  formatSelectionTelemetryRow2,
  formatSelectionVs,
} from "@/components/radar/selectionCardFormat";

describe("radar-expand", () => {
  it("expands known type and airline", () => {
    expect(expandAircraftType("CRJ9")).toBe("CRJ-900");
    expect(expandAirline("JIA")).toBe("PSA");
  });

  it("falls back to raw codes via label helpers", () => {
    expect(labelAircraftType("ZZZZ")).toBe("ZZZZ");
    expect(labelAirline("ZZZ")).toBe("ZZZ");
  });
});

describe("selectionCardFormat", () => {
  it("formats multi-stop route and cities", () => {
    expect(formatSelectionRoute(["KDFW", "KDAY", "KDFW"])).toBe(
      "KDFW → KDAY → KDFW",
    );
    expect(
      formatSelectionCities(
        ["KDFW", "KDAY", "KDFW"],
        ["Dallas-Fort Worth", "Dayton", "Dallas-Fort Worth"],
      ),
    ).toBe("Dallas-Fort Worth · Dayton · Dallas-Fort Worth");
  });

  it("omits cities when lengths mismatch", () => {
    expect(formatSelectionCities(["KDFW", "KDAY"], ["Dallas"])).toBeNull();
  });

  it("formats hdg and vs with deadband", () => {
    expect(formatSelectionHdg(248.4)).toBe("HDG 248");
    expect(formatSelectionVs(1200)).toBe("+1200 fpm");
    expect(formatSelectionVs(-50)).toBeNull();
    expect(formatSelectionVs(400, true)).toBeNull();
  });

  it("builds telemetry rows for airborne and ground", () => {
    expect(
      formatSelectionTelemetryRow1({
        altFt: 3400,
        speedKt: 222,
        baroRateFpm: 1200,
        trackDeg: 248,
      }),
    ).toEqual(["A034 ^", "G222", "HDG 248"]);

    expect(
      formatSelectionTelemetryRow1({
        altFt: 0,
        speedKt: 12,
        baroRateFpm: 0,
        trackDeg: 90,
        onGround: true,
      }),
    ).toEqual(["GND", "G012", "HDG 90"]);

    expect(
      formatSelectionTelemetryRow2({
        type: "CRJ9",
        squawk: "4046",
        baroRateFpm: 1200,
      }),
    ).toEqual(["CRJ9", "4046", "+1200 fpm"]);
  });

  it("builds footer left", () => {
    expect(
      formatSelectionFooterLeft({ airlineCode: "JIA", type: "CRJ9" }),
    ).toBe("PSA · CRJ-900");
    expect(formatSelectionFooterLeft({ airlineCode: null, type: "" })).toBeNull();
  });
});
