import { describe, expect, it } from "vitest";
import { decideCommsTune } from "./commsTune";
import { defaultFeedForIcao } from "@/lib/atc/feeds";

describe("decideCommsTune", () => {
  it("stops when retapping the live airport", () => {
    expect(
      decideCommsTune({
        targetIcao: "KIND",
        activeIcao: "KIND",
        status: "playing",
        lastFeedByIcao: {},
      }),
    ).toEqual({ type: "stop" });
  });

  it("plays remembered feed when switching airports", () => {
    expect(
      decideCommsTune({
        targetIcao: "KIND",
        activeIcao: "KDAY",
        status: "playing",
        lastFeedByIcao: { KIND: "kind9_app_dep" },
      }),
    ).toEqual({
      type: "play",
      icao: "KIND",
      feedId: "kind9_app_dep",
    });
  });

  it("plays default when idle with no memory", () => {
    expect(
      decideCommsTune({
        targetIcao: "kday",
        activeIcao: null,
        status: "idle",
        lastFeedByIcao: {},
      }),
    ).toEqual({
      type: "play",
      icao: "KDAY",
      feedId: defaultFeedForIcao("KDAY")!.id,
    });
  });

  it("returns null for non-catalog", () => {
    expect(
      decideCommsTune({
        targetIcao: "KFFO",
        activeIcao: null,
        status: "idle",
        lastFeedByIcao: {},
      }),
    ).toBeNull();
  });
});
