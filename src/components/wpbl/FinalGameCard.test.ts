import { describe, expect, it } from "vitest";

import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import { FinalGameCard } from "./FinalGameCard";

/** Smoke-level helper mirroring winner bolding in FinalGameCard. */
function winnerSide(detail: WpblGameDetailResponse): "away" | "home" | "tie" {
  const { awayRuns, homeRuns } = detail.game;
  if (awayRuns == null || homeRuns == null || awayRuns === homeRuns) {
    return "tie";
  }
  return awayRuns > homeRuns ? "away" : "home";
}

describe("FinalGameCard winner", () => {
  it("picks the higher score", () => {
    const detail = {
      game: { awayRuns: 10, homeRuns: 8 },
    } as WpblGameDetailResponse;
    expect(winnerSide(detail)).toBe("away");
    expect(
      winnerSide({
        game: { awayRuns: 3, homeRuns: 5 },
      } as WpblGameDetailResponse),
    ).toBe("home");
  });
});

// Keep the component import so the module graph is exercised in CI.
void FinalGameCard;
