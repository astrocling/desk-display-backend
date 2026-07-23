import { describe, expect, it, vi } from "vitest";

import { fetchNwsAlerts, pickHighestSeverityAlert } from "@/lib/fetchers/nws";

describe("pickHighestSeverityAlert", () => {
  it("picks the highest severity alert among features", () => {
    const result = pickHighestSeverityAlert([
      {
        properties: {
          severity: "Minor",
          headline: "Small craft advisory",
        },
      },
      {
        properties: {
          severity: "Severe",
          headline: "Severe thunderstorm warning",
        },
      },
      {
        properties: {
          severity: "Moderate",
          headline: "Heat advisory",
        },
      },
    ]);

    expect(result).toEqual({
      severity: "Severe",
      headline: "Severe thunderstorm warning",
    });
  });

  it("returns null when no valid features exist", () => {
    expect(pickHighestSeverityAlert([])).toBeNull();
    expect(
      pickHighestSeverityAlert([{ properties: { severity: "Minor" } }]),
    ).toBeNull();
  });
});

describe("fetchNwsAlerts", () => {
  it("returns null when no active alerts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      }),
    );

    const result = await fetchNwsAlerts(40.7128, -74.006);
    expect(result).toBeNull();
  });
});
