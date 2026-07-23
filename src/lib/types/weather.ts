export interface WeatherBlob {
  current: { temp: number; feelsLike: number; code: number };
  todayHigh: number;
  todayLow: number;
  hourly: { time: string; temp: number; code: number }[];
  alert: { severity: string; headline: string } | null;
  updatedAt: string;
}
