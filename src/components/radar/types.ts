export interface MapAirport {
  icao: string;
  ident: string;
  name: string;
  lat: number;
  lon: number;
  towered: boolean;
  publicUse: boolean;
  pavedRunwayFt: number | null;
  /** Longest runway true heading (degrees) for glyph orientation. */
  primaryRunwayHeadingDeg?: number | null;
}

/** @deprecated Use MapAirport — alias kept to reduce call-site churn. */
export type ToweredAirport = MapAirport;

export interface FacilityBoundary {
  id: string;
  name: string;
  kind: "artcc" | "app_dep";
  points: [number, number][];
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
  airports: MapAirport[];
  rings: AirspaceRing[];
  highways: HighwayPolyline[];
  artcc: FacilityBoundary[];
  appDep: FacilityBoundary[];
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
  lighted: boolean | null;
}

export interface AirportFrequency {
  type: string;
  description: string;
  mhz: number;
}

export interface AirportDetailResponse {
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  elevFt: number | null;
  lat: number;
  lon: number;
  runways: AirportRunway[];
  frequencies: AirportFrequency[];
  metar: {
    raw: string;
    flightCategory: string | null;
    wind: string | null;
    visibility: string | null;
    ceiling: string | null;
    tempC: number | null;
    dewpointC: number | null;
    altimeterInHg: number | null;
    observed: string | null;
  } | null;
  taf: {
    raw: string;
    validFrom: string | null;
    validTo: string | null;
  } | null;
}

export interface RouteLookupResponse {
  callsign: string;
  originIcao: string | null;
  arrivalIcao: string | null;
  airportCodes: string | null;
  routeIcaos: string[];
  routeLocations: string[];
  airlineCode: string | null;
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
  /** Arrival ICAO for blip tags (first←→last of route when known). */
  arrivalIcao?: string | null;
  /** Full ordered ICAO chain for the selection card. */
  routeIcaos?: string[] | null;
  /** City/location per hop when aligned with routeIcaos. */
  routeLocations?: string[] | null;
  airlineCode?: string | null;
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
