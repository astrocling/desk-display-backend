import { describe, expect, it } from "vitest";

import { buildAirportMap } from "./airports";

const FIXTURE_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
3622,"KJFK","large_airport","John F. Kennedy International Airport",40.639447,-73.779317,13,"NA","US","US-NY","New York","yes","KJFK","JFK","KJFK","JFK",,,
9999,"00AA","small_airport","Aero B Ranch Airport",38.704022,-101.473911,3435,"NA","US","US-KS","Leoti","no",,,"00AA","00AA",,,
100,"BAD","small_airport","No Coords",,,"NA","US","US-KS","Leoti","no","KBAD",,,"BAD",,,
200,"EGLL","large_airport","London Heathrow Airport",51.4706,-0.461941,83,"EU","GB","GB-ENG","London","yes","EGLL","LHR","EGLL","LHR",,,
300,"small-id","small_airport","Uses icao_code column",42.3656,-71.0096,19,"NA","US","US-MA","Boston","no","KBOS","BOS","KBOS","BOS",,,
400,"KORD","large_airport","Chicago O'Hare",41.9786,-87.9048,672,"NA","US","US-IL","Chicago","yes","KORD","ORD","KORD","ORD",,,
`;

describe("buildAirportMap", () => {
  it("maps ICAO codes to lat/lon, preferring ident when it looks like ICAO", () => {
    const map = buildAirportMap(FIXTURE_CSV);

    expect(map.KJFK).toEqual({ lat: 40.639447, lon: -73.779317 });
    expect(map.EGLL).toEqual({ lat: 51.4706, lon: -0.461941 });
    expect(map.KORD).toEqual({ lat: 41.9786, lon: -87.9048 });
  });

  it("falls back to icao_code when ident is not ICAO-shaped", () => {
    const map = buildAirportMap(FIXTURE_CSV);

    expect(map.KBOS).toEqual({ lat: 42.3656, lon: -71.0096 });
  });

  it("skips rows without valid coordinates or ICAO", () => {
    const map = buildAirportMap(FIXTURE_CSV);

    expect(map["00AA"]).toBeUndefined();
    expect(map.BAD).toBeUndefined();
    expect(map.KBAD).toBeUndefined();
    expect(Object.keys(map)).toHaveLength(4);
  });
});
