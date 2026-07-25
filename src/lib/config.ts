export const REDIS_KEYS = {
  weather: "weather",
  timezones: "timezones",
  scores: "scores",
  airports: "airports",
  mapTowered: "map:towered",
  mapAirspace: "map:airspace",
} as const;

export const TIMEZONE_CITIES = [
  { id: "America/New_York", lat: 40.7128, lon: -74.006 },
  { id: "America/Chicago", lat: 41.8781, lon: -87.6298 },
  { id: "America/Los_Angeles", lat: 36.1699, lon: -115.1398 },
  { id: "Etc/GMT", lat: 51.4769, lon: 0.0 },
  { id: "Europe/Rome", lat: 41.9028, lon: 12.4964 },
  { id: "Europe/Kyiv", lat: 50.4501, lon: 30.5234 },
  { id: "Europe/Chisinau", lat: 47.0105, lon: 28.8638 },
] as const;

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface AppConfig {
  homeLat: number;
  homeLon: number;
  mlbTeam: string;
  homeZip?: string;
  flagstandLeagueIds?: string[];
  cronSecret: string;
}

export function getConfig(): AppConfig {
  const homeLat = Number(getRequiredEnv("HOME_LAT"));
  const homeLon = Number(getRequiredEnv("HOME_LON"));

  if (Number.isNaN(homeLat) || Number.isNaN(homeLon)) {
    throw new Error("HOME_LAT and HOME_LON must be valid numbers");
  }

  const flagstandLeagueIds = process.env.FLAGSTAND_LEAGUE_IDS
    ? process.env.FLAGSTAND_LEAGUE_IDS.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  return {
    homeLat,
    homeLon,
    mlbTeam: getRequiredEnv("MLB_TEAM").toUpperCase(),
    homeZip: process.env.HOME_ZIP || undefined,
    flagstandLeagueIds,
    cronSecret: getRequiredEnv("CRON_SECRET"),
  };
}
