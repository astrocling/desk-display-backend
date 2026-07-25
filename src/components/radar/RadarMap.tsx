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
  COLORS,
  RADAR_VECTOR_MAX_RANGE_MI,
  classifyNotable,
  formatRadarTagLine2,
  formatRadarTagLine3,
  markColorFor,
  vectorLengthPx,
  type AircraftNotable,
} from "./radarFormat";
import type {
  AirspaceRing,
  AircraftFeatureProps,
  HomeResponse,
  MapContextResponse,
  RainViewerMaps,
  ToweredAirport,
} from "./types";

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
      id: "carto-dark",
      type: "raster" as const,
      source: "carto",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

const ADSB_POLL_MS = 10_000;
const OVERLAY_DEBOUNCE_MS = 400;
const RAIN_REFRESH_MS = 5 * 60_000;

const SOURCE_RAIN = "radar-rain";
const LAYER_RAIN = "radar-rain-layer";

type AircraftPoint = AircraftFeatureProps & { lat: number; lon: number };

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
    out.push({
      hex,
      callsign: labelForAircraft(item) || "?",
      type: typeof item.t === "string" ? item.t : "",
      registration: typeof item.r === "string" ? item.r : "",
      squawk: parseSquawk(item.squawk),
      emergency: typeof item.emergency === "string" ? item.emergency : "",
      dbFlags,
      altFt: numOrNull(item.alt_baro) ?? numOrNull(item.alt_geom),
      speedKt: numOrNull(item.gs),
      trackDeg: numOrNull(item.track) ?? numOrNull(item.calc_track),
      baroRateFpm: numOrNull(item.baro_rate) ?? numOrNull(item.geom_rate),
      lat,
      lon,
    });
  }
  return out;
}

function notableFor(ac: AircraftPoint): AircraftNotable {
  return classifyNotable({
    squawk: ac.squawk,
    emergency: ac.emergency,
    dbFlags: ac.dbFlags,
  });
}

function updateAircraftEl(
  root: HTMLElement,
  ac: AircraftPoint,
  selected: boolean,
  showTags: boolean,
) {
  const notable = notableFor(ac);
  const color = markColorFor(notable, selected);
  // Selected always gets ATC-lite tag even when zoomed out to dots.
  const tagged = showTags || selected;
  root.classList.toggle("is-selected", selected);
  root.classList.toggle("is-dense", !tagged);
  root.dataset.hex = ac.hex;
  root.title = ac.callsign;
  root.setAttribute("aria-label", ac.callsign);

  const mark = root.querySelector(".radar-ac-mark") as HTMLElement | null;
  if (mark) {
    mark.style.color = color;
    if (!tagged) {
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
    if (ac.trackDeg != null && tagged) {
      vector.style.display = "block";
      vector.style.transform = `rotate(${ac.trackDeg - 90}deg)`;
    } else {
      vector.style.display = "none";
    }
  }

  const tag = root.querySelector(".radar-ac-tag") as HTMLElement | null;
  if (tag) {
    if (!tagged) {
      tag.style.display = "none";
    } else {
      tag.style.display = "block";
      tag.style.opacity = selected ? "1" : showTags ? "0.75" : "1";
      const line1 = tag.querySelector(".radar-ac-line1") as HTMLElement | null;
      const line2 = tag.querySelector(".radar-ac-line2") as HTMLElement | null;
      const line3 = tag.querySelector(".radar-ac-line3") as HTMLElement | null;
      if (line1) {
        line1.textContent = ac.callsign;
        line1.style.color = color;
      }
      if (line2) {
        line2.textContent = formatRadarTagLine2({
          altFt: ac.altFt,
          speedKt: ac.speedKt,
          baroRateFpm: ac.baroRateFpm,
          style: selected ? "full" : "dense",
        });
        line2.style.color = COLORS.accent;
      }
      if (line3) {
        if (selected) {
          const text = formatRadarTagLine3({
            type: ac.type,
            squawk: ac.squawk,
            notable,
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
  updateAircraftEl(el, ac, false, true);
  return el;
}

function makeAirportEl(airport: ToweredAirport): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "radar-airport";
  el.title = `${airport.icao} — ${airport.name}`;
  el.innerHTML = `
    <span class="radar-airport-plus" aria-hidden="true">+</span>
    <span class="radar-airport-label">${airport.icao}</span>
  `;
  return el;
}

function ringStrokeColor(airspaceClass: AirspaceRing["class"]): string {
  if (airspaceClass === "C") return COLORS.airspaceC;
  return COLORS.airspaceB; // B and D share blue on the device palette
}

/** Project airspace rings into an SVG overlay (avoids MapLibre GeoJSON tile quirks). */
function paintRingSvg(
  map: MapLibreMap,
  svg: SVGSVGElement,
  rings: AirspaceRing[],
) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  const size = map.getCanvas().getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  svg.setAttribute("width", String(size.width));
  svg.setAttribute("height", String(size.height));

  for (const ring of rings) {
    if (ring.points.length < 3) continue;
    const poly = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    const pts = ring.points
      .map(([lat, lon]) => {
        const p = map.project([lon, lat]);
        return `${p.x},${p.y}`;
      })
      .join(" ");
    const color = ringStrokeColor(ring.class);
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", color);
    poly.setAttribute("fill-opacity", "0.22");
    poly.setAttribute("stroke", color);
    poly.setAttribute("stroke-width", ring.class === "D" ? "2" : "2.5");
    poly.setAttribute("stroke-opacity", "1");
    if (ring.class === "D") {
      poly.setAttribute("stroke-dasharray", "5 4");
    }
    svg.appendChild(poly);
  }
}

export function RadarMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ringSvgRef = useRef<SVGSVGElement | null>(null);
  const ringsRef = useRef<AirspaceRing[]>([]);
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
  const selectAircraftRef = useRef<(ac: AircraftPoint) => void>(() => {});

  const selectedHexRef = useRef<string | null>(null);
  const showTagsRef = useRef(true);

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

  selectAircraftRef.current = (ac: AircraftPoint) => {
    selectedHexRef.current = ac.hex;
    setSelected({
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
    });
    for (const [hex, entry] of aircraftMarkersRef.current) {
      updateAircraftEl(
        entry.marker.getElement(),
        entry.ac,
        hex === ac.hex,
        showTagsRef.current,
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

  const syncAircraftMarkers = useCallback(
    (map: MapLibreMap, aircraft: AircraftPoint[], showTags: boolean) => {
      showTagsRef.current = showTags;
      const selectedHex = selectedHexRef.current;
      const seen = new Set<string>();
      for (const ac of aircraft) {
        seen.add(ac.hex);
        const existing = aircraftMarkersRef.current.get(ac.hex);
        if (existing) {
          existing.ac = ac;
          existing.marker.setLngLat([ac.lon, ac.lat]);
          // Rebind click to latest aircraft snapshot
          const el = existing.marker.getElement();
          el.onclick = (e) => {
            e.stopPropagation();
            selectAircraftRef.current(ac);
          };
          updateAircraftEl(el, ac, ac.hex === selectedHex, showTags);
        } else {
          const el = makeAircraftEl(ac, (picked) =>
            selectAircraftRef.current(picked),
          );
          updateAircraftEl(el, ac, ac.hex === selectedHex, showTags);
          const marker = new Marker({ element: el, anchor: "center" })
            .setLngLat([ac.lon, ac.lat])
            .addTo(map);
          aircraftMarkersRef.current.set(ac.hex, { marker, ac });
        }
      }
      for (const [hex, entry] of aircraftMarkersRef.current) {
        if (!seen.has(hex)) {
          entry.marker.remove();
          aircraftMarkersRef.current.delete(hex);
          if (selectedHexRef.current === hex) {
            selectedHexRef.current = null;
            setSelected(null);
          }
        }
      }
    },
    [],
  );

  const syncAirportMarkers = useCallback(
    (map: MapLibreMap, airports: ToweredAirport[]) => {
      const seen = new Set<string>();
      for (const airport of airports) {
        seen.add(airport.icao);
        const existing = airportMarkersRef.current.get(airport.icao);
        if (existing) {
          existing.setLngLat([airport.lon, airport.lat]);
        } else {
          const marker = new Marker({
            element: makeAirportEl(airport),
            anchor: "center",
          })
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

  const fetchAdsb = useCallback(async () => {
    const map = mapRef.current;
    const vp = readViewport();
    if (!map || !vp) return;

    if (vp.radiusNm > ADSB_VIEWPORT_MAX_NM) {
      setAdsbActive(false);
      clearAircraftMarkers();
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
      // Tags when local: zoomed in OR PPI-equivalent range ≤25 mi (device vector band).
      const showTags =
        vp.zoom >= 8.5 || vp.rangeMi <= RADAR_VECTOR_MAX_RANGE_MI;
      setAdsbActive(true);
      syncAircraftMarkers(map, aircraft, showTags);
      setAircraftCount(aircraft.length);
      const bits = [`${aircraft.length} aircraft`];
      if (overlaysActive) bits.push("overlays on");
      bits.push(showTags ? "tags" : "dots — zoom in");
      setStatus(bits.join(" · "));
    } catch {
      setAdsbActive(false);
      setStatus("ADS-B fetch failed");
    }
  }, [
    clearAircraftMarkers,
    overlaysActive,
    readViewport,
    syncAircraftMarkers,
  ]);

  const redrawRings = useCallback(() => {
    const map = mapRef.current;
    const svg = ringSvgRef.current;
    if (!map || !svg) return;
    paintRingSvg(map, svg, ringsRef.current);
  }, []);

  const fetchOverlays = useCallback(async () => {
    const map = mapRef.current;
    const vp = readViewport();
    if (!map || !vp) return;

    // Always request up to the API max around center. Large monitors often have a
    // viewport radius > 50 mi at normal local zooms; blanking overlays there hid
    // airspace rings even though airports/rings data was available.
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
      syncAirportMarkers(map, ctx.airports ?? []);
      ringsRef.current = ctx.rings ?? [];
      redrawRings();
    } catch {
      // keep last-good overlays
    }
  }, [readViewport, redrawRings, syncAirportMarkers]);

  const scheduleOverlays = useCallback(() => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = setTimeout(() => {
      void fetchOverlays();
    }, OVERLAY_DEBOUNCE_MS);
  }, [fetchOverlays]);

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
      map.flyTo({ center: [lon, lat], zoom: 10, essential: true });
    } else {
      map.setCenter([lon, lat]);
      map.setZoom(10);
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
          zoom: 10,
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
      // Zoom 10 keeps viewport radius ≤50 mi so airspace overlays load immediately.
      zoom: 10,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const ringSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ringSvg.setAttribute("aria-hidden", "true");
    ringSvg.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible";
    map.getCanvasContainer().appendChild(ringSvg);
    ringSvgRef.current = ringSvg;

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
      redrawRings();

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
        for (const entry of aircraftMarkersRef.current.values()) {
          updateAircraftEl(
            entry.marker.getElement(),
            entry.ac,
            false,
            showTagsRef.current,
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

        if (cancelled) return;

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled || !mapRef.current) return;
              mapRef.current.flyTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: 10,
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
      scheduleOverlays();
      void fetchAdsb();
    };
    map.on("moveend", onMoveEnd);
    map.on("move", redrawRings);
    map.on("resize", redrawRings);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      clearAircraftMarkers();
      clearAirportMarkers();
      map.off("moveend", onMoveEnd);
      map.off("move", redrawRings);
      map.off("resize", redrawRings);
      ringSvg.remove();
      ringSvgRef.current = null;
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
    const id = setInterval(() => {
      void loadRainViewer();
    }, RAIN_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadRainViewer]);

  useEffect(() => {
    applyRainFrame(frameIndex, weatherOpacity, weatherOn);
  }, [applyRainFrame, frameIndex, weatherOn, weatherOpacity]);

  const frameTime =
    rainFramesRef.current.frames[frameIndex]?.time != null
      ? new Date(
          rainFramesRef.current.frames[frameIndex].time * 1000,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";

  return (
    <div className="relative h-[100dvh] w-[100vw] overflow-hidden bg-slate-950 text-slate-100">
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        style={{ minHeight: "100dvh", minWidth: "100vw" }}
      />

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
      </header>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(3.5rem,env(safe-area-inset-right))]">
        {selected ? (
          <div className="pointer-events-auto max-w-sm rounded-lg bg-[#0B0F14]/90 px-3 py-2 text-sm shadow-lg backdrop-blur ring-1 ring-[#3D9CF0]/40">
            <div className="font-semibold tracking-wide text-white">
              {selected.callsign}
            </div>
            <div className="mt-0.5 font-mono text-xs text-[#3D9CF0]">
              {formatRadarTagLine2({
                altFt: selected.altFt,
                speedKt: selected.speedKt,
                baroRateFpm: selected.baroRateFpm,
                style: "full",
              })}
            </div>
            <div className="mt-0.5 font-mono text-xs text-[#3D9CF0]">
              {formatRadarTagLine3({
                type: selected.type,
                squawk: selected.squawk,
                notable: classifyNotable({
                  squawk: selected.squawk,
                  emergency: selected.emergency,
                  dbFlags: selected.dbFlags,
                }),
              })}
            </div>
            {selected.registration ? (
              <div className="mt-1 text-[11px] text-[#6B7280]">
                {selected.registration}
              </div>
            ) : null}
          </div>
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
