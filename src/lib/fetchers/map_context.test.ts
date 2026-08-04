import { readFile } from "node:fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  buildAirportCatalogFromCsv,
  buildAirspaceRingsFromGeoJson,
  buildDesignatorIndex,
  buildFacilityBoundariesFromGeoJson,
  buildHighwaysFromGeoJson,
  buildToweredAirportsFromCsv,
  clearMapContextCacheForTests,
  filterMapContext,
  loadMapContextData,
  type AirspaceRing,
  type FacilityBoundary,
  type HighwayPolyline,
  type MapAirport,
} from "./map_context";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

const mockedReadFile = vi.mocked(readFile);

const AIRPORTS_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
3622,"KDAY","large_airport","James M Cox Dayton Intl",39.902401,-84.219398,1009,"NA","US","US-OH","Dayton","yes","KDAY","DAY","KDAY","DAY",,,
9999,"00AA","small_airport","Aero B Ranch Airport",38.704022,-101.473911,3435,"NA","US","US-KS","Leoti","no",,,"00AA","00AA",,,
`;

const FREQUENCIES_CSV = `"id","airport_ref","type","description","frequency_mhz"
1,"3622","TWR","Tower",119.4
2,"9999","GND","Ground",121.9
`;

const RUNWAYS_CSV = `"id","airport_ref","airport_ident","length_ft","width_ft","surface","closed"
1,"3622","KDAY",10000,150,"ASP",0
2,"9999","00AA",4500,60,"CON",0
`;

const HIGHWAYS_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ROUTE_NUM: "I75" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-84.19, 40.05],
          [-84.2, 39.95],
          [-84.21, 39.85],
        ],
      },
    },
  ],
};

const ARTCC_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "ZID", name: "Indianapolis" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-84.5, 40.1],
            [-84.0, 40.1],
            [-84.0, 39.7],
            [-84.5, 39.7],
            [-84.5, 40.1],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { id: "ZFW", name: "Fort Worth" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100.0, 35.0],
            [-99.0, 35.0],
            [-99.0, 34.0],
            [-100.0, 34.0],
            [-100.0, 35.0],
          ],
        ],
      },
    },
  ],
};

const APP_DEP_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ID: "DAY", NAME: "Dayton Approach" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-84.35, 40.0],
            [-84.1, 40.0],
            [-84.1, 39.8],
            [-84.35, 39.8],
            [-84.35, 40.0],
          ],
        ],
      },
    },
  ],
};

describe("buildAirportCatalogFromCsv", () => {
  it("builds one towered and one public non-towered airport with paved length", () => {
    const airports = buildAirportCatalogFromCsv(
      AIRPORTS_CSV,
      FREQUENCIES_CSV,
      RUNWAYS_CSV,
    );

    expect(airports).toHaveLength(2);

    const dayton = airports.find((a) => a.ident === "KDAY");
    expect(dayton).toEqual({
      icao: "KDAY",
      ident: "KDAY",
      name: "James M Cox Dayton Intl",
      lat: 39.902401,
      lon: -84.219398,
      towered: true,
      publicUse: true,
      pavedRunwayFt: 10000,
    });

    const ranch = airports.find((a) => a.ident === "00AA");
    expect(ranch).toEqual({
      icao: "00AA",
      ident: "00AA",
      name: "Aero B Ranch Airport",
      lat: 38.704022,
      lon: -101.473911,
      towered: false,
      publicUse: true,
      pavedRunwayFt: 4500,
    });
  });
});

describe("buildDesignatorIndex", () => {
  it("maps uppercase ident, icao, and local codes to primary ident", () => {
    const airports: MapAirport[] = [
      {
        icao: "KDAY",
        ident: "KDAY",
        name: "Dayton",
        lat: 39.9,
        lon: -84.2,
        towered: true,
        publicUse: true,
        pavedRunwayFt: 10000,
      },
    ];

    const index = buildDesignatorIndex(airports, { KDAY: "DAY" });
    expect(index.KDAY).toBe("KDAY");
    expect(index.DAY).toBe("KDAY");
  });
});

describe("buildFacilityBoundariesFromGeoJson", () => {
  it("parses polygon features with id/name properties", () => {
    const artcc = buildFacilityBoundariesFromGeoJson(ARTCC_GEOJSON, "artcc");
    expect(artcc).toHaveLength(2);
    expect(artcc[0]).toMatchObject({
      id: "ZID",
      name: "Indianapolis",
      kind: "artcc",
    });
    expect(artcc[0].points.length).toBeGreaterThan(2);
    expect(artcc[0].points.length).toBeLessThanOrEqual(60);

    const appDep = buildFacilityBoundariesFromGeoJson(APP_DEP_GEOJSON, "app_dep");
    expect(appDep).toHaveLength(1);
    expect(appDep[0]).toMatchObject({
      id: "DAY",
      name: "Dayton Approach",
      kind: "app_dep",
    });
  });
});

describe("buildToweredAirportsFromCsv", () => {
  it("emits only airports with a TWR frequency", () => {
    const airports = buildToweredAirportsFromCsv(AIRPORTS_CSV, FREQUENCIES_CSV);

    expect(airports).toEqual([
      {
        icao: "KDAY",
        ident: "KDAY",
        name: "James M Cox Dayton Intl",
        lat: 39.902401,
        lon: -84.219398,
        towered: true,
        publicUse: true,
        pavedRunwayFt: null,
      },
    ]);
  });
});

describe("buildHighwaysFromGeoJson", () => {
  it("normalizes interstate routes to I-N with lat/lon points", () => {
    const highways = buildHighwaysFromGeoJson(HIGHWAYS_GEOJSON);
    expect(highways).toHaveLength(1);
    expect(highways[0].route).toBe("I-75");
    expect(highways[0].id).toBe("I-75");
    expect(highways[0].points[0]).toEqual([40.05, -84.19]);
  });
});

describe("filterMapContext", () => {
  const airports: MapAirport[] = [
    {
      icao: "KDAY",
      ident: "KDAY",
      name: "James M Cox Dayton Intl",
      lat: 39.902401,
      lon: -84.219398,
      towered: true,
      publicUse: true,
      pavedRunwayFt: 10000,
    },
    {
      icao: "KJFK",
      ident: "KJFK",
      name: "John F Kennedy Intl",
      lat: 40.639447,
      lon: -73.779317,
      towered: true,
      publicUse: true,
      pavedRunwayFt: 12000,
    },
  ];

  const rings: AirspaceRing[] = [
    {
      class: "D",
      id: "KDAY_D",
      points: [
        [39.92, -84.25],
        [39.93, -84.2],
        [39.88, -84.18],
        [39.87, -84.24],
      ],
    },
    {
      class: "B",
      id: "FAR_B",
      points: [
        [46.92, -96.82],
        [46.95, -96.7],
        [46.85, -96.68],
        [46.82, -96.8],
      ],
    },
  ];

  const highways: HighwayPolyline[] = buildHighwaysFromGeoJson(HIGHWAYS_GEOJSON);

  const artcc: FacilityBoundary[] = buildFacilityBoundariesFromGeoJson(
    ARTCC_GEOJSON,
    "artcc",
  );
  const appDep: FacilityBoundary[] = buildFacilityBoundariesFromGeoJson(
    APP_DEP_GEOJSON,
    "app_dep",
  );

  it("returns airports inside the radius sorted by distance", () => {
    const result = filterMapContext(
      39.9,
      -84.22,
      30,
      airports,
      rings,
      highways,
      artcc,
      appDep,
    );

    expect(result.airports).toHaveLength(1);
    expect(result.airports[0].icao).toBe("KDAY");
  });

  it("toweredOnly drops non-towered airports but keeps rings", () => {
    const mixed: MapAirport[] = [
      ...airports,
      {
        icao: "1WF",
        ident: "1WF",
        name: "Helipad",
        lat: 39.91,
        lon: -84.21,
        towered: false,
        publicUse: true,
        pavedRunwayFt: null,
        primaryRunwayHeadingDeg: null,
      },
    ];
    const all = filterMapContext(39.9, -84.22, 30, mixed, rings, highways);
    const towered = filterMapContext(39.9, -84.22, 30, mixed, rings, highways, [], [], {
      toweredOnly: true,
    });
    expect(all.airports.length).toBeGreaterThan(towered.airports.length);
    expect(towered.airports.every((a) => a.towered)).toBe(true);
    expect(towered.rings).toHaveLength(1);
  });

  it("includes rings that intersect the radius", () => {
    const result = filterMapContext(
      39.9,
      -84.22,
      30,
      airports,
      rings,
      highways,
      artcc,
      appDep,
    );

    expect(result.rings).toHaveLength(1);
    expect(result.rings[0].id).toBe("KDAY_D");
  });

  it("includes artcc and appDep boundaries intersecting the radius", () => {
    const result = filterMapContext(
      39.9,
      -84.22,
      30,
      airports,
      rings,
      highways,
      artcc,
      appDep,
    );

    expect(result.artcc).toHaveLength(1);
    expect(result.artcc[0].id).toBe("ZID");
    expect(result.appDep).toHaveLength(1);
    expect(result.appDep[0].id).toBe("DAY");
  });

  it("includes nearby interstate highways", () => {
    const result = filterMapContext(39.9, -84.2, 20, airports, rings, highways);
    expect(result.highways).toHaveLength(1);
    expect(result.highways[0].route).toBe("I-75");
  });

  it("omits far highways", () => {
    const result = filterMapContext(45.0, -93.0, 5, airports, rings, highways);
    expect(result.highways).toHaveLength(0);
  });
});

describe("buildAirspaceRingsFromGeoJson", () => {
  it("keeps only Class B/C/D exterior rings", () => {
    const rings = buildAirspaceRingsFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { class: "D", id: "KDAY_D" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-84.25, 39.92],
                [-84.2, 39.93],
                [-84.18, 39.88],
                [-84.24, 39.87],
                [-84.25, 39.92],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { class: "E", id: "SKIP_E" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-84.0, 39.0],
                [-83.9, 39.1],
                [-83.8, 39.0],
                [-84.0, 39.0],
              ],
            ],
          },
        },
      ],
    });

    expect(rings).toHaveLength(1);
    expect(rings[0].class).toBe("D");
    expect(rings[0].id).toBe("KDAY_D");
    expect(rings[0].points.length).toBeLessThanOrEqual(60);
  });
});

describe("loadMapContextData", () => {
  beforeEach(() => {
    clearMapContextCacheForTests();
    mockedReadFile.mockReset();
  });

  it("loads missing optional facility blobs as empty arrays", async () => {
    mockedReadFile.mockImplementation(async (filePath) => {
      const p = String(filePath);
      if (p.endsWith("towered-airports.json")) {
        return JSON.stringify([
          {
            icao: "KDAY",
            name: "Dayton",
            lat: 39.9,
            lon: -84.2,
          },
        ]);
      }
      if (p.endsWith("airspace-rings.json")) {
        return JSON.stringify([]);
      }
      if (p.endsWith("highways.json")) {
        return JSON.stringify([]);
      }
      if (p.endsWith("airports-catalog.json")) {
        throw new Error("ENOENT");
      }
      if (p.endsWith("airport-designators.json")) {
        throw new Error("ENOENT");
      }
      if (p.endsWith("artcc-boundaries.json")) {
        throw new Error("ENOENT");
      }
      if (p.endsWith("app-dep-boundaries.json")) {
        throw new Error("ENOENT");
      }
      throw new Error(`unexpected path: ${p}`);
    });

    const data = await loadMapContextData();
    expect(data.artcc).toEqual([]);
    expect(data.appDep).toEqual([]);
    expect(data.designators).toEqual({});
    expect(data.towered).toHaveLength(1);
    expect(data.towered[0].ident).toBe("KDAY");
  });
});
