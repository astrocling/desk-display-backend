import { describe, expect, it } from "vitest";

import {
  classifyNotable,
  findWatchlistEntry,
  formatRadarAltitude,
  formatRadarSpeed,
  formatRadarTagLine2,
  formatRadarTagLine3,
  markColorFor,
  parseRadarDeclutterMode,
  radarDeclutterShortLabel,
  radarTrendFromRate,
  radarUnselectedLabel,
  tagLine1Display,
  vectorLengthPx,
  watchlistColorHex,
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

  it("puts arrival ICAO next to type on line 3", () => {
    expect(
      formatRadarTagLine3({
        type: "B772",
        squawk: "2204",
        notable: "none",
        arrivalIcao: "LSZH",
      }),
    ).toBe("B772 LSZH 2204");
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

  it("classifies watchlist entries as interesting", () => {
    expect(
      classifyNotable({
        squawk: "1200",
        emergency: "none",
        dbFlags: 0,
        registration: "N730CF",
        callsign: "N730CF",
        interestingEntries: [{ id: "N730CF", color: "amber" }],
      }),
    ).toBe("interesting");
    expect(
      classifyNotable({
        squawk: "1200",
        emergency: "none",
        dbFlags: 0,
        registration: "N999XX",
        callsign: "N999XX",
        interestingEntries: [{ id: "N730CF" }],
      }),
    ).toBe("none");
  });

  it("maps watchlistColorHex tokens", () => {
    expect(watchlistColorHex(undefined)).toBe("#3D9CF0");
    expect(watchlistColorHex("default")).toBe("#3D9CF0");
    expect(watchlistColorHex("amber")).toBe("#C4A35A");
    expect(watchlistColorHex("alert")).toBe("#E85D4C");
    expect(watchlistColorHex("green")).toBe("#3DCF8E");
    expect(watchlistColorHex("violet")).toBe("#A78BFA");
  });

  it("findWatchlistEntry matches registration or callsign", () => {
    const entries = [
      { id: "N730CF", note: "CareFlight", color: "amber" as const },
      { id: "SWA123", color: "violet" as const },
    ];
    expect(findWatchlistEntry("n730cf", "N730CF", entries)?.id).toBe("N730CF");
    expect(findWatchlistEntry("", "swa123", entries)?.id).toBe("SWA123");
    expect(findWatchlistEntry("N999XX", "UAL1", entries)).toBeUndefined();
  });

  it("maps mark colors", () => {
    expect(markColorFor("none", false)).toBe("#00FF00");
    expect(markColorFor("none", true)).toBe("#FFFFFF");
    expect(markColorFor("emergency", false)).toBe("#E85D4C");
    expect(markColorFor("interesting", false)).toBe("#3D9CF0");
    expect(markColorFor("interesting", false, "amber")).toBe("#C4A35A");
    expect(markColorFor("interesting", false, "green")).toBe("#3DCF8E");
    expect(markColorFor("emergency", false, "violet")).toBe("#E85D4C");
  });

  it("rotates tagLine1Display between callsign and note", () => {
    expect(tagLine1Display("N730CF", "CareFlight", 0)).toBe("N730CF");
    expect(tagLine1Display("N730CF", "CareFlight", 1)).toBe("CareFlight");
    expect(tagLine1Display("N730CF", undefined, 1)).toBe("N730CF");
    expect(tagLine1Display("N730CF", "", 1)).toBe("N730CF");
    expect(tagLine1Display("N730CF", "n730cf", 1)).toBe("N730CF");
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
