import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWeather } from "@/lib/fetchers/weather";

describe("fetchWeather", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T12:00:00"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("parses Open-Meteo response into weather fields", async () => {
    const mockPayload = {
      current: {
        temperature_2m: 72.5,
        apparent_temperature: 70.0,
        weather_code: 1,
      },
      daily: {
        time: ["2026-07-23"],
        temperature_2m_max: [85.2],
        temperature_2m_min: [62.1],
      },
      hourly: {
        time: ["2026-07-23T13:00", "2026-07-23T14:00"],
        temperature_2m: [74, 76],
        weather_code: [2, 3],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPayload,
      }),
    );

    const result = await fetchWeather(40.7128, -74.006);

    expect(result.current).toEqual({ temp: 72.5, feelsLike: 70, code: 1 });
    expect(result.todayHigh).toBe(85.2);
    expect(result.todayLow).toBe(62.1);
    expect(result.hourly).toEqual([
      { time: "2026-07-23T13:00", temp: 74, code: 2 },
      { time: "2026-07-23T14:00", temp: 76, code: 3 },
    ]);
    expect(result.updatedAt).toBeDefined();
  });
});
