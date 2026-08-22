import { describe, expect, it } from "vitest";

import { wpblLiveWsUrl } from "@/lib/wpbl-live-ws";

describe("wpblLiveWsUrl", () => {
  it("builds the official public channel URL", () => {
    expect(wpblLiveWsUrl("abc123")).toBe(
      "wss://stats.womensprobaseballleague.com/v1/ws?channels=game%3Aabc123%2Cboxscore%3Aabc123",
    );
  });
});
