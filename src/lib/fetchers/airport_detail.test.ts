import { describe, expect, it } from "vitest";

import {
  assembleAirportDetail,
  attachPrimaryRunwayHeadings,
  buildAirportIdentityFromCsv,
  buildFrequenciesFromCsv,
  buildRunwaysFromCsv,
  filterOperationalFrequencies,
  hPaToInHg,
  parseTafRow,
  primaryRunwayHeading,
} from "./airport_detail";
import { parseTfrGeoJson } from "./tfrs";

describe("buildRunwaysFromCsv", () => {
  it("parses runway endpoints and sorts longest first", () => {
    const csv = `"id","airport_ref","airport_ident","length_ft","width_ft","surface","lighted","closed","le_ident","le_latitude_deg","le_longitude_deg","le_elevation_ft","le_heading_degT","le_displaced_threshold_ft","he_ident","he_latitude_deg","he_longitude_deg","he_elevation_ft","he_heading_degT","he_displaced_threshold_ft"
1,"1","KDAY","10901","150","ASP","1","0","06L","39.895","-84.246","1009","55.3","","24R","39.912","-84.214","1009","235.3",""
2,"1","KDAY","7285","150","ASP","1","0","06R","39.891","-84.222","1009","55.4","","24L","39.902","-84.202","1009","235.4",""
`;
    const byIcao = buildRunwaysFromCsv(csv);
    expect(byIcao.KDAY).toHaveLength(2);
    expect(byIcao.KDAY[0].leIdent).toBe("06L");
    expect(byIcao.KDAY[0].lengthFt).toBe(10901);
    expect(primaryRunwayHeading(byIcao.KDAY)).toBe(55.3);
  });

  it("attachPrimaryRunwayHeadings sets longest-runway heading", () => {
    const csv = `"id","airport_ref","airport_ident","length_ft","width_ft","surface","lighted","closed","le_ident","le_latitude_deg","le_longitude_deg","le_elevation_ft","le_heading_degT","le_displaced_threshold_ft","he_ident","he_latitude_deg","he_longitude_deg","he_elevation_ft","he_heading_degT","he_displaced_threshold_ft"
1,"1","KDAY","10901","150","ASP","1","0","06L","39.895","-84.246","1009","55.3","","24R","39.912","-84.214","1009","235.3",""
`;
    const byIcao = buildRunwaysFromCsv(csv);
    const airports = attachPrimaryRunwayHeadings(
      [
        {
          icao: "KDAY",
          name: "Dayton",
          lat: 39.9,
          lon: -84.2,
          primaryRunwayHeadingDeg: null,
        },
      ],
      byIcao,
    );
    expect(airports[0].primaryRunwayHeadingDeg).toBe(55.3);
  });
});

const AIRPORTS_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
3622,"KDAY","large_airport","James M Cox Dayton International Airport",39.9024,-84.2194,1009,"NA","US","US-OH","Dayton","yes","KDAY","DAY","KDAY","DAY",,,
`;

const FREQ_CSV = `"id","airport_ref","type","description","frequency_mhz"
1,3622,"ATIS","ATIS",134.875
2,3622,"TWR","Tower",119.9
3,3622,"GND","Ground",121.9
4,3622,"APP","Approach",126.375
5,3622,"VOR","VORTAC",117.0
`;

describe("buildAirportIdentityFromCsv", () => {
  it("maps ICAO to iata, municipality, elev", () => {
    const map = buildAirportIdentityFromCsv(AIRPORTS_CSV);
    expect(map.KDAY).toEqual({
      icao: "KDAY",
      iata: "DAY",
      name: "James M Cox Dayton International Airport",
      municipality: "Dayton",
      elevFt: 1009,
      lat: 39.9024,
      lon: -84.2194,
    });
  });
});

describe("buildFrequenciesFromCsv", () => {
  it("keeps operational freqs and drops VOR", () => {
    const byIcao = buildFrequenciesFromCsv(AIRPORTS_CSV, FREQ_CSV);
    const filtered = filterOperationalFrequencies(byIcao.KDAY ?? []);
    expect(filtered.map((f) => f.type)).toEqual(["ATIS", "TWR", "GND", "APP"]);
    expect(filtered.find((f) => f.type === "ATIS")?.mhz).toBe(134.875);
  });
});

describe("buildRunwaysFromCsv lighted", () => {
  it("parses lighted flag", () => {
    const csv = `"id","airport_ref","airport_ident","length_ft","width_ft","surface","lighted","closed","le_ident","le_latitude_deg","le_longitude_deg","le_elevation_ft","le_heading_degT","le_displaced_threshold_ft","he_ident","he_latitude_deg","he_longitude_deg","he_elevation_ft","he_heading_degT","he_displaced_threshold_ft"
1,"1","KDAY","10901","150","ASP","1","0","06L","39.895","-84.246","1009","55.3","","24R","39.912","-84.214","1009","235.3",""
`;
    const byIcao = buildRunwaysFromCsv(csv);
    expect(byIcao.KDAY[0].lighted).toBe(true);
  });
});

describe("metar altimeter conversion", () => {
  it("converts hPa to inHg", () => {
    expect(hPaToInHg(1011.3)).toBeCloseTo(29.86, 2);
  });
});

describe("parseTafRow", () => {
  it("maps raw and validity window", () => {
    const summary = parseTafRow({
      rawTAF: "TAF KDAY ...",
      validTimeFrom: 1785175200,
      validTimeTo: 1785261600,
    });
    expect(summary?.raw).toContain("TAF KDAY");
    expect(summary?.validFrom).toBe(new Date(1785175200 * 1000).toISOString());
    expect(summary?.validTo).toBe(new Date(1785261600 * 1000).toISOString());
  });

  it("returns null for empty", () => {
    expect(parseTafRow(null)).toBeNull();
  });
});

describe("getAirportDetail assembly", () => {
  it("merges identity, freqs, metar, taf without inventing", async () => {
    // Prefer unit-testing a pure assembleAirportDetail(...) helper
    // that takes already-loaded pieces, so no network in tests.
    const detail = assembleAirportDetail({
      icao: "KDAY",
      identity: {
        icao: "KDAY",
        iata: "DAY",
        name: "James M Cox Dayton International Airport",
        municipality: "Dayton",
        elevFt: 1009,
        lat: 39.9,
        lon: -84.2,
      },
      runways: [],
      frequencies: [{ type: "ATIS", description: "ATIS", mhz: 134.875 }],
      metar: null,
      taf: null,
    });
    expect(detail.iata).toBe("DAY");
    expect(detail.municipality).toBe("Dayton");
    expect(detail.elevFt).toBe(1009);
    expect(detail.frequencies).toHaveLength(1);
    expect(detail.taf).toBeNull();
  });

  it("omits unknown iata/municipality instead of inventing them", () => {
    const detail = assembleAirportDetail({
      icao: "KXYZ",
      identity: null,
      runways: [],
      frequencies: [],
      metar: null,
      taf: null,
      fallback: { name: "Fallback Field", lat: 1, lon: 2, elevFt: null },
    });
    expect(detail.iata).toBeNull();
    expect(detail.municipality).toBeNull();
    expect(detail.name).toBe("Fallback Field");
    expect(detail.lat).toBe(1);
    expect(detail.lon).toBe(2);
  });
});

describe("parseTfrGeoJson", () => {
  it("converts polygon features to lat/lon rings", () => {
    const tfrs = parseTfrGeoJson({
      type: "FeatureCollection",
      features: [
        {
          properties: { NOTAM_ID: "TFR1", NAME: "Stadium", TYPE: "SPORT" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-84.2, 39.9],
                [-84.1, 39.9],
                [-84.1, 40.0],
                [-84.2, 40.0],
                [-84.2, 39.9],
              ],
            ],
          },
        },
      ],
    });
    expect(tfrs).toHaveLength(1);
    expect(tfrs[0].id).toBe("TFR1");
    expect(tfrs[0].points[0]).toEqual([39.9, -84.2]);
  });
});
