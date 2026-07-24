import { describe, expect, it } from "vitest";

import {
  buildAirspaceRingsFromGeoJson,
  buildHighwaysFromGeoJson,
  buildToweredAirportsFromCsv,
  douglasPeucker,
  filterMapContext,
  normalizeInterstateRoute,
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
        type: "CLASS_D",
        identifier: "KDAY",
        name: "DAYTON CLASS D OUTER",
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-84.28, 39.95],
              [-84.15, 39.95],
              [-84.15, 39.85],
              [-84.28, 39.85],
              [-84.28, 39.95],
            ],
          ],
          [
            [
              [-84.32, 39.98],
              [-84.12, 39.98],
              [-84.12, 39.82],
              [-84.32, 39.82],
              [-84.32, 39.98],
            ],
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

const HIGHWAYS_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ROUTE_NUM: "I75" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-84.19, 40.05],
          [-84.2, 39.9],
          [-84.21, 39.75],
        ],
      },
    },
    {
      type: "Feature",
      properties: { ROUTE_NUM: "US35" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-84.3, 39.9],
          [-84.1, 39.9],
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
  it("keeps only Class B/C/D rings and emits every shelf polygon", () => {
    const rings = buildAirspaceRingsFromGeoJson(AIRSPACE_GEOJSON);

    // 1 Polygon + 2 MultiPolygon parts; Class E dropped
    expect(rings).toHaveLength(3);
    expect(rings.every((r) => r.class === "D")).toBe(true);
    expect(rings.map((r) => r.id)).toEqual([
      "KDAY_D_0",
      "KDAY_D_1",
      "KDAY_D_2",
    ]);
    expect(rings[0].points[0]).toEqual([39.92, -84.25]);
    expect(rings[0].points.length).toBeLessThanOrEqual(60);
  });
});

describe("buildHighwaysFromGeoJson", () => {
  it("keeps interstate routes only and normalizes ids", () => {
    const highways = buildHighwaysFromGeoJson(HIGHWAYS_GEOJSON);
    expect(highways).toHaveLength(1);
    expect(highways[0].route).toBe("I-75");
    expect(highways[0].id).toBe("I-75");
    expect(highways[0].points[0]).toEqual([40.05, -84.19]);
  });
});

describe("normalizeInterstateRoute", () => {
  it("normalizes I10 / I-10 forms", () => {
    expect(normalizeInterstateRoute("I10")).toBe("I-10");
    expect(normalizeInterstateRoute("I-75")).toBe("I-75");
    expect(normalizeInterstateRoute("US35")).toBeNull();
  });
});

describe("filterMapContext", () => {
  const towered = buildToweredAirportsFromCsv(AIRPORTS_CSV, FREQUENCIES_CSV);
  const rings = buildAirspaceRingsFromGeoJson(AIRSPACE_GEOJSON);
  const highways = buildHighwaysFromGeoJson(HIGHWAYS_GEOJSON);

  it("returns only airports inside the radius, nearest first", () => {
    const nearDayton = filterMapContext(
      39.9,
      -84.22,
      30,
      towered,
      rings,
      highways,
    );
    expect(nearDayton.airports).toHaveLength(1);
    expect(nearDayton.airports[0].icao).toBe("KDAY");

    const farAway = filterMapContext(45.0, -93.0, 10, towered, rings, highways);
    expect(farAway.airports).toHaveLength(0);
  });

  it("includes rings with a vertex inside the radius", () => {
    const result = filterMapContext(39.92, -84.22, 15, towered, rings, highways);
    expect(result.rings.length).toBeGreaterThanOrEqual(1);
    expect(result.rings[0].id.startsWith("KDAY_D_")).toBe(true);
  });

  it("excludes rings outside the radius", () => {
    const result = filterMapContext(45.0, -93.0, 5, towered, rings, highways);
    expect(result.rings).toHaveLength(0);
  });

  it("includes nearby interstate polylines", () => {
    const result = filterMapContext(39.9, -84.2, 20, towered, rings, highways);
    expect(result.highways).toHaveLength(1);
    expect(result.highways[0].route).toBe("I-75");
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
