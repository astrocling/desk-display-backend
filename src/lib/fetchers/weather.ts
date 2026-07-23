import type { WeatherBlob } from "@/lib/types/weather";

interface OpenMeteoCurrent {
  temperature_2m: number;
  apparent_temperature: number;
  weather_code: number;
}

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
  daily: OpenMeteoDaily;
  hourly: OpenMeteoHourly;
}

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const HOURLY_HOURS = 48;

export async function fetchWeather(
  lat: number,
  lon: number,
): Promise<Omit<WeatherBlob, "alert">> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "temperature_2m_max,temperature_2m_min",
    hourly: "temperature_2m,weather_code",
    temperature_unit: "fahrenheit",
    timezone: "auto",
    forecast_days: "2",
  });

  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;

  const { current, daily, hourly } = data;

  if (
    !current ||
    !daily?.time?.length ||
    daily.temperature_2m_max?.[0] == null ||
    daily.temperature_2m_min?.[0] == null ||
    !hourly?.time?.length
  ) {
    throw new Error("Open-Meteo response missing required fields");
  }

  const now = Date.now();
  const hourlyForecast: WeatherBlob["hourly"] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const time = hourly.time[i];
    const temp = hourly.temperature_2m[i];
    const code = hourly.weather_code[i];

    if (temp == null || code == null) {
      continue;
    }

    const hourMs = new Date(time).getTime();
    if (hourMs < now) {
      continue;
    }

    hourlyForecast.push({ time, temp, code });

    if (hourlyForecast.length >= HOURLY_HOURS) {
      break;
    }
  }

  return {
    current: {
      temp: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      code: current.weather_code,
    },
    todayHigh: daily.temperature_2m_max[0],
    todayLow: daily.temperature_2m_min[0],
    hourly: hourlyForecast,
    updatedAt: new Date().toISOString(),
  };
}
