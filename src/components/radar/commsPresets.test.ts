import { describe, expect, it } from "vitest";
import {
  COMMS_PRESETS_STORAGE_KEY,
  mergeCommsEntries,
  normalizeCatalogIcao,
  parseCommsPresetsStored,
  serializeCommsPresetsStored,
} from "./commsPresets";

describe("normalizeCatalogIcao", () => {
  it("uppercases catalog ICAOs", () => {
    expect(normalizeCatalogIcao(" kind ")).toBe("KIND");
  });
  it("returns null for non-catalog", () => {
    expect(normalizeCatalogIcao("KFFO")).toBeNull();
  });
});

describe("mergeCommsEntries", () => {
  it("lists pinned before session-only and dedupes", () => {
    expect(
      mergeCommsEntries(["KCMH", "KIND"], ["KIND", "KDAY"]),
    ).toEqual([
      { icao: "KCMH", pinned: true, session: false },
      { icao: "KIND", pinned: true, session: true },
      { icao: "KDAY", pinned: false, session: true },
    ]);
  });
  it("drops non-catalog ids", () => {
    expect(mergeCommsEntries(["KFFO"], ["KZZZ"])).toEqual([]);
  });
});

describe("parseCommsPresetsStored", () => {
  it("defaults expanded false and empty pins", () => {
    expect(parseCommsPresetsStored(null)).toEqual({
      pinnedIcaos: [],
      expanded: false,
    });
  });
  it("parses valid JSON and filters pins", () => {
    expect(
      parseCommsPresetsStored(
        JSON.stringify({ pinnedIcaos: ["kind", "KFFO"], expanded: true }),
      ),
    ).toEqual({ pinnedIcaos: ["KIND"], expanded: true });
  });
  it("degrades on invalid JSON", () => {
    expect(parseCommsPresetsStored("{")).toEqual({
      pinnedIcaos: [],
      expanded: false,
    });
  });
});

describe("serializeCommsPresetsStored", () => {
  it("round-trips", () => {
    const data = { pinnedIcaos: ["KIND"], expanded: true };
    expect(parseCommsPresetsStored(serializeCommsPresetsStored(data))).toEqual(
      data,
    );
  });
});

describe("COMMS_PRESETS_STORAGE_KEY", () => {
  it("is namespaced v1", () => {
    expect(COMMS_PRESETS_STORAGE_KEY).toBe("desk-display.commsPresets.v1");
  });
});
