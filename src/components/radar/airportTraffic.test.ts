import { describe, expect, it } from "vitest";

import {
  AIRPORT_TRAFFIC_RADIUS_NM,
  classifyAirportTraffic,
  type TrafficAircraft,
} from "./airportTraffic";

describe("AIRPORT_TRAFFIC_RADIUS_NM", () => {
  it("is 150 nm", () => {
    expect(AIRPORT_TRAFFIC_RADIUS_NM).toBe(150);
  });
});

describe("classifyAirportTraffic", () => {
  it("classifies first ICAO as outbound and last ICAO as inbound", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "a1", callsign: "AAL1", routeIcaos: ["KDFW", "KDAY"] },
      { hex: "b2", callsign: "AAL2", routeIcaos: ["KDAY", "KORD"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.inbound.map((a) => a.hex)).toEqual(["a1"]);
    expect(result.outbound.map((a) => a.hex)).toEqual(["b2"]);
  });

  it("keeps first=out / last=in for multi-stop routes", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "c3", callsign: "UAL3", routeIcaos: ["KDAY", "KORD", "KSEA"] },
      { hex: "d4", callsign: "UAL4", routeIcaos: ["KSEA", "KORD", "KDAY"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.outbound.map((a) => a.hex)).toEqual(["c3"]);
    expect(result.inbound.map((a) => a.hex)).toEqual(["d4"]);
  });

  it("counts a local turnaround as outbound only, never both", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "t1", callsign: "JIA1", routeIcaos: ["KDAY", "KDAY"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.outbound.map((a) => a.hex)).toEqual(["t1"]);
    expect(result.inbound).toHaveLength(0);
  });

  it("skips aircraft with missing or empty routes", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "n1", callsign: "N123AB", routeIcaos: null },
      { hex: "n2", callsign: "N456CD", routeIcaos: [] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.inbound).toHaveLength(0);
    expect(result.outbound).toHaveLength(0);
  });

  it("does not classify unrelated routes", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "u1", callsign: "SWA1", routeIcaos: ["KMDW", "KSTL"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.inbound).toHaveLength(0);
    expect(result.outbound).toHaveLength(0);
  });

  it("normalizes ICAO case and whitespace before comparing", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "l1", callsign: "AAL5", routeIcaos: [" kdfw ", " kday "] },
    ];
    const result = classifyAirportTraffic(" kday ", aircraft);
    expect(result.inbound.map((a) => a.hex)).toEqual(["l1"]);
  });

  it("deduplicates by hex, keeping one entry per aircraft", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "dup1", callsign: "DAL1", routeIcaos: ["KDAY", "KATL"] },
      { hex: "dup1", callsign: "DAL1", routeIcaos: ["KDAY", "KATL"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.outbound).toHaveLength(1);
  });
});
