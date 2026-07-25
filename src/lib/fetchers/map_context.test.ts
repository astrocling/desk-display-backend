import { describe, expect, it } from "vitest";

import {
  buildAirspaceRingsFromGeoJson,
  buildToweredAirportsFromCsv,
  filterMapContext,
  type AirspaceRing,
  type ToweredAirport,
} from "./map_context";

const AIRPORTS_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
3622,"KDAY","large_airport","James M Cox Dayton Intl",39.902401,-84.219398,1009,"NA","US","US-OH","Dayton","yes","KDAY","DAY","KDAY","DAY",,,
9999,"00AA","small_airport","Aero B Ranch Airport",38.704022,-101.473911,3435,"NA","US","US-KS","Leoti","no",,,"00AA","00AA",,,
`;

const FREQUENCIES_CSV = `"id","airport_ref","type","description","frequency_mhz"
1,"3622","TWR","Tower",119.4
2,"9999","GND","Ground",121.9
`;

describe("buildToweredAirportsFromCsv", () => {
  it("emits only airports with a TWR frequency", () => {
    const airports = buildToweredAirportsFromCsv(AIRPORTS_CSV, FREQUENCIES_CSV);

    expect(airports).toEqual([
      {
        icao: "KDAY",
        name: "James M Cox Dayton Intl",
        lat: 39.902401,
        lon: -84.219398,
      },
    ]);
  });
});

describe("filterMapContext", () => {
  const towered: ToweredAirport[] = [
    {
      icao: "KDAY",
      name: "James M Cox Dayton Intl",
      lat: 39.902401,
      lon: -84.219398,
    },
    {
      icao: "KJFK",
      name: "John F Kennedy Intl",
      lat: 40.639447,
      lon: -73.779317,
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

  it("returns airports inside the radius sorted by distance", () => {
    const result = filterMapContext(39.9, -84.22, 30, towered, rings);

    expect(result.airports).toHaveLength(1);
    expect(result.airports[0].icao).toBe("KDAY");
  });

  it("includes rings that intersect the radius", () => {
    const result = filterMapContext(39.9, -84.22, 30, towered, rings);

    expect(result.rings).toHaveLength(1);
    expect(result.rings[0].id).toBe("KDAY_D");
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
