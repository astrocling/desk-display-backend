import { describe, expect, it } from "vitest";
import { getFeedById, defaultFeedForIcao } from "@/lib/atc/feeds";
import {
  COMMS_PRESETS_STORAGE_KEY,
  mergeCommsEntries,
  normalizeCatalogIcao,
  parseCommsPresetsStored,
  serializeCommsPresetsStored,
  resolvedFeedIdForIcao,
  sanitizeLastFeedByIcao,
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
      lastFeedByIcao: {},
    });
  });
  it("parses valid JSON and filters pins", () => {
    expect(
      parseCommsPresetsStored(
        JSON.stringify({ pinnedIcaos: ["kind", "KFFO"], expanded: true }),
      ),
    ).toEqual({ pinnedIcaos: ["KIND"], expanded: true, lastFeedByIcao: {} });
  });
  it("degrades on invalid JSON", () => {
    expect(parseCommsPresetsStored("{")).toEqual({
      pinnedIcaos: [],
      expanded: false,
      lastFeedByIcao: {},
    });
  });
});

describe("serializeCommsPresetsStored", () => {
  it("round-trips", () => {
    const data = {
      pinnedIcaos: ["KIND"],
      expanded: true,
      lastFeedByIcao: {},
    };
    expect(parseCommsPresetsStored(serializeCommsPresetsStored(data))).toEqual(
      data,
    );
  });
});

describe("lastFeedByIcao storage", () => {
  it("defaults to empty map", () => {
    expect(parseCommsPresetsStored(null)).toEqual({
      pinnedIcaos: [],
      expanded: false,
      lastFeedByIcao: {},
    });
  });

  it("round-trips lastFeedByIcao and drops invalid feeds", () => {
    const raw = JSON.stringify({
      pinnedIcaos: ["KIND"],
      expanded: true,
      lastFeedByIcao: {
        KIND: "kind9_app_dep",
        KDAY: "not-a-real-feed",
        KFFO: "kind9_twr",
      },
    });
    const parsed = parseCommsPresetsStored(raw);
    expect(parsed.lastFeedByIcao).toEqual({ KIND: "kind9_app_dep" });
    expect(
      parseCommsPresetsStored(serializeCommsPresetsStored(parsed)).lastFeedByIcao,
    ).toEqual({ KIND: "kind9_app_dep" });
  });
});

describe("resolvedFeedIdForIcao", () => {
  it("prefers remembered feed for that ICAO", () => {
    expect(
      resolvedFeedIdForIcao("KIND", { KIND: "kind9_app_dep" }),
    ).toBe("kind9_app_dep");
  });

  it("falls back to default when missing or mismatched", () => {
    expect(resolvedFeedIdForIcao("KIND", {})).toBe(
      defaultFeedForIcao("KIND")!.id,
    );
    expect(
      resolvedFeedIdForIcao("KIND", { KIND: "kday" }),
    ).toBe(defaultFeedForIcao("KIND")!.id);
  });
});

describe("sanitizeLastFeedByIcao", () => {
  it("keeps only catalog feed ids owned by the ICAO key", () => {
    expect(
      sanitizeLastFeedByIcao({
        kind: "kind9_app_dep",
        KDAY: "kind9_twr",
        junk: 1,
      }),
    ).toEqual({ KIND: "kind9_app_dep" });
  });
});

describe("COMMS_PRESETS_STORAGE_KEY", () => {
  it("is namespaced v1", () => {
    expect(COMMS_PRESETS_STORAGE_KEY).toBe("desk-display.commsPresets.v1");
  });
});
