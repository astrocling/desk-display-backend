import { describe, expect, it } from "vitest";

import { buildRunwaysFromCsv, primaryRunwayHeading } from "./airport_detail";
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
