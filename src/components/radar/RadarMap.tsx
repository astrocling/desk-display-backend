"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  ADSB_MAX_NM,
  ADSB_MIN_NM,
  ADSB_VIEWPORT_MAX_NM,
  MAP_CONTEXT_MAX_MI,
  MAP_CONTEXT_MIN_MI,
  clamp,
  haversineMiles,
  milesToNm,
  viewportRadiusMiles,
} from "./geo";
import {
  AIRPORT_TRAFFIC_RADIUS_NM,
  classifyAirportTraffic,
  type TrafficAircraft,
} from "./airportTraffic";
import { paintMapOverlays, paintScopeChrome } from "./radarOverlays";
import {
  SCOPE_SWEEP_MS,
  bearingDegFromCenter,
  crossedBySweep,
} from "./radarScope";
import {
  COLORS,
  RADAR_DECLUTTER_DEFAULT,
  RADAR_DECLUTTER_STORAGE_KEY,
  RADAR_MODE_DEFAULT,
  RADAR_MODE_STORAGE_KEY,
  classifyNotable,
  findWatchlistEntry,
  formatRadarTagLine2,
  formatRadarTagLine3,
  markColorFor,
  parseRadarDeclutterMode,
  parseRadarDisplayMode,
  radarDeclutterShortLabel,
  radarUnselectedLabel,
  tagLine1Display,
  watchlistColorHex,
  vectorLengthPx,
  type AircraftNotable,
  type RadarDeclutterMode,
  type RadarDisplayMode,
  type WatchlistColor,
  type WatchlistEntry,
} from "./radarFormat";
import {
  WATCHLIST_COLORS,
  isValidWatchlistReg,
  normalizeWatchlistNote,
} from "@/lib/radar-watchlist";
import { CommsPanel } from "./CommsPanel";
import { SelectionAircraftCard } from "./SelectionAircraftCard";
import { SelectionAirportCard } from "./SelectionAirportCard";
import { useAtcRadio } from "./useAtcRadio";
import { useCommsPresets } from "./useCommsPresets";
import {
  aircraftMatchesIdent,
  normalizeIdentQuery,
  pickBestIdentMatch,
} from "./identMatch";
import { visibleAircraftFor } from "./visibleAircraft";
import type {
  AirportDetailResponse,
  AirportRunway,
  AirspaceRing,
  AircraftFeatureProps,
  HighwayPolyline,
  HomeResponse,
  MapContextResponse,
  RainViewerMaps,
  RouteLookupResponse,
  TfrPolygon,
  TfrResponse,
  ToweredAirport,
} from "./types";

const DECLUTTER_MODES: RadarDeclutterMode[] = ["target", "callsign", "tag"];

function readStoredDeclutter(): RadarDeclutterMode {
  if (typeof window === "undefined") {
    return RADAR_DECLUTTER_DEFAULT;
  }
  try {
    return parseRadarDeclutterMode(
      window.localStorage.getItem(RADAR_DECLUTTER_STORAGE_KEY),
    );
  } catch {
    return RADAR_DECLUTTER_DEFAULT;
  }
}

function readStoredDisplayMode(): RadarDisplayMode {
  if (typeof window === "undefined") {
    return RADAR_MODE_DEFAULT;
  }
  try {
    return parseRadarDisplayMode(
      window.localStorage.getItem(RADAR_MODE_STORAGE_KEY),
    );
  } catch {
    return RADAR_MODE_DEFAULT;
  }
}

/** Dark raster basemap with glyphs so symbol labels can render. */
const BASEMAP_STYLE = {
  version: 8 as const,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-basemap",
      type: "raster" as const,
      source: "carto",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

/** Stay on dark tiles; lift blacks so pavement/taxiways read in ground mode. */
function applyBasemapForGround(map: MapLibreMap, ground: boolean) {
  if (!map.getLayer("carto-basemap")) return;
  map.setPaintProperty("carto-basemap", "raster-brightness-min", ground ? 0.22 : 0);
  map.setPaintProperty("carto-basemap", "raster-contrast", ground ? 0.12 : 0);
}

const ADSB_POLL_MS = 10_000;
const OVERLAY_DEBOUNCE_MS = 400;
const RAIN_REFRESH_MS = 5 * 60_000;

/** Scope sweep: one revolution per period, repainted at most every frame budget. */
const SCOPE_FRAME_MS = 60;

/** Default local overview zoom (home / locate / leave ground). */
const DEFAULT_MAP_ZOOM = 10;

/** Ground mode engages once a focused airport fills the viewport. */
const GROUND_ZOOM_MIN = 12.5;
const GROUND_VIEW_ZOOM = 13.5;

/** Bulk route lookup guard (API caps at 80 per request). */
const ROUTE_BULK_MAX = 60;

const SOURCE_RAIN = "radar-rain";
const LAYER_RAIN = "radar-rain-layer";

type AircraftPoint = AircraftFeatureProps & { lat: number; lon: number };

type RouteCacheEntry = {
  arrivalIcao: string | null;
  routeIcaos: string[];
  routeLocations: string[];
  airlineCode: string | null;
};

function routesEqual(
  a: Pick<
    AircraftFeatureProps,
    "arrivalIcao" | "routeIcaos" | "routeLocations" | "airlineCode"
  >,
  b: RouteCacheEntry,
): boolean {
  if ((a.arrivalIcao ?? null) !== b.arrivalIcao) return false;
  if ((a.airlineCode ?? null) !== b.airlineCode) return false;
  const aIcaos = a.routeIcaos ?? [];
  const aLocs = a.routeLocations ?? [];
  if (aIcaos.length !== b.routeIcaos.length) return false;
  if (aLocs.length !== b.routeLocations.length) return false;
  for (let i = 0; i < aIcaos.length; i++) {
    if (aIcaos[i] !== b.routeIcaos[i]) return false;
  }
  for (let i = 0; i < aLocs.length; i++) {
    if (aLocs[i] !== b.routeLocations[i]) return false;
  }
  return true;
}

function applyRouteCacheEntry(
  ac: AircraftPoint,
  entry: RouteCacheEntry,
): AircraftPoint {
  return {
    ...ac,
    arrivalIcao: entry.arrivalIcao,
    routeIcaos: entry.routeIcaos,
    routeLocations: entry.routeLocations,
    airlineCode: entry.airlineCode,
  };
}

function routeEntryFromLookup(route: RouteLookupResponse): RouteCacheEntry {
  return {
    arrivalIcao: route.arrivalIcao
      ? route.arrivalIcao.trim().toUpperCase()
      : null,
    routeIcaos: Array.isArray(route.routeIcaos)
      ? route.routeIcaos.map((c) => c.trim().toUpperCase()).filter(Boolean)
      : [],
    routeLocations: Array.isArray(route.routeLocations)
      ? route.routeLocations.map((c) => String(c ?? "").trim())
      : [],
    airlineCode: route.airlineCode
      ? route.airlineCode.trim().toUpperCase()
      : null,
  };
}

type FocusedAirport = {
  icao: string;
  name: string;
  lat: number;
  lon: number;
};

type AirportTrafficChip = { callsign: string; hex: string };

type AirportTrafficState = {
  inbound: AirportTrafficChip[];
  outbound: AirportTrafficChip[];
  radiusNm: number;
} | null;

function labelForAircraft(ac: Record<string, unknown>): string {
  const flight = typeof ac.flight === "string" ? ac.flight.trim() : "";
  if (flight) return flight;
  const r = typeof ac.r === "string" ? ac.r.trim() : "";
  if (r) return r;
  const hex = typeof ac.hex === "string" ? ac.hex : "";
  return hex || "?";
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseSquawk(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 7777) {
    return String(Math.trunc(value)).padStart(4, "0");
  }
  return "";
}

/** adsb.lol reports surface targets as the string "ground" in alt_baro. */
function isGroundAlt(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "ground";
}

function parseAdsbAircraft(data: unknown): AircraftPoint[] {
  if (!data || typeof data !== "object" || !("ac" in data)) {
    return [];
  }
  const ac = (data as { ac: unknown }).ac;
  if (!Array.isArray(ac)) {
    return [];
  }

  const out: AircraftPoint[] = [];
  for (const raw of ac) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const lat = numOrNull(item.lat);
    const lon = numOrNull(item.lon);
    if (lat == null || lon == null) continue;

    const hex = typeof item.hex === "string" ? item.hex : `${lon},${lat}`;
    const dbFlags =
      typeof item.dbFlags === "number" && Number.isFinite(item.dbFlags)
        ? item.dbFlags
        : 0;
    const onGround = isGroundAlt(item.alt_baro) || isGroundAlt(item.alt_geom);
    out.push({
      hex,
      callsign: labelForAircraft(item) || "?",
      type: typeof item.t === "string" ? item.t.trim() : "",
      registration: typeof item.r === "string" ? item.r.trim() : "",
      squawk: parseSquawk(item.squawk),
      emergency: typeof item.emergency === "string" ? item.emergency : "",
      dbFlags,
      altFt: onGround
        ? 0
        : (numOrNull(item.alt_baro) ?? numOrNull(item.alt_geom)),
      speedKt: numOrNull(item.gs),
      trackDeg: numOrNull(item.track) ?? numOrNull(item.calc_track),
      baroRateFpm: numOrNull(item.baro_rate) ?? numOrNull(item.geom_rate),
      onGround,
      arrivalIcao: null,
      routeIcaos: null,
      routeLocations: null,
      airlineCode: null,
      lat,
      lon,
    });
  }
  return out;
}

function toFeatureProps(ac: AircraftPoint): AircraftFeatureProps {
  return {
    hex: ac.hex,
    callsign: ac.callsign,
    type: ac.type,
    registration: ac.registration,
    squawk: ac.squawk,
    emergency: ac.emergency,
    dbFlags: ac.dbFlags,
    altFt: ac.altFt,
    speedKt: ac.speedKt,
    trackDeg: ac.trackDeg,
    baroRateFpm: ac.baroRateFpm,
    onGround: ac.onGround,
    arrivalIcao: ac.arrivalIcao ?? null,
    routeIcaos: ac.routeIcaos ?? null,
    routeLocations: ac.routeLocations ?? null,
    airlineCode: ac.airlineCode ?? null,
  };
}

function notableFor(
  ac: AircraftPoint,
  interestingEntries: readonly WatchlistEntry[],
): AircraftNotable {
  return classifyNotable({
    squawk: ac.squawk,
    emergency: ac.emergency,
    dbFlags: ac.dbFlags,
    registration: ac.registration,
    callsign: ac.callsign,
    interestingEntries,
  });
}

function normalizeCallsign(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Pure GA N-numbers have no airline route to look up. */
function skipRouteLookup(callsign: string): boolean {
  if (!callsign || callsign === "?") return true;
  if (/^N\d/.test(callsign)) return true;
  return !/^[A-Z0-9]{3,8}$/.test(callsign);
}

/** Longest runway drives the airport glyph orientation. */
function primaryRunwayHeading(runways: AirportRunway[]): number | null {
  let best: AirportRunway | null = null;
  for (const rwy of runways) {
    if (!best || (rwy.lengthFt ?? 0) > (best.lengthFt ?? 0)) {
      best = rwy;
    }
  }
  if (!best) return null;
  if (best.leHeadingDeg != null) return best.leHeadingDeg;
  const ident = Number.parseInt(best.leIdent, 10);
  if (Number.isFinite(ident) && ident >= 1 && ident <= 36) return ident * 10;
  return null;
}

function updateAircraftEl(
  root: HTMLElement,
  ac: AircraftPoint,
  selected: boolean,
  declutter: RadarDeclutterMode,
  interestingEntries: readonly WatchlistEntry[],
  tagPhase: 0 | 1,
  identMatched: boolean,
) {
  const entry = findWatchlistEntry(
    ac.registration,
    ac.callsign,
    interestingEntries,
  );
  const notable = notableFor(ac, interestingEntries);
  const onGround = ac.onGround === true;
  let color: string;
  if (selected) {
    color = COLORS.selected;
  } else if (notable === "emergency") {
    color = COLORS.alert;
  } else if (identMatched) {
    color = COLORS.ident;
  } else if (onGround && notable === "none") {
    color = COLORS.ground;
  } else {
    color = markColorFor(notable, false, entry?.color);
  }
  const unselected = radarUnselectedLabel(declutter);
  const showLabel = selected || unselected !== "none";
  const showLine2 = selected || unselected === "dense";
  root.classList.toggle("is-selected", selected);
  root.classList.toggle("is-dense", !showLabel);
  root.classList.toggle("is-ground", onGround);
  root.dataset.hex = ac.hex;
  root.title = ac.callsign;
  root.setAttribute("aria-label", ac.callsign);

  const mark = root.querySelector(".radar-ac-mark") as HTMLElement | null;
  if (mark) {
    mark.style.color = color;
    if (!showLabel) {
      mark.style.background = color;
    } else {
      mark.style.background = "transparent";
    }
  }

  const vector = root.querySelector(".radar-ac-vector") as HTMLElement | null;
  if (vector) {
    const len = vectorLengthPx(ac.speedKt);
    vector.style.width = `${len}px`;
    vector.style.background = color;
    vector.style.opacity = selected ? "1" : "0.85";
    vector.style.height = selected ? "2px" : "1px";
    if (ac.trackDeg != null) {
      vector.style.display = "block";
      vector.style.transform = `rotate(${ac.trackDeg - 90}deg)`;
    } else {
      vector.style.display = "none";
    }
  }

  const tag = root.querySelector(".radar-ac-tag") as HTMLElement | null;
  if (tag) {
    if (!showLabel) {
      tag.style.display = "none";
    } else {
      tag.style.display = "block";
      tag.style.opacity = selected ? "1" : "0.75";
      const line1 = tag.querySelector(".radar-ac-line1") as HTMLElement | null;
      const line2 = tag.querySelector(".radar-ac-line2") as HTMLElement | null;
      const line3 = tag.querySelector(".radar-ac-line3") as HTMLElement | null;
      if (line1) {
        line1.textContent = tagLine1Display(
          ac.callsign,
          entry?.note,
          tagPhase,
        );
        line1.style.color = color;
      }
      if (line2) {
        if (showLine2) {
          line2.textContent = formatRadarTagLine2({
            altFt: ac.altFt,
            speedKt: ac.speedKt,
            baroRateFpm: ac.baroRateFpm,
            style: selected ? "full" : "dense",
          });
          line2.style.display = "block";
          line2.style.color = COLORS.accent;
        } else {
          line2.textContent = "";
          line2.style.display = "none";
        }
      }
      if (line3) {
        if (selected) {
          const text = formatRadarTagLine3({
            type: ac.type,
            squawk: ac.squawk,
            notable,
            arrivalIcao: ac.arrivalIcao,
          });
          line3.textContent = text;
          line3.style.display = text ? "block" : "none";
          line3.style.color = COLORS.accent;
        } else {
          line3.textContent = "";
          line3.style.display = "none";
        }
      }
    }
  }
}

function makeAircraftEl(
  ac: AircraftPoint,
  onSelect: (ac: AircraftPoint) => void,
  interestingEntries: readonly WatchlistEntry[],
  tagPhase: 0 | 1,
  identMatched: boolean,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "radar-ac";
  el.innerHTML = `
    <span class="radar-ac-vector" aria-hidden="true"></span>
    <span class="radar-ac-mark" aria-hidden="true">*</span>
    <span class="radar-ac-tag">
      <span class="radar-ac-line1"></span>
      <span class="radar-ac-line2"></span>
      <span class="radar-ac-line3"></span>
    </span>
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(ac);
  });
  updateAircraftEl(
    el,
    ac,
    false,
    RADAR_DECLUTTER_DEFAULT,
    interestingEntries,
    tagPhase,
    identMatched,
  );
  return el;
}

function makeAirportEl(
  airport: ToweredAirport,
  onSelect: (airport: ToweredAirport) => void,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "radar-airport";
  el.title = `${airport.icao} — ${airport.name}`;
  el.setAttribute("aria-label", `${airport.icao} ${airport.name}`);
  el.dataset.icao = airport.icao;
  el.innerHTML = `
    <span class="radar-airport-plus" aria-hidden="true">+</span>
    <span class="radar-airport-label"></span>
  `;
  const label = el.querySelector(".radar-airport-label");
  if (label) label.textContent = airport.icao;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(airport);
  });
  return el;
}

function applyAirportHeading(el: HTMLElement, headingDeg: number | null) {
  if (headingDeg == null) {
    el.classList.remove("has-heading");
    el.style.removeProperty("--radar-rwy-rot");
    delete el.dataset.heading;
    return;
  }
  el.dataset.heading = String(Math.round(headingDeg));
  el.style.setProperty("--radar-rwy-rot", `${headingDeg}deg`);
  el.classList.add("has-heading");
}

export function RadarMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlaySvgRef = useRef<SVGSVGElement | null>(null);
  const scopeSvgRef = useRef<SVGSVGElement | null>(null);
  const ringsRef = useRef<AirspaceRing[]>([]);
  const highwaysRef = useRef<HighwayPolyline[]>([]);
  const tfrsRef = useRef<TfrPolygon[]>([]);
  const runwaysRef = useRef<AirportRunway[]>([]);
  const homeRef = useRef<{ lat: number; lon: number }>({
    lat: 40.03353,
    lon: -84.19588,
  });
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rainFramesRef = useRef<{
    host: string;
    frames: { time: number; path: string }[];
  }>({
    host: "",
    frames: [],
  });
  const aircraftMarkersRef = useRef(
    new Map<string, { marker: Marker; ac: AircraftPoint }>(),
  );
  const airportMarkersRef = useRef(new Map<string, Marker>());
  const airportHeadingsRef = useRef(new Map<string, number>());
  const selectAircraftRef = useRef<(ac: AircraftPoint) => void>(() => {});
  const selectAirportRef = useRef<(airport: ToweredAirport) => void>(() => {});
  const lastAircraftRef = useRef<AircraftPoint[]>([]);
  const arrivalCacheRef = useRef(new Map<string, RouteCacheEntry>());
  const routeInflightRef = useRef(new Set<string>());
  const sweepDegRef = useRef<number | null>(null);
  const prevSweepDegRef = useRef<number | null>(null);
  const focusedAirportRef = useRef<FocusedAirport | null>(null);
  /** Guards against a stale traffic response landing after focus changed/cleared. */
  const airportTrafficGenerationRef = useRef(0);
  const groundModeRef = useRef(false);
  const showGroundTargetsRef = useRef(false);
  const displayModeRef = useRef<RadarDisplayMode>(RADAR_MODE_DEFAULT);
  const tfrsOnRef = useRef(true);

  const selectedHexRef = useRef<string | null>(null);
  const declutterRef = useRef<RadarDeclutterMode>(RADAR_DECLUTTER_DEFAULT);
  const interestingEntriesRef = useRef<WatchlistEntry[]>([]);
  const tagPhaseRef = useRef<0 | 1>(0);
  const identQueryRef = useRef("");
  const identAutoHexRef = useRef<string | null>(null);
  const identInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState("Loading map…");
  const [aircraftCount, setAircraftCount] = useState(0);
  const [selected, setSelected] = useState<AircraftFeatureProps | null>(null);
  const [icaoInput, setIcaoInput] = useState("");
  const [icaoError, setIcaoError] = useState<string | null>(null);
  const [weatherOn, setWeatherOn] = useState(false);
  const [weatherOpacity, setWeatherOpacity] = useState(0.65);
  const [frameIndex, setFrameIndex] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [adsbActive, setAdsbActive] = useState(false);
  const [overlaysActive, setOverlaysActive] = useState(false);
  const [declutter, setDeclutter] = useState<RadarDeclutterMode>(
    RADAR_DECLUTTER_DEFAULT,
  );
  const [displayMode, setDisplayMode] = useState<RadarDisplayMode>(
    RADAR_MODE_DEFAULT,
  );
  const [tfrsOn, setTfrsOn] = useState(true);
  const [tfrCount, setTfrCount] = useState(0);
  const [groundMode, setGroundMode] = useState(false);
  const [showGroundTargets, setShowGroundTargetsState] = useState(false);
  const [focusedIcao, setFocusedIcao] = useState<string | null>(null);
  const [airportDetail, setAirportDetail] =
    useState<AirportDetailResponse | null>(null);
  const [airportLoading, setAirportLoading] = useState(false);
  const [airportError, setAirportError] = useState<string | null>(null);
  const atcRadio = useAtcRadio();
  const commsPresets = useCommsPresets();
  const [airportTraffic, setAirportTraffic] =
    useState<AirportTrafficState>(null);
  const [declutterOpen, setDeclutterOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistEntries, setWatchlistEntries] = useState<WatchlistEntry[]>(
    [],
  );
  const [watchlistDraft, setWatchlistDraft] = useState<WatchlistEntry[]>([]);
  const [watchlistAdd, setWatchlistAdd] = useState("");
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [identQuery, setIdentQueryState] = useState("");

  useEffect(() => {
    const stored = readStoredDeclutter();
    declutterRef.current = stored;
    setDeclutter(stored);
    const storedMode = readStoredDisplayMode();
    displayModeRef.current = storedMode;
    setDisplayMode(storedMode);
  }, []);

  const refreshAircraftLabels = useCallback(() => {
    const selectedHex = selectedHexRef.current;
    const entries = interestingEntriesRef.current;
    const mode = declutterRef.current;
    const tagPhase = tagPhaseRef.current;
    const identQ = identQueryRef.current;
    for (const [hex, entry] of aircraftMarkersRef.current) {
      updateAircraftEl(
        entry.marker.getElement(),
        entry.ac,
        hex === selectedHex,
        mode,
        entries,
        tagPhase,
        aircraftMatchesIdent(entry.ac, identQ),
      );
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      tagPhaseRef.current = tagPhaseRef.current === 0 ? 1 : 0;
      refreshAircraftLabels();
    }, 2000);
    return () => window.clearInterval(id);
  }, [refreshAircraftLabels]);

  const setDeclutterMode = useCallback(
    (mode: RadarDeclutterMode) => {
      declutterRef.current = mode;
      setDeclutter(mode);
      try {
        window.localStorage.setItem(RADAR_DECLUTTER_STORAGE_KEY, mode);
      } catch {
        // ignore quota / private mode
      }
      refreshAircraftLabels();
    },
    [refreshAircraftLabels],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      identInputRef.current?.focus();
      identInputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const syncAircraftMarkersRef = useRef<
    (map: MapLibreMap, aircraft: AircraftPoint[]) => AircraftPoint[]
  >(() => []);

  const setDisplayModeAndPersist = useCallback((mode: RadarDisplayMode) => {
    const prev = displayModeRef.current;
    displayModeRef.current = mode;
    setDisplayMode(mode);
    try {
      window.localStorage.setItem(RADAR_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore quota / private mode
    }
    if (prev !== mode && mode === "map") {
      // Leaving scope: snap every target to the latest poll.
      const map = mapRef.current;
      if (map) {
        const visible = syncAircraftMarkersRef.current(
          map,
          lastAircraftRef.current,
        );
        setAircraftCount(visible.length);
      }
    }
  }, []);

  selectAircraftRef.current = (ac: AircraftPoint) => {
    selectedHexRef.current = ac.hex;
    setSelected(toFeatureProps(ac));
    const entries = interestingEntriesRef.current;
    const mode = declutterRef.current;
    const tagPhase = tagPhaseRef.current;
    const identQ = identQueryRef.current;
    for (const [hex, entry] of aircraftMarkersRef.current) {
      updateAircraftEl(
        entry.marker.getElement(),
        entry.ac,
        hex === ac.hex,
        mode,
        entries,
        tagPhase,
        aircraftMatchesIdent(entry.ac, identQ),
      );
    }
  };

  const clearAircraftMarkers = useCallback(() => {
    for (const { marker } of aircraftMarkersRef.current.values()) {
      marker.remove();
    }
    aircraftMarkersRef.current.clear();
  }, []);

  const clearAirportMarkers = useCallback(() => {
    for (const marker of airportMarkersRef.current.values()) {
      marker.remove();
    }
    airportMarkersRef.current.clear();
  }, []);

  const applyIdentSelection = useCallback(
    (map: MapLibreMap, visible: AircraftPoint[]) => {
      const q = identQueryRef.current;
      if (!normalizeIdentQuery(q)) {
        identAutoHexRef.current = null;
        return;
      }
      const matches = visible.filter((a) => aircraftMatchesIdent(a, q));
      const center = map.getCenter();
      const best = pickBestIdentMatch(
        matches,
        { lat: center.lat, lon: center.lng },
        q,
      );
      if (!best) {
        identAutoHexRef.current = null;
        return;
      }
      if (best.hex !== identAutoHexRef.current) {
        identAutoHexRef.current = best.hex;
        selectAircraftRef.current(best);
      }
    },
    [],
  );

  const setIdentQuery = useCallback(
    (raw: string) => {
      identQueryRef.current = raw;
      identAutoHexRef.current = null;
      setIdentQueryState(raw);
      refreshAircraftLabels();
      if (!normalizeIdentQuery(raw)) return;
      const map = mapRef.current;
      if (map) {
        const visible = visibleAircraftFor(
          lastAircraftRef.current,
          groundModeRef.current ? focusedAirportRef.current : null,
          showGroundTargetsRef.current,
        );
        applyIdentSelection(map, visible);
      }
    },
    [applyIdentSelection, refreshAircraftLabels],
  );

  const upsertAircraftMarker = useCallback(
    (map: MapLibreMap, ac: AircraftPoint) => {
      const declutterMode = declutterRef.current;
      const selectedHex = selectedHexRef.current;
      const entries = interestingEntriesRef.current;
      const tagPhase = tagPhaseRef.current;
      const identMatched = aircraftMatchesIdent(ac, identQueryRef.current);
      const existing = aircraftMarkersRef.current.get(ac.hex);
      if (existing) {
        existing.ac = ac;
        existing.marker.setLngLat([ac.lon, ac.lat]);
        const el = existing.marker.getElement();
        el.onclick = (e) => {
          e.stopPropagation();
          selectAircraftRef.current(ac);
        };
        updateAircraftEl(
          el,
          ac,
          ac.hex === selectedHex,
          declutterMode,
          entries,
          tagPhase,
          identMatched,
        );
        if (ac.hex === selectedHex) {
          setSelected(toFeatureProps(ac));
        }
        return;
      }
      const el = makeAircraftEl(
        ac,
        (picked) => selectAircraftRef.current(picked),
        entries,
        tagPhase,
        identMatched,
      );
      updateAircraftEl(
        el,
        ac,
        ac.hex === selectedHex,
        declutterMode,
        entries,
        tagPhase,
        identMatched,
      );
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([ac.lon, ac.lat])
        .addTo(map);
      aircraftMarkersRef.current.set(ac.hex, { marker, ac });
    },
    [],
  );

  const removeAircraftMarker = useCallback((hex: string) => {
    const entry = aircraftMarkersRef.current.get(hex);
    if (!entry) return;
    entry.marker.remove();
    aircraftMarkersRef.current.delete(hex);
    if (selectedHexRef.current === hex) {
      selectedHexRef.current = null;
      setSelected(null);
    }
  }, []);

  /** Map mode: paint every visible target immediately. */
  const syncAircraftMarkers = useCallback(
    (map: MapLibreMap, aircraft: AircraftPoint[]): AircraftPoint[] => {
      const visible = visibleAircraftFor(
        aircraft,
        groundModeRef.current ? focusedAirportRef.current : null,
        showGroundTargetsRef.current,
      );
      const seen = new Set<string>();
      for (const ac of visible) {
        seen.add(ac.hex);
        upsertAircraftMarker(map, ac);
      }
      for (const hex of aircraftMarkersRef.current.keys()) {
        if (!seen.has(hex)) {
          removeAircraftMarker(hex);
        }
      }
      applyIdentSelection(map, visible);
      return visible;
    },
    [applyIdentSelection, removeAircraftMarker, upsertAircraftMarker],
  );

  /**
   * Scope mode: update/drop markers only as the sweep crosses their bearing
   * (matches device Classic paint-on-scan). Polls refresh the source list only.
   */
  const paintScopeAircraft = useCallback(
    (sweepDeg: number, prevSweepDeg: number | null) => {
      const map = mapRef.current;
      if (!map || displayModeRef.current !== "scope") return;

      const center = map.getCenter();
      const source = visibleAircraftFor(
        lastAircraftRef.current,
        groundModeRef.current ? focusedAirportRef.current : null,
        showGroundTargetsRef.current,
      );
      const sourceByHex = new Map(source.map((ac) => [ac.hex, ac]));

      for (const ac of source) {
        const brg = bearingDegFromCenter(
          center.lat,
          center.lng,
          ac.lat,
          ac.lon,
        );
        if (crossedBySweep(prevSweepDeg, sweepDeg, brg)) {
          upsertAircraftMarker(map, ac);
        }
      }

      for (const [hex, entry] of aircraftMarkersRef.current) {
        const brg = bearingDegFromCenter(
          center.lat,
          center.lng,
          entry.ac.lat,
          entry.ac.lon,
        );
        if (
          crossedBySweep(prevSweepDeg, sweepDeg, brg) &&
          !sourceByHex.has(hex)
        ) {
          removeAircraftMarker(hex);
        }
      }

      setAircraftCount(aircraftMarkersRef.current.size);
    },
    [removeAircraftMarker, upsertAircraftMarker],
  );

  const resyncAircraft = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (displayModeRef.current === "scope") {
      // Prune filtered-out targets; new ones wait for the sweep.
      const visible = visibleAircraftFor(
        lastAircraftRef.current,
        groundModeRef.current ? focusedAirportRef.current : null,
        showGroundTargetsRef.current,
      );
      const visibleHex = new Set(visible.map((ac) => ac.hex));
      for (const hex of [...aircraftMarkersRef.current.keys()]) {
        if (!visibleHex.has(hex)) {
          removeAircraftMarker(hex);
        }
      }
      for (const ac of visible) {
        const existing = aircraftMarkersRef.current.get(ac.hex);
        if (existing) {
          upsertAircraftMarker(map, ac);
        }
      }
      setAircraftCount(aircraftMarkersRef.current.size);
      applyIdentSelection(map, visible);
      return;
    }
    const visible = syncAircraftMarkers(map, lastAircraftRef.current);
    setAircraftCount(visible.length);
  }, [
    applyIdentSelection,
    removeAircraftMarker,
    syncAircraftMarkers,
    upsertAircraftMarker,
  ]);

  const setShowGroundTargets = useCallback(
    (next: boolean) => {
      if (next === showGroundTargetsRef.current) return;
      showGroundTargetsRef.current = next;
      setShowGroundTargetsState(next);
      resyncAircraft();
    },
    [resyncAircraft],
  );

  syncAircraftMarkersRef.current = syncAircraftMarkers;

  const syncAirportMarkers = useCallback(
    (map: MapLibreMap, airports: ToweredAirport[]) => {
      const seen = new Set<string>();
      for (const airport of airports) {
        seen.add(airport.icao);
        const headingFromCtx =
          typeof airport.primaryRunwayHeadingDeg === "number"
            ? airport.primaryRunwayHeadingDeg
            : null;
        if (headingFromCtx != null) {
          airportHeadingsRef.current.set(airport.icao, headingFromCtx);
        }
        const heading =
          headingFromCtx ??
          airportHeadingsRef.current.get(airport.icao) ??
          null;
        const existing = airportMarkersRef.current.get(airport.icao);
        if (existing) {
          existing.setLngLat([airport.lon, airport.lat]);
          applyAirportHeading(existing.getElement(), heading);
        } else {
          const el = makeAirportEl(airport, (picked) =>
            selectAirportRef.current(picked),
          );
          applyAirportHeading(el, heading);
          const marker = new Marker({ element: el, anchor: "center" })
            .setLngLat([airport.lon, airport.lat])
            .addTo(map);
          airportMarkersRef.current.set(airport.icao, marker);
        }
      }
      for (const [icao, marker] of airportMarkersRef.current) {
        if (!seen.has(icao)) {
          marker.remove();
          airportMarkersRef.current.delete(icao);
        }
      }
    },
    [],
  );

  const readViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return null;
    const center = map.getCenter();
    const bounds = map.getBounds();
    const ne = bounds.getNorthEast();
    const north = bounds.getNorth();
    const radiusMi = viewportRadiusMiles(
      center.lat,
      center.lng,
      ne.lat,
      ne.lng,
    );
    // PPI-equivalent range: center → north edge (not corner — corner was too large for tags).
    const rangeMi = haversineMiles(
      center.lat,
      center.lng,
      north,
      center.lng,
    );
    return {
      lat: center.lat,
      lon: center.lng,
      radiusMi,
      radiusNm: milesToNm(radiusMi),
      rangeMi,
      zoom: map.getZoom(),
    };
  }, []);

  const redrawScope = useCallback(() => {
    const map = mapRef.current;
    const svg = scopeSvgRef.current;
    if (!map || !svg) return;
    if (displayModeRef.current !== "scope") {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.style.display = "none";
      return;
    }
    const vp = readViewport();
    if (!vp) return;
    svg.style.display = "block";
    paintScopeChrome(map, svg, {
      centerLat: vp.lat,
      centerLon: vp.lon,
      radiusMi: vp.rangeMi,
      sweepDeg: sweepDegRef.current,
    });
  }, [readViewport]);

  /** Single SVG for map overlays; paint order highways → airspace → TFRs → runways. */
  const redrawOverlays = useCallback(() => {
    const map = mapRef.current;
    const svg = overlaySvgRef.current;
    if (!map || !svg) return;
    const ground = groundModeRef.current;
    paintMapOverlays(map, svg, {
      highways: highwaysRef.current,
      artcc: [],
      appDep: [],
      rings: ringsRef.current,
      tfrs: tfrsRef.current,
      runways: runwaysRef.current,
      showHighways: !ground,
      showArtcc: false,
      showAppDep: false,
      // Ground mode is an airport-surface view; airspace shelves add nothing.
      showAirspace: !ground,
      showTfrs: tfrsOnRef.current,
      showRunways: ground && runwaysRef.current.length > 0,
    });
    redrawScope();
  }, [redrawScope]);

  const syncGroundMode = useCallback(() => {
    const map = mapRef.current;
    const focus = focusedAirportRef.current;
    const next = !!focus && !!map && map.getZoom() >= GROUND_ZOOM_MIN;
    if (next === groundModeRef.current) return;
    groundModeRef.current = next;
    setGroundMode(next);
    // Auto: enter → on, leave → off (overwrites manual override).
    // Ref+state set directly (not setShowGroundTargets) so resyncAircraft() below is the single resync.
    showGroundTargetsRef.current = next;
    setShowGroundTargetsState(next);
    if (map) applyBasemapForGround(map, next);
    redrawOverlays();
    resyncAircraft();
  }, [redrawOverlays, resyncAircraft]);

  const applyArrivals = useCallback(() => {
    const cache = arrivalCacheRef.current;
    let changed = false;
    for (const entry of aircraftMarkersRef.current.values()) {
      const cs = normalizeCallsign(entry.ac.callsign);
      const route = cache.get(cs);
      if (route === undefined) continue;
      if (routesEqual(entry.ac, route)) continue;
      entry.ac = applyRouteCacheEntry(entry.ac, route);
      changed = true;
    }
    if (!changed) return;
    refreshAircraftLabels();
    const selHex = selectedHexRef.current;
    if (selHex) {
      const entry = aircraftMarkersRef.current.get(selHex);
      if (entry) setSelected(toFeatureProps(entry.ac));
    }
  }, [refreshAircraftLabels]);

  const fetchRoutes = useCallback(
    async (aircraft: AircraftPoint[]) => {
      const cache = arrivalCacheRef.current;
      const inflight = routeInflightRef.current;
      const wanted: { callsign: string; lat: number; lon: number }[] = [];
      const queued = new Set<string>();
      for (const ac of aircraft) {
        const cs = normalizeCallsign(ac.callsign);
        if (skipRouteLookup(cs)) continue;
        if (queued.has(cs) || cache.has(cs) || inflight.has(cs)) continue;
        queued.add(cs);
        wanted.push({ callsign: cs, lat: ac.lat, lon: ac.lon });
        if (wanted.length >= ROUTE_BULK_MAX) break;
      }
      if (wanted.length === 0) return;

      for (const p of wanted) inflight.add(p.callsign);
      try {
        const res = await fetch("/api/adsb/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planes: wanted }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { routes?: RouteLookupResponse[] };
        for (const route of data.routes ?? []) {
          const cs = normalizeCallsign(route.callsign ?? "");
          if (!cs) continue;
          cache.set(cs, routeEntryFromLookup(route));
        }
        applyArrivals();
      } catch {
        // routes are decoration; keep the scope usable without them
      } finally {
        for (const p of wanted) inflight.delete(p.callsign);
      }
    },
    [applyArrivals],
  );

  const fetchAdsb = useCallback(async () => {
    const map = mapRef.current;
    const vp = readViewport();
    if (!map || !vp) return;

    if (vp.radiusNm > ADSB_VIEWPORT_MAX_NM) {
      setAdsbActive(false);
      clearAircraftMarkers();
      lastAircraftRef.current = [];
      setAircraftCount(0);
      setStatus("Zoom in for traffic");
      return;
    }

    const dist = clamp(vp.radiusNm, ADSB_MIN_NM, ADSB_MAX_NM);
    try {
      const res = await fetch(
        `/api/adsb?lat=${vp.lat}&lon=${vp.lon}&dist=${dist.toFixed(1)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setAdsbActive(false);
        setStatus(`ADS-B error ${res.status}`);
        return;
      }
      const json = await res.json();
      const aircraft = parseAdsbAircraft(json);
      // Seed known routes so freshly created tags/cards render complete.
      for (const ac of aircraft) {
        const route = arrivalCacheRef.current.get(
          normalizeCallsign(ac.callsign),
        );
        if (route) {
          ac.arrivalIcao = route.arrivalIcao;
          ac.routeIcaos = route.routeIcaos;
          ac.routeLocations = route.routeLocations;
          ac.airlineCode = route.airlineCode;
        }
      }
      lastAircraftRef.current = aircraft;
      setAdsbActive(true);
      const visible = visibleAircraftFor(
        aircraft,
        groundModeRef.current ? focusedAirportRef.current : null,
        showGroundTargetsRef.current,
      );
      if (displayModeRef.current === "scope") {
        // Source only — markers update when the sweep crosses each target.
        setAircraftCount(aircraftMarkersRef.current.size);
        applyIdentSelection(map, visible);
      } else {
        syncAircraftMarkers(map, aircraft);
        setAircraftCount(visible.length);
      }
      const bits = [`${visible.length} aircraft`];
      if (groundModeRef.current && focusedAirportRef.current) {
        bits.push(`ground ${focusedAirportRef.current.icao}`);
      }
      if (overlaysActive) bits.push("overlays on");
      bits.push(radarDeclutterShortLabel(declutterRef.current));
      setStatus(bits.join(" · "));
      void fetchRoutes(aircraft);
    } catch {
      setAdsbActive(false);
      setStatus("ADS-B fetch failed");
    }
  }, [
    clearAircraftMarkers,
    fetchRoutes,
    overlaysActive,
    readViewport,
    applyIdentSelection,
    syncAircraftMarkers,
  ]);

  /**
   * Poll ADS-B centered on the focused airport (not the viewport) so the
   * selection card can show live nearby inbound/outbound. Never touches the
   * main map's aircraft markers or count.
   */
  const fetchAirportTraffic = useCallback(async () => {
    const focus = focusedAirportRef.current;
    if (!focus) return;
    const generation = ++airportTrafficGenerationRef.current;
    const dist = clamp(AIRPORT_TRAFFIC_RADIUS_NM, ADSB_MIN_NM, ADSB_MAX_NM);

    try {
      const res = await fetch(
        `/api/adsb?lat=${focus.lat}&lon=${focus.lon}&dist=${dist}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        if (generation === airportTrafficGenerationRef.current) {
          setAirportTraffic(null);
        }
        return;
      }
      const json = await res.json();
      const aircraft = parseAdsbAircraft(json);
      for (const ac of aircraft) {
        const route = arrivalCacheRef.current.get(
          normalizeCallsign(ac.callsign),
        );
        if (route) ac.routeIcaos = route.routeIcaos;
      }
      // Resolve routes we don't have cached yet; next poll tick will see them.
      void fetchRoutes(aircraft);

      if (
        generation !== airportTrafficGenerationRef.current ||
        focusedAirportRef.current?.icao !== focus.icao
      ) {
        return; // focus changed/cleared or a newer poll is in flight
      }

      const trafficAircraft: TrafficAircraft[] = aircraft.map((ac) => ({
        hex: ac.hex,
        callsign: ac.callsign,
        routeIcaos: ac.routeIcaos,
      }));
      const { inbound, outbound } = classifyAirportTraffic(
        focus.icao,
        trafficAircraft,
      );
      setAirportTraffic({
        inbound: inbound.map((a) => ({ callsign: a.callsign, hex: a.hex })),
        outbound: outbound.map((a) => ({ callsign: a.callsign, hex: a.hex })),
        radiusNm: AIRPORT_TRAFFIC_RADIUS_NM,
      });
    } catch {
      if (generation === airportTrafficGenerationRef.current) {
        setAirportTraffic(null);
      }
    }
  }, [fetchRoutes]);

  const fetchTfrs = useCallback(async () => {
    const vp = readViewport();
    if (!vp) return;
    if (!tfrsOnRef.current) {
      tfrsRef.current = [];
      setTfrCount(0);
      redrawOverlays();
      return;
    }
    const radiusMi = clamp(vp.radiusMi, MAP_CONTEXT_MIN_MI, MAP_CONTEXT_MAX_MI);
    try {
      const res = await fetch(
        `/api/map/tfrs?lat=${vp.lat}&lon=${vp.lon}&radiusMi=${radiusMi.toFixed(1)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as TfrResponse;
      if (!tfrsOnRef.current) return;
      tfrsRef.current = data.tfrs ?? [];
      setTfrCount(tfrsRef.current.length);
      redrawOverlays();
    } catch {
      // keep last-good TFRs
    }
  }, [readViewport, redrawOverlays]);

  const fetchOverlays = useCallback(async () => {
    const map = mapRef.current;
    const vp = readViewport();
    if (!map || !vp) return;

    // Request overlays for the visible radius (API allows up to MAP_CONTEXT_MAX_MI).
    // Device radar capped near 50 mi; web keeps shelves complete when zoomed out.
    setOverlaysActive(true);
    const radiusMi = clamp(vp.radiusMi, MAP_CONTEXT_MIN_MI, MAP_CONTEXT_MAX_MI);
    try {
      const res = await fetch(
        `/api/map/context?lat=${vp.lat}&lon=${vp.lon}&radiusMi=${radiusMi.toFixed(1)}`,
      );
      if (!res.ok) {
        return;
      }
      const ctx = (await res.json()) as MapContextResponse;
      const airports = ctx.airports ?? [];
      syncAirportMarkers(map, airports);
      ringsRef.current = ctx.rings ?? [];
      highwaysRef.current = ctx.highways ?? [];
      redrawOverlays();
    } catch {
      // keep last-good overlays
    }
    void fetchTfrs();
  }, [fetchTfrs, readViewport, redrawOverlays, syncAirportMarkers]);

  const scheduleOverlays = useCallback(() => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = setTimeout(() => {
      void fetchOverlays();
    }, OVERLAY_DEBOUNCE_MS);
  }, [fetchOverlays]);

  /** Chip click on the airport card: select the aircraft if it's currently known, else no-op. */
  const selectAirportTrafficHex = useCallback((hex: string) => {
    const entry = aircraftMarkersRef.current.get(hex);
    if (entry) {
      selectAircraftRef.current(entry.ac);
      return;
    }
    const ac = lastAircraftRef.current.find((candidate) => candidate.hex === hex);
    if (ac) selectAircraftRef.current(ac);
  }, []);

  const clearAirportFocus = useCallback(() => {
    focusedAirportRef.current = null;
    runwaysRef.current = [];
    airportTrafficGenerationRef.current++;
    setFocusedIcao(null);
    setAirportDetail(null);
    setAirportError(null);
    setAirportTraffic(null);
    syncGroundMode();
    redrawOverlays();
  }, [redrawOverlays, syncGroundMode]);

  const openAirportDetail = useCallback(
    async (airport: ToweredAirport) => {
      setWatchlistOpen(false);
      setDeclutterOpen(false);
      setAirportError(null);
      setAirportLoading(true);
      focusedAirportRef.current = {
        icao: airport.icao,
        name: airport.name,
        lat: airport.lat,
        lon: airport.lon,
      };
      airportTrafficGenerationRef.current++;
      setAirportTraffic(null);
      setFocusedIcao(airport.icao);
      try {
        const res = await fetch(
          `/api/airport/detail?icao=${encodeURIComponent(airport.icao)}`,
        );
        if (!res.ok) {
          setAirportError(
            res.status === 404 ? "Airport not found" : `Error ${res.status}`,
          );
          setAirportDetail(null);
          return;
        }
        const detail = (await res.json()) as AirportDetailResponse;
        setAirportDetail(detail);
        runwaysRef.current = detail.runways ?? [];
        if (detail.lat && detail.lon) {
          focusedAirportRef.current = {
            icao: detail.icao,
            name: detail.name || airport.name,
            lat: detail.lat,
            lon: detail.lon,
          };
        }
        const heading = primaryRunwayHeading(detail.runways ?? []);
        if (heading != null) {
          airportHeadingsRef.current.set(detail.icao, heading);
        }
        const marker = airportMarkersRef.current.get(detail.icao);
        if (marker) applyAirportHeading(marker.getElement(), heading);
        syncGroundMode();
        redrawOverlays();
      } catch {
        setAirportError("Lookup failed");
        setAirportDetail(null);
      } finally {
        setAirportLoading(false);
      }
    },
    [redrawOverlays, syncGroundMode],
  );

  useEffect(() => {
    selectAirportRef.current = (airport: ToweredAirport) => {
      void openAirportDetail(airport);
    };
  }, [openAirportDetail]);

  const enterGroundView = useCallback(() => {
    const map = mapRef.current;
    const focus = focusedAirportRef.current;
    if (!map || !focus) return;
    map.flyTo({
      center: [focus.lon, focus.lat],
      zoom: GROUND_VIEW_ZOOM,
      essential: true,
    });
    setStatus(`Ground view ${focus.icao}`);
  }, []);

  /** Leave ground mode: back to default overview zoom on the focused field. */
  const exitGroundView = useCallback(() => {
    const map = mapRef.current;
    const focus = focusedAirportRef.current;
    if (!map || !focus) return;
    map.flyTo({
      center: [focus.lon, focus.lat],
      zoom: DEFAULT_MAP_ZOOM,
      essential: true,
    });
    setStatus(`Centered on ${focus.icao}`);
  }, []);

  const applyRainFrame = useCallback(
    (index: number, opacity: number, enabled: boolean) => {
      const map = mapRef.current;
      const { host, frames } = rainFramesRef.current;
      if (!map || !map.isStyleLoaded()) return;

      if (!enabled || frames.length === 0 || !host) {
        if (map.getLayer(LAYER_RAIN)) {
          map.setLayoutProperty(LAYER_RAIN, "visibility", "none");
        }
        return;
      }

      const frame = frames[clamp(index, 0, frames.length - 1)];
      const tileUrl = `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

      if (map.getSource(SOURCE_RAIN)) {
        map.removeLayer(LAYER_RAIN);
        map.removeSource(SOURCE_RAIN);
      }

      map.addSource(SOURCE_RAIN, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: 7,
      });

      map.addLayer({
        id: LAYER_RAIN,
        type: "raster",
        source: SOURCE_RAIN,
        paint: { "raster-opacity": opacity },
      });
    },
    [],
  );

  const loadRainViewer = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.rainviewer.com/public/weather-maps.json",
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as RainViewerMaps;
      const frames = [
        ...(data.radar.past ?? []),
        ...(data.radar.nowcast ?? []),
      ];
      rainFramesRef.current = { host: data.host, frames };
      setFrameCount(frames.length);
      const last = Math.max(0, frames.length - 1);
      setFrameIndex(last);
      if (weatherOn) {
        applyRainFrame(last, weatherOpacity, true);
      }
    } catch {
      // weather optional
    }
  }, [applyRainFrame, weatherOn, weatherOpacity]);

  const goHome = useCallback((animate = true) => {
    const map = mapRef.current;
    if (!map) return;
    const { lat, lon } = homeRef.current;
    if (animate) {
      map.flyTo({ center: [lon, lat], zoom: DEFAULT_MAP_ZOOM, essential: true });
    } else {
      map.setCenter([lon, lat]);
      map.setZoom(DEFAULT_MAP_ZOOM);
    }
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      goHome();
      setStatus("Geolocation unavailable — using home");
      return;
    }
    setStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: DEFAULT_MAP_ZOOM,
          essential: true,
        });
        setStatus("Centered on your location");
      },
      () => {
        goHome();
        setStatus("Location denied — using home");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [goHome]);

  const onIcaoSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const code = icaoInput.trim().toUpperCase();
      if (!code) return;
      setIcaoError(null);
      try {
        const res = await fetch(
          `/api/airport?code=${encodeURIComponent(code)}`,
        );
        if (res.status === 404) {
          setIcaoError("Not found");
          return;
        }
        if (!res.ok) {
          setIcaoError(`Error ${res.status}`);
          return;
        }
        const { lat, lon } = (await res.json()) as {
          lat: number;
          lon: number;
        };
        mapRef.current?.flyTo({
          center: [lon, lat],
          zoom: 11,
          essential: true,
        });
        setStatus(`Centered on ${code}`);
      } catch {
        setIcaoError("Lookup failed");
      }
    },
    [icaoInput],
  );

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [homeRef.current.lon, homeRef.current.lat],
      // Zoom 10 is a sensible local default; overlays scale with viewport radius.
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const overlaySvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    overlaySvg.setAttribute("aria-hidden", "true");
    overlaySvg.classList.add("radar-airspace-svg");
    // z-index 0 keeps overlays under MapLibre markers (targets/airports).
    overlaySvg.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible";
    map.getCanvasContainer().appendChild(overlaySvg);
    overlaySvgRef.current = overlaySvg;

    const scopeSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    scopeSvg.setAttribute("aria-hidden", "true");
    scopeSvg.classList.add("radar-scope-svg");
    // Scope chrome rides above markers (low opacity), hidden in Map mode.
    scopeSvg.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;overflow:visible;display:none";
    map.getCanvasContainer().appendChild(scopeSvg);
    scopeSvgRef.current = scopeSvg;

    map.addControl(
      new NavigationControl({ visualizePitch: false }),
      "top-right",
    );
    map.addControl(
      new ScaleControl({ maxWidth: 120, unit: "imperial" }),
      "bottom-left",
    );

    map.on("error", (e) => {
      console.error("maplibre error", e.error);
      setStatus(`Map error: ${e.error?.message ?? "unknown"}`);
    });

    const resize = () => {
      map.resize();
    };
    window.addEventListener("resize", resize);
    requestAnimationFrame(resize);

    map.on("load", () => {
      if (cancelled) return;
      map.resize();
      redrawOverlays();

      map.on("click", (e: MapMouseEvent) => {
        const target = e.originalEvent.target;
        if (
          target instanceof Element &&
          target.closest(".radar-ac, .radar-airport")
        ) {
          return;
        }
        selectedHexRef.current = null;
        setSelected(null);
        const entries = interestingEntriesRef.current;
        const mode = declutterRef.current;
        const tagPhase = tagPhaseRef.current;
        const identQ = identQueryRef.current;
        for (const entry of aircraftMarkersRef.current.values()) {
          updateAircraftEl(
            entry.marker.getElement(),
            entry.ac,
            false,
            mode,
            entries,
            tagPhase,
            aircraftMatchesIdent(entry.ac, identQ),
          );
        }
      });

      void (async () => {
        try {
          const homeRes = await fetch("/api/radar/home");
          if (homeRes.ok) {
            const home = (await homeRes.json()) as HomeResponse;
            homeRef.current = { lat: home.lat, lon: home.lon };
            map.setCenter([home.lon, home.lat]);
          }
        } catch {
          // keep defaults
        }

        try {
          const wlRes = await fetch("/api/radar/watchlist", {
            cache: "no-store",
          });
          if (wlRes.ok) {
            const data = (await wlRes.json()) as {
              entries?: WatchlistEntry[];
            };
            if (!cancelled && Array.isArray(data.entries)) {
              interestingEntriesRef.current = data.entries;
              setWatchlistEntries(data.entries);
              setWatchlistDraft(data.entries);
            }
          }
        } catch {
          // watchlist optional until Redis is up
        }

        if (cancelled) return;

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled || !mapRef.current) return;
              mapRef.current.flyTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: DEFAULT_MAP_ZOOM,
                essential: true,
              });
              setStatus("Centered on your location");
            },
            () => {
              setStatus("Using home location");
            },
            { enableHighAccuracy: true, timeout: 8_000 },
          );
        } else {
          setStatus("Using home location");
        }

        scheduleOverlays();
        void fetchAdsb();
        void loadRainViewer();
      })();
    });

    const onMoveEnd = () => {
      syncGroundMode();
      scheduleOverlays();
      void fetchAdsb();
    };
    map.on("moveend", onMoveEnd);
    map.on("move", redrawOverlays);
    map.on("resize", redrawOverlays);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      clearAircraftMarkers();
      clearAirportMarkers();
      map.off("moveend", onMoveEnd);
      map.off("move", redrawOverlays);
      map.off("resize", redrawOverlays);
      overlaySvg.remove();
      overlaySvgRef.current = null;
      scopeSvg.remove();
      scopeSvgRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchAdsb();
    }, ADSB_POLL_MS);
    return () => clearInterval(id);
  }, [fetchAdsb]);

  useEffect(() => {
    if (!focusedIcao) {
      // Both entry points (openAirportDetail/clearAirportFocus) already
      // clear airportTraffic when focus changes; this effect only owns the
      // poll interval lifecycle.
      return;
    }
    void fetchAirportTraffic();
    const id = setInterval(() => {
      void fetchAirportTraffic();
    }, ADSB_POLL_MS);
    return () => clearInterval(id);
  }, [focusedIcao, fetchAirportTraffic]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadRainViewer();
    }, RAIN_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadRainViewer]);

  useEffect(() => {
    applyRainFrame(frameIndex, weatherOpacity, weatherOn);
  }, [applyRainFrame, frameIndex, weatherOn, weatherOpacity]);

  // Scope mode: animated sweep on the chrome overlay + paint-on-scan traffic.
  useEffect(() => {
    if (displayMode !== "scope") {
      sweepDegRef.current = null;
      prevSweepDegRef.current = null;
      redrawScope();
      return;
    }
    let raf = 0;
    let lastPaint = 0;
    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    prevSweepDegRef.current = null;
    const tick = (now: number) => {
      const prev = prevSweepDegRef.current;
      const sweep = (((now - start) / SCOPE_SWEEP_MS) * 360) % 360;
      sweepDegRef.current = sweep;
      if (now - lastPaint >= SCOPE_FRAME_MS) {
        lastPaint = now;
        redrawScope();
        paintScopeAircraft(sweep, prev);
        prevSweepDegRef.current = sweep;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [displayMode, paintScopeAircraft, redrawScope]);

  const toggleTfrs = useCallback(
    (next: boolean) => {
      tfrsOnRef.current = next;
      setTfrsOn(next);
      if (!next) {
        tfrsRef.current = [];
        setTfrCount(0);
        redrawOverlays();
        return;
      }
      void fetchTfrs();
    },
    [fetchTfrs, redrawOverlays],
  );

  const applyWatchlistEntries = useCallback(
    (entries: WatchlistEntry[]) => {
      interestingEntriesRef.current = entries;
      setWatchlistEntries(entries);
      setWatchlistDraft(entries);
      refreshAircraftLabels();
    },
    [refreshAircraftLabels],
  );

  const openWatchlist = useCallback(() => {
    setDeclutterOpen(false);
    setWatchlistDraft(watchlistEntries);
    setWatchlistAdd("");
    setWatchlistError(null);
    setWatchlistOpen((open) => !open);
  }, [watchlistEntries]);

  const openDeclutter = useCallback(() => {
    setWatchlistOpen(false);
    setDeclutterOpen((open) => !open);
  }, []);

  const addWatchlistReg = useCallback(() => {
    const id = watchlistAdd.trim().toUpperCase().replace(/\s+/g, "");
    if (!id) return;
    if (!isValidWatchlistReg(id)) {
      setWatchlistError("Use 2–12 letters/digits (e.g. N730CF)");
      return;
    }
    setWatchlistError(null);
    setWatchlistDraft((prev) =>
      prev.some((e) => e.id === id) ? prev : [...prev, { id }],
    );
    setWatchlistAdd("");
  }, [watchlistAdd]);

  const removeWatchlistEntry = useCallback((id: string) => {
    setWatchlistDraft((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateWatchlistDraftEntry = useCallback(
    (
      id: string,
      patch: { note?: string | undefined; color?: WatchlistColor | undefined },
    ) => {
      setWatchlistDraft((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const next: WatchlistEntry = { id: entry.id };
          const note =
            "note" in patch
              ? normalizeWatchlistNote(patch.note)
              : entry.note;
          const color =
            "color" in patch
              ? patch.color === "default" || patch.color == null
                ? undefined
                : patch.color
              : entry.color;
          if (note) next.note = note;
          if (color) next.color = color;
          return next;
        }),
      );
    },
    [],
  );

  const saveWatchlist = useCallback(async () => {
    setWatchlistSaving(true);
    setWatchlistError(null);
    try {
      const res = await fetch("/api/radar/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: watchlistDraft }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setWatchlistError(err?.error ?? `Save failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { entries: WatchlistEntry[] };
      applyWatchlistEntries(data.entries);
      setWatchlistOpen(false);
    } catch {
      setWatchlistError("Save failed");
    } finally {
      setWatchlistSaving(false);
    }
  }, [applyWatchlistEntries, watchlistDraft]);

  const frameTime =
    rainFramesRef.current.frames[frameIndex]?.time != null
      ? new Date(
          rainFramesRef.current.frames[frameIndex].time * 1000,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";

  const scopeActive = displayMode === "scope";

  const selectedWatchlist = selected
    ? findWatchlistEntry(
        selected.registration,
        selected.callsign,
        watchlistEntries,
      )
    : undefined;

  return (
    <div
      className={`relative h-[100dvh] w-[100vw] overflow-hidden bg-slate-950 text-slate-100${
        scopeActive ? " radar-scope-active" : ""
      }${groundMode ? " radar-ground-active" : ""}`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        style={{ minHeight: "100dvh", minWidth: "100vw" }}
      />

      {scopeActive ? (
        <div
          className="radar-scope-vignette pointer-events-none absolute inset-0 z-[5]"
          aria-hidden="true"
        />
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <form
          onSubmit={onIcaoSubmit}
          className="pointer-events-auto flex items-center gap-1 rounded-lg bg-slate-900/85 p-1.5 shadow-lg backdrop-blur"
        >
          <input
            type="text"
            value={icaoInput}
            onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            aria-label="Airport ICAO code"
            className="w-20 rounded bg-slate-800 px-2 py-1.5 text-sm uppercase tracking-wider outline-none ring-emerald-500/40 focus:ring"
          />
          <button
            type="submit"
            className="rounded bg-emerald-600 px-2.5 py-1.5 text-sm font-medium hover:bg-emerald-500"
          >
            Go
          </button>
          {icaoError ? (
            <span className="px-1 text-xs text-rose-400">{icaoError}</span>
          ) : null}
        </form>

        <div className="pointer-events-auto flex gap-1 rounded-lg bg-slate-900/85 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={locateMe}
            className="rounded px-2.5 py-1.5 text-sm hover:bg-slate-800"
            title="Use my location"
          >
            Locate
          </button>
          <button
            type="button"
            onClick={() => goHome(true)}
            className="rounded px-2.5 py-1.5 text-sm hover:bg-slate-800"
            title="Home location"
          >
            Home
          </button>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg bg-slate-900/85 p-1.5 shadow-lg backdrop-blur">
          <label className="flex cursor-pointer items-center gap-1.5 px-1 text-sm">
            <input
              type="checkbox"
              checked={weatherOn}
              onChange={(e) => setWeatherOn(e.target.checked)}
              className="accent-sky-500"
            />
            Weather
          </label>
          {weatherOn ? (
            <>
              <label className="flex items-center gap-1 text-xs text-slate-300">
                Opacity
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={weatherOpacity}
                  onChange={(e) => setWeatherOpacity(Number(e.target.value))}
                  className="w-20"
                />
              </label>
              {frameCount > 1 ? (
                <label className="flex items-center gap-1 text-xs text-slate-300">
                  {frameTime}
                  <input
                    type="range"
                    min={0}
                    max={frameCount - 1}
                    step={1}
                    value={frameIndex}
                    onChange={(e) => setFrameIndex(Number(e.target.value))}
                    className="w-28"
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-900/85 p-1.5 shadow-lg backdrop-blur">
          <div
            className="flex overflow-hidden rounded ring-1 ring-slate-700"
            role="group"
            aria-label="Display mode"
          >
            {(["map", "scope"] as RadarDisplayMode[]).map((mode) => {
              const active = displayMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDisplayModeAndPersist(mode)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 text-sm capitalize ${
                    active
                      ? "bg-emerald-600 font-medium text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 px-1 text-sm">
            <input
              type="checkbox"
              checked={tfrsOn}
              onChange={(e) => toggleTfrs(e.target.checked)}
              className="accent-rose-500"
            />
            TFRs{tfrsOn && tfrCount > 0 ? ` (${tfrCount})` : ""}
          </label>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-slate-900/85 px-2 py-1 shadow-lg backdrop-blur">
          <label
            htmlFor="radar-ident"
            className="text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            Ident
          </label>
          <input
            ref={identInputRef}
            id="radar-ident"
            type="text"
            value={identQuery}
            onChange={(e) => setIdentQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setIdentQuery("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="squawk / callsign"
            spellCheck={false}
            autoComplete="off"
            className="w-36 rounded bg-slate-800 px-2 py-1 font-mono text-sm uppercase outline-none ring-cyan-500/40 focus:ring"
          />
          {normalizeIdentQuery(identQuery) ? (
            <button
              type="button"
              onClick={() => setIdentQuery("")}
              className="text-xs text-slate-400 hover:text-slate-200"
              aria-label="Clear Ident"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={openDeclutter}
            className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 text-sm shadow-lg backdrop-blur hover:bg-slate-800"
            title="Traffic declutter mode"
            aria-expanded={declutterOpen}
          >
            Declutter · {radarDeclutterShortLabel(declutter)}
          </button>
          {declutterOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg bg-slate-900/95 p-3 shadow-xl ring-1 ring-slate-700 backdrop-blur">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Unselected traffic
              </div>
              <div className="flex flex-col gap-1">
                {DECLUTTER_MODES.map((mode) => {
                  const active = declutter === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDeclutterMode(mode)}
                      className={`rounded px-2.5 py-1.5 text-left text-sm ${
                        active
                          ? "bg-emerald-600 font-medium text-white"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      }`}
                      aria-pressed={active}
                    >
                      {radarDeclutterShortLabel(mode)}
                      <span className="mt-0.5 block text-xs font-normal text-slate-300/80">
                        {mode === "target"
                          ? "Blip only"
                          : mode === "callsign"
                            ? "Blip + callsign"
                            : "Blip + dense tag"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-700 pt-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Ground targets
                </div>
                <button
                  type="button"
                  onClick={() => setShowGroundTargets(!showGroundTargets)}
                  className={`w-full rounded px-2.5 py-1.5 text-left text-sm ${
                    showGroundTargets
                      ? "bg-emerald-600 font-medium text-white"
                      : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                  aria-pressed={showGroundTargets}
                >
                  Ground targets
                  <span className="mt-0.5 block text-xs font-normal text-slate-300/80">
                    {showGroundTargets
                      ? "On-ground aircraft visible"
                      : "Hidden · shown in ground mode"}
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={openWatchlist}
            className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 text-sm shadow-lg backdrop-blur hover:bg-slate-800"
            title="Interesting aircraft watchlist"
          >
            Watchlist ({watchlistEntries.length})
          </button>
          {watchlistOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-96 rounded-lg bg-slate-900/95 p-3 shadow-xl ring-1 ring-slate-700 backdrop-blur">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Interesting tails
              </div>
              <form
                className="mb-2 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  addWatchlistReg();
                }}
              >
                <input
                  type="text"
                  value={watchlistAdd}
                  onChange={(e) =>
                    setWatchlistAdd(e.target.value.toUpperCase())
                  }
                  placeholder="N730CF"
                  maxLength={12}
                  aria-label="Add registration"
                  className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1.5 font-mono text-sm uppercase outline-none ring-sky-500/40 focus:ring"
                />
                <button
                  type="submit"
                  className="rounded bg-sky-600 px-2.5 py-1.5 text-sm font-medium hover:bg-sky-500"
                >
                  Add
                </button>
              </form>
              <ul className="mb-2 max-h-64 space-y-2 overflow-y-auto text-sm">
                {watchlistDraft.length === 0 ? (
                  <li className="text-xs text-slate-500">No tails yet</li>
                ) : (
                  watchlistDraft.map((entry) => {
                    const activeColor = entry.color ?? "default";
                    return (
                      <li
                        key={entry.id}
                        className="space-y-1.5 rounded bg-slate-800/80 px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm">{entry.id}</span>
                          <button
                            type="button"
                            onClick={() => removeWatchlistEntry(entry.id)}
                            className="text-xs text-rose-400 hover:text-rose-300"
                            aria-label={`Remove ${entry.id}`}
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={entry.note ?? ""}
                          maxLength={12}
                          placeholder="Note"
                          aria-label={`Note for ${entry.id}`}
                          onChange={(e) =>
                            updateWatchlistDraftEntry(entry.id, {
                              note: e.target.value,
                            })
                          }
                          className="w-full rounded bg-slate-900 px-2 py-1 font-mono text-xs uppercase outline-none ring-sky-500/30 focus:ring"
                        />
                        <div
                          className="flex items-center gap-1.5"
                          role="group"
                          aria-label={`Color for ${entry.id}`}
                        >
                          {WATCHLIST_COLORS.map((color) => {
                            const selectedChip = activeColor === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                title={color}
                                aria-label={`${color} color`}
                                aria-pressed={selectedChip}
                                onClick={() =>
                                  updateWatchlistDraftEntry(entry.id, {
                                    color,
                                  })
                                }
                                className={`h-4 w-4 rounded-sm ${
                                  selectedChip
                                    ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900"
                                    : "ring-1 ring-slate-600"
                                }`}
                                style={{
                                  backgroundColor: watchlistColorHex(color),
                                }}
                              />
                            );
                          })}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              {watchlistError ? (
                <p className="mb-2 text-xs text-rose-400">{watchlistError}</p>
              ) : null}
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setWatchlistDraft(watchlistEntries);
                    setWatchlistOpen(false);
                    setWatchlistError(null);
                  }}
                  className="rounded px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveWatchlist()}
                  disabled={watchlistSaving}
                  className="rounded bg-emerald-600 px-2.5 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
                >
                  {watchlistSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <aside className="pointer-events-none absolute top-0 left-0 z-10 max-h-[min(70dvh,32rem)] overflow-y-auto p-3 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] pl-[max(0.75rem,env(safe-area-inset-left))]">
        <CommsPanel
          focusedIcao={focusedIcao}
          radio={atcRadio}
          presets={commsPresets}
        />
      </aside>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(3.5rem,env(safe-area-inset-right))]">
        {airportLoading && !airportDetail ? (
          <div className="pointer-events-auto max-w-sm rounded-lg bg-[#0B0F14]/90 px-3 py-2 text-sm shadow-lg ring-1 ring-[#C8D0D8]/30 backdrop-blur">
            <div className="text-xs text-[#6B7280]">Loading airport…</div>
          </div>
        ) : null}
        {airportError ? (
          <div className="pointer-events-auto max-w-sm rounded-lg bg-[#0B0F14]/90 px-3 py-2 text-sm shadow-lg ring-1 ring-[#C8D0D8]/30 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-rose-400">{airportError}</span>
              <button
                type="button"
                onClick={clearAirportFocus}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
        {airportDetail ? (
          <SelectionAirportCard
            detail={airportDetail}
            groundMode={groundMode}
            onClose={clearAirportFocus}
            onEnterGround={enterGroundView}
            onExitGround={exitGroundView}
            traffic={airportTraffic}
            onSelectTrafficHex={selectAirportTrafficHex}
            radio={atcRadio}
            addSession={commsPresets.addSession}
            setExpanded={commsPresets.setExpanded}
          />
        ) : null}

        {selected ? (
          <SelectionAircraftCard
            selected={selected}
            watchlistNote={selectedWatchlist?.note}
            watchlistNoteColor={
              selectedWatchlist
                ? watchlistColorHex(selectedWatchlist.color)
                : undefined
            }
          />
        ) : null}

        <div className="pointer-events-auto flex flex-wrap items-center gap-2 self-start rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur">
          <span>{status}</span>
          <span className="text-slate-500">·</span>
          <span>{aircraftCount} ac</span>
          <span className="text-slate-500">·</span>
          <span>{adsbActive ? "ADS-B live" : "Zoom in for traffic"}</span>
          <span className="text-slate-500">·</span>
          <span>
            {overlaysActive ? "Overlays on" : "Zoom in for overlays"}
          </span>
          <span className="text-slate-500">·</span>
          <span>{scopeActive ? "Scope" : "Map"}</span>
          {groundMode && focusedIcao ? (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">Ground {focusedIcao}</span>
            </>
          ) : null}
          {weatherOn ? (
            <>
              <span className="text-slate-500">·</span>
              <span>
                Radar via{" "}
                <a
                  href="https://www.rainviewer.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto text-sky-400 underline"
                >
                  RainViewer
                </a>
              </span>
            </>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
