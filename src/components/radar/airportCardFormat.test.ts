import { describe, expect, it } from "vitest";
import {
  formatAirportFreqLine,
  formatAirportRunwayLabel,
  formatAirportSubtitle,
  formatAirportTrafficSummary,
  formatAirportWeatherRows,
} from "./airportCardFormat";

describe("airportCardFormat", () => {
  it("formats subtitle", () => {
    expect(
      formatAirportSubtitle({ municipality: "Dayton", elevFt: 1009 }),
    ).toBe("Dayton · 1009 ft");
    expect(formatAirportSubtitle({ municipality: null, elevFt: null })).toBeNull();
  });

  it("builds weather rows and omits empties", () => {
    const { row1, row2, raw } = formatAirportWeatherRows({
      raw: "METAR KDAY ...",
      flightCategory: "VFR",
      wind: "230@11kt",
      visibility: "10SM",
      ceiling: "BKN250",
      tempC: 28.9,
      dewpointC: 20.6,
      altimeterInHg: 29.86,
      observed: null,
    });
    expect(row1[0]).toBe("VFR");
    expect(row1).toContain("230@11kt");
    expect(row2.some((p) => p.includes("29/21") || p.includes("28.9"))).toBe(true);
    expect(raw).toContain("METAR");
  });

  it("formats runway with lighted", () => {
    expect(
      formatAirportRunwayLabel({
        leIdent: "06L",
        heIdent: "24R",
        lengthFt: 10901,
        widthFt: 150,
        surface: "ASP",
        lighted: true,
        leLat: 0,
        leLon: 0,
        heLat: 0,
        heLon: 0,
        leHeadingDeg: null,
        heHeadingDeg: null,
      }),
    ).toMatch(/06L\/24R/);
    expect(
      formatAirportRunwayLabel({
        leIdent: "06L",
        heIdent: "24R",
        lengthFt: 10901,
        widthFt: 150,
        surface: "ASP",
        lighted: true,
        leLat: 0,
        leLon: 0,
        heLat: 0,
        heLon: 0,
        leHeadingDeg: null,
        heHeadingDeg: null,
      }),
    ).toMatch(/lighted/i);
  });

  it("formats freqs and traffic", () => {
    expect(
      formatAirportFreqLine([
        { type: "ATIS", description: "ATIS", mhz: 134.875 },
        { type: "TWR", description: "Tower", mhz: 119.9 },
      ]),
    ).toBe("ATIS 134.875 · TWR 119.9");
    expect(
      formatAirportTrafficSummary({ inbound: 3, outbound: 1 }),
    ).toBe("Inbound 3 · Outbound 1");
    expect(
      formatAirportTrafficSummary({ inbound: 0, outbound: 0 }),
    ).toBeNull();
  });
});
