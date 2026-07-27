export interface ToweredAirport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  /** Longest runway true heading (degrees) for glyph orientation. */
  primaryRunwayHeadingDeg?: number | null;
}

export interface AirspaceRing {
  class: "B" | "C" | "D";
  id: string;
  points: [number, number][];
}

export interface HighwayPolyline {
  id: string;
  route: string;
  points: [number, number][];
}

export interface MapContextResponse {
  airports: ToweredAirport[];
  rings: AirspaceRing[];
  highways: HighwayPolyline[];
}

export interface AirportRunway {
  leIdent: string;
  heIdent: string;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string;
  leLat: number;
  leLon: number;
  heLat: number;
  heLon: number;
  leHeadingDeg: number | null;
  heHeadingDeg: number | null;
}

export interface AirportDetailResponse {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  elevFt: number | null;
  runways: AirportRunway[];
  metar: {
    raw: string;
    flightCategory: string | null;
    wind: string | null;
    visibility: string | null;
    ceiling: string | null;
    tempC: number | null;
    observed: string | null;
  } | null;
}

export interface RouteLookupResponse {
  callsign: string;
  originIcao: string | null;
  arrivalIcao: string | null;
  airportCodes: string | null;
  plausible: boolean | null;
}

export interface TfrPolygon {
  id: string;
  name: string;
  type: string;
  points: [number, number][];
}

export interface TfrResponse {
  tfrs: TfrPolygon[];
}

export interface HomeResponse {
  lat: number;
  lon: number;
  source: "env" | "default";
}

export interface AircraftFeatureProps {
  hex: string;
  callsign: string;
  type: string;
  registration: string;
  squawk: string;
  emergency: string;
  dbFlags: number;
  altFt: number | null;
  speedKt: number | null;
  trackDeg: number | null;
  baroRateFpm: number | null;
  /** True when ADS-B reports on-ground / alt_baro "ground". */
  onGround?: boolean;
  arrivalIcao?: string | null;
}

export interface RainViewerFrame {
  time: number;
  path: string;
}

export interface RainViewerMaps {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
}
