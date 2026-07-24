import { describe, expect, it } from "vitest";

import {
  buildAirspaceRingsFromGeoJson,
  buildToweredAirportsFromCsv,
  douglasPeucker,
  filterMapContext,
  simplifyRingToMaxVerts,
} from "./map_context";

const AIRPORTS_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
3481,"KDAY","medium_airport","James M. Cox Dayton International Airport",39.902401,-84.219398,1009,"NA","US","US-OH","Dayton","yes","KDAY","DAY","KDAY","DAY",,,
9999,"00AA","small_airport","Aero B Ranch Airport",38.704022,-101.473911,3435,"NA","US","US-KS","Leoti","no",,,"00AA","00AA",,,
`;

const FREQUENCIES_CSV = `"id","airport_ref","airport_ident","type","description","frequency_mhz"
100001,3481,"KDAY","TWR","DAYTON TWR",119.4
100002,9999,"00AA","CTAF","CTAF",122.9
`;

const AIRSPACE_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        type: "CLASS_D",
        identifier: "KDAY",
        name: "DAYTON CLASS D",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-84.25, 39.92],
            [-84.2, 39.93],
            [-84.18, 39.9],
            [-84.25, 39.92],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        type: "CLASS_E2",
        identifier: "REMOTE",
        name: "CLASS E ONLY",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100.0, 40.0],
            [-99.9, 40.1],
            [-99.8, 40.0],
            [-100.0, 40.0],
          ],
        ],
      },
    },
  ],
});

describe("buildToweredAirportsFromCsv", () => {
  it("emits only airports with a TWR frequency type", () => {
    const airports = buildToweredAirportsFromCsv(AIRPORTS_CSV, FREQUENCIES_CSV);

    expect(airports).toEqual([
      {
        icao: "KDAY",
        name: "James M. Cox Dayton International Airport",
        lat: 39.902401,
        lon: -84.219398,
      },
    ]);
  });
});

describe("buildAirspaceRingsFromGeoJson", () => {
  it("keeps only Class B/C/D rings with simplified lat/lon points", () => {
    const rings = buildAirspaceRingsFromGeoJson(AIRSPACE_GEOJSON);

    expect(rings).toHaveLength(1);
    expect(rings[0].class).toBe("D");
    expect(rings[0].id).toBe("KDAY_D");
    expect(rings[0].points[0]).toEqual([39.92, -84.25]);
    expect(rings[0].points.length).toBeLessThanOrEqual(60);
  });
});

describe("filterMapContext", () => {
  const towered = buildToweredAirportsFromCsv(AIRPORTS_CSV, FREQUENCIES_CSV);
  const rings = buildAirspaceRingsFromGeoJson(AIRSPACE_GEOJSON);

  it("returns only airports inside the radius, nearest first", () => {
    const nearDayton = filterMapContext(39.9, -84.22, 30, towered, rings);
    expect(nearDayton.airports).toHaveLength(1);
    expect(nearDayton.airports[0].icao).toBe("KDAY");

    const farAway = filterMapContext(45.0, -93.0, 10, towered, rings);
    expect(farAway.airports).toHaveLength(0);
  });

  it("includes rings with a vertex inside the radius", () => {
    const result = filterMapContext(39.92, -84.22, 15, towered, rings);
    expect(result.rings).toHaveLength(1);
    expect(result.rings[0].id).toBe("KDAY_D");
  });

  it("excludes rings outside the radius", () => {
    const result = filterMapContext(45.0, -93.0, 5, towered, rings);
    expect(result.rings).toHaveLength(0);
  });
});

describe("douglasPeucker", () => {
  it("simplifies dense polylines", () => {
    const dense: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      dense.push([39.9 + i * 0.0001, -84.2 + Math.sin(i / 10) * 0.001]);
    }

    const simplified = simplifyRingToMaxVerts(dense, 60);
    expect(simplified.length).toBeLessThanOrEqual(60);
    expect(simplified.length).toBeGreaterThan(2);
    expect(douglasPeucker(dense, 1).length).toBeLessThan(dense.length);
  });
});

describe("loadMapContextData", () => {
  it("loads committed data/map JSON after cache clear", async () => {
    const {
      clearMapContextCacheForTests,
      loadMapContextData,
    } = await import("./map_context");

    clearMapContextCacheForTests();
    const data = await loadMapContextData();
    expect(data.towered.length).toBeGreaterThan(0);
    expect(data.rings.length).toBeGreaterThan(0);
    expect(data.towered.some((a) => a.icao === "KDAY")).toBe(true);
  });
});
