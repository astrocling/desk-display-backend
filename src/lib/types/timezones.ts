export interface CitySunriseSunset {
  sunrise: string;
  sunset: string;
}

export interface TimezonesBlob {
  updatedAt: string;
  cities: Record<string, CitySunriseSunset>;
}
