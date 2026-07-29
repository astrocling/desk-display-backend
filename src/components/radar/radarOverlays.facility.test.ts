import { describe, expect, it } from "vitest";

import { shouldShowFacilityLabel } from "./radarOverlays";

describe("shouldShowFacilityLabel", () => {
  it("shows ARTCC labels at zoom 6 and above", () => {
    expect(shouldShowFacilityLabel(5.9, "artcc")).toBe(false);
    expect(shouldShowFacilityLabel(6, "artcc")).toBe(true);
    expect(shouldShowFacilityLabel(10, "artcc")).toBe(true);
  });

  it("shows APP/DEP labels at zoom 8 and above", () => {
    expect(shouldShowFacilityLabel(7.9, "app_dep")).toBe(false);
    expect(shouldShowFacilityLabel(8, "app_dep")).toBe(true);
    expect(shouldShowFacilityLabel(12, "app_dep")).toBe(true);
  });

  it("uses separate thresholds per kind", () => {
    expect(shouldShowFacilityLabel(7, "artcc")).toBe(true);
    expect(shouldShowFacilityLabel(7, "app_dep")).toBe(false);
  });
});
