import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TIMEZONE_CITIES } from "@/lib/config";
import { fetchAllSunrise } from "@/lib/fetchers/sunrise";

function mockSunriseResponse(sunrise: string, sunset: string, status = "OK") {
  return {
    ok: true,
    json: async () => ({
      status,
      results: { sunrise, sunset },
    }),
  };
}

describe("fetchAllSunrise", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses sunrise and sunset for all cities", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () =>
      mockSunriseResponse(
        `2026-07-23T10:00:00+00:00`,
        `2026-07-23T22:00:00+00:00`,
      ) as Response,
    );

    const { cities, failures } = await fetchAllSunrise();

    expect(failures).toEqual([]);
    expect(Object.keys(cities)).toHaveLength(TIMEZONE_CITIES.length);

    for (const city of TIMEZONE_CITIES) {
      expect(cities[city.id]).toEqual({
        sunrise: "2026-07-23T10:00:00+00:00",
        sunset: "2026-07-23T22:00:00+00:00",
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(TIMEZONE_CITIES.length);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("formatted=0");
  });

  it("returns successful cities and records failures when one city fails", async () => {
    const fetchMock = vi.mocked(fetch);
    const failingCity = TIMEZONE_CITIES[0];

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes(`lat=${failingCity.lat}`)) {
        return {
          ok: false,
          status: 500,
        } as Response;
      }

      return mockSunriseResponse(
        "2026-07-23T11:30:00+00:00",
        "2026-07-23T23:30:00+00:00",
      ) as Response;
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { cities, failures } = await fetchAllSunrise();

    expect(failures).toEqual([failingCity.id]);
    expect(Object.keys(cities)).toHaveLength(TIMEZONE_CITIES.length - 1);
    expect(cities[failingCity.id]).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("treats invalid API payloads as failures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "INVALID_REQUEST" }),
    } as Response);

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { cities, failures } = await fetchAllSunrise();

    expect(cities).toEqual({});
    expect(failures).toHaveLength(TIMEZONE_CITIES.length);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
