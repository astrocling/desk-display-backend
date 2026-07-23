import { TIMEZONE_CITIES } from "@/lib/config";
import type { CitySunriseSunset } from "@/lib/types/timezones";

interface SunriseSunsetApiResponse {
  results?: {
    sunrise?: string;
    sunset?: string;
  };
  status?: string;
}

export interface FetchSunriseResult {
  cities: Record<string, CitySunriseSunset>;
  failures: string[];
}

const SUNRISE_API_URL = "https://api.sunrise-sunset.org/json";

async function fetchCitySunrise(
  lat: number,
  lon: number,
): Promise<CitySunriseSunset> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lon),
    formatted: "0",
  });

  const response = await fetch(`${SUNRISE_API_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Sunrise API request failed: ${response.status}`);
  }

  const data = (await response.json()) as SunriseSunsetApiResponse;

  if (data.status !== "OK" || !data.results?.sunrise || !data.results?.sunset) {
    throw new Error("Sunrise API response missing required fields");
  }

  return {
    sunrise: data.results.sunrise,
    sunset: data.results.sunset,
  };
}

export async function fetchAllSunrise(): Promise<FetchSunriseResult> {
  const cities: Record<string, CitySunriseSunset> = {};
  const failures: string[] = [];

  for (const city of TIMEZONE_CITIES) {
    try {
      cities[city.id] = await fetchCitySunrise(city.lat, city.lon);
    } catch (error) {
      console.error(`Failed to fetch sunrise for ${city.id}:`, error);
      failures.push(city.id);
    }
  }

  return { cities, failures };
}
