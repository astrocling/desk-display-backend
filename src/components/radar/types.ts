export interface ToweredAirport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

export interface AirspaceRing {
  class: "B" | "C" | "D";
  id: string;
  points: [number, number][];
}

export interface MapContextResponse {
  airports: ToweredAirport[];
  rings: AirspaceRing[];
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
