import { describe, expect, it } from "vitest";

import {
  classifyNotable,
  formatRadarAltitude,
  formatRadarSpeed,
  formatRadarTagLine2,
  formatRadarTagLine3,
  markColorFor,
  parseRadarDeclutterMode,
  radarDeclutterShortLabel,
  radarTrendFromRate,
  radarUnselectedLabel,
  vectorLengthPx,
} from "./radarFormat";

describe("radarFormat", () => {
  it("formats full and dense altitude", () => {
    expect(formatRadarAltitude(33000, "full")).toBe("F330");
    expect(formatRadarAltitude(5200, "full")).toBe("A052");
    expect(formatRadarAltitude(33000, "dense")).toBe("330");
    expect(formatRadarAltitude(5200, "dense")).toBe("052");
  });

  it("formats full and dense speed", () => {
    expect(formatRadarSpeed(475, "full")).toBe("G475");
    expect(formatRadarSpeed(475, "dense")).toBe("475");
  });

  it("builds line 2 with trend", () => {
    expect(
      formatRadarTagLine2({
        altFt: 33000,
        speedKt: 450,
        baroRateFpm: 500,
        style: "full",
      }),
    ).toBe("F330 ^ G450");
    expect(
      formatRadarTagLine2({
        altFt: 4500,
        speedKt: 280,
        baroRateFpm: -200,
        style: "dense",
      }),
    ).toBe("045 v 280");
  });

  it("builds line 3 with notable", () => {
    expect(
      formatRadarTagLine3({
        type: "B738",
        squawk: "1200",
        notable: "military",
      }),
    ).toBe("B738 1200 MIL");
  });

  it("classifies emergency squawk and military flag", () => {
    expect(
      classifyNotable({ squawk: "7700", emergency: "none", dbFlags: 0 }),
    ).toBe("emergency");
    expect(
      classifyNotable({ squawk: "1200", emergency: "none", dbFlags: 1 }),
    ).toBe("military");
  });

  it("classifies watchlist registration as interesting", () => {
    expect(
      classifyNotable({
        squawk: "1200",
        emergency: "none",
        dbFlags: 0,
        registration: "N730CF",
        callsign: "N730CF",
        interestingRegs: ["N730CF", "N130HB"],
      }),
    ).toBe("interesting");
    expect(
      classifyNotable({
        squawk: "1200",
        emergency: "none",
        dbFlags: 0,
        registration: "N999XX",
        callsign: "N999XX",
        interestingRegs: ["N730CF"],
      }),
    ).toBe("none");
  });

  it("maps mark colors", () => {
    expect(markColorFor("none", false)).toBe("#00FF00");
    expect(markColorFor("none", true)).toBe("#FFFFFF");
    expect(markColorFor("emergency", false)).toBe("#E85D4C");
  });

  it("trends and vector length", () => {
    expect(radarTrendFromRate(150)).toBe("climb");
    expect(radarTrendFromRate(-150)).toBe("descend");
    expect(radarTrendFromRate(50)).toBe("none");
    expect(vectorLengthPx(400)).toBe(16);
    expect(vectorLengthPx(1000)).toBe(28);
    expect(vectorLengthPx(null)).toBe(16);
  });

  it("maps declutter modes to unselected label density", () => {
    expect(radarUnselectedLabel("target")).toBe("none");
    expect(radarUnselectedLabel("callsign")).toBe("callsign");
    expect(radarUnselectedLabel("tag")).toBe("dense");
  });

  it("parses declutter modes with Tag default", () => {
    expect(parseRadarDeclutterMode("callsign")).toBe("callsign");
    expect(parseRadarDeclutterMode("nope")).toBe("tag");
    expect(parseRadarDeclutterMode(null)).toBe("tag");
    expect(radarDeclutterShortLabel("target")).toBe("Target");
    expect(radarDeclutterShortLabel("tag")).toBe("Tag");
  });
});
