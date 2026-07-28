import { describe, expect, it } from "vitest";

import {
  ATC_FEEDS,
  catalogIcaos,
  defaultFeedForIcao,
  feedsForIcao,
  getFeedById,
  isCatalogIcao,
  liveAtcListenUrl,
  liveAtcPlsUrl,
  liveAtcStreamUrl,
  liveAtcStreamUrls,
} from "./feeds";

describe("atc feeds catalog", () => {
  it("includes KIND KDAY KCMH KCVG and not KFFO", () => {
    const icaos = catalogIcaos();
    expect(icaos).toEqual(["KCMH", "KCVG", "KDAY", "KIND"]);
    expect(icaos).not.toContain("KFFO");
    expect(isCatalogIcao("KFFO")).toBe(false);
    expect(isCatalogIcao("kday")).toBe(true);
  });

  it("lists feeds for an ICAO case-insensitively", () => {
    const day = feedsForIcao("kday");
    expect(day).toHaveLength(1);
    expect(day[0]?.id).toBe("kday");
    expect(day[0]?.role).toBe("combined");

    expect(feedsForIcao("KIND").map((f) => f.id)).toEqual([
      "kind9_twr",
      "kind9_app_dep",
    ]);

    expect(feedsForIcao("KCMH").map((f) => f.id)).toEqual([
      "kcmh1_twr",
      "kcmh1_twr_app",
    ]);
  });

  it("defaults to combined for KDAY and tower otherwise", () => {
    expect(defaultFeedForIcao("KDAY")?.id).toBe("kday");
    expect(defaultFeedForIcao("KIND")?.id).toBe("kind9_twr");
    expect(defaultFeedForIcao("KCMH")?.id).toBe("kcmh1_twr");
    expect(defaultFeedForIcao("KCVG")?.id).toBe("kcvg1_twr");
    expect(defaultFeedForIcao("KFFO")).toBeUndefined();
  });

  it("looks up feed by id and builds LiveATC URLs", () => {
    expect(getFeedById("kcvg1_twr")?.icao).toBe("KCVG");
    expect(getFeedById("kind9_app_dep")?.role).toBe("app");
    expect(getFeedById("missing")).toBeUndefined();
    expect(liveAtcListenUrl("kday")).toBe(
      "https://www.liveatc.net/hlisten.php?mount=kday",
    );
    expect(liveAtcPlsUrl("kday")).toBe(
      "https://www.liveatc.net/play/kday.pls",
    );
    expect(liveAtcStreamUrl("kday")).toBe(
      "https://s1-fmt2.liveatc.net/kday",
    );
    expect(liveAtcStreamUrls("kday")).toEqual([
      "https://s1-fmt2.liveatc.net/kday",
      "https://s1-bos.liveatc.net/kday",
    ]);
  });

  it("only covers POC airports", () => {
    const icaos = new Set(ATC_FEEDS.map((f) => f.icao));
    expect([...icaos].sort()).toEqual(["KCMH", "KCVG", "KDAY", "KIND"]);
  });
});
