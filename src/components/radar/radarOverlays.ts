/** SVG overlay painters for web radar (highways, airspace, TFRs, runways, scope). */

import type { Map as MapLibreMap } from "maplibre-gl";

import { COLORS } from "./radarFormat";
import { SCOPE_TRAIL_ARC_DEG, SCOPE_TRAIL_SLICES } from "./radarScope";
import type {
  AirspaceRing,
  AirportRunway,
  HighwayPolyline,
  TfrPolygon,
} from "./types";

function projectPoints(
  map: MapLibreMap,
  points: [number, number][],
): string {
  return points
    .map(([lat, lon]) => {
      const p = map.project([lon, lat]);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

function ringStrokeColor(airspaceClass: AirspaceRing["class"]): string {
  if (airspaceClass === "C") return COLORS.airspaceC;
  return COLORS.airspaceB;
}

export function sizeSvgToMap(map: MapLibreMap, svg: SVGSVGElement) {
  const size = map.getCanvas().getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  svg.setAttribute("width", String(size.width));
  svg.setAttribute("height", String(size.height));
  return size;
}

export function paintMapOverlays(
  map: MapLibreMap,
  svg: SVGSVGElement,
  opts: {
    highways: HighwayPolyline[];
    rings: AirspaceRing[];
    tfrs: TfrPolygon[];
    runways: AirportRunway[];
    showHighways: boolean;
    showAirspace: boolean;
    showTfrs: boolean;
    showRunways: boolean;
  },
) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
  sizeSvgToMap(map, svg);

  if (opts.showHighways) {
    for (const hwy of opts.highways) {
      if (hwy.points.length < 2) continue;
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline",
      );
      line.setAttribute("points", projectPoints(map, hwy.points));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", COLORS.highway);
      line.setAttribute("stroke-width", "1.25");
      line.setAttribute("stroke-opacity", "0.9");
      svg.appendChild(line);
    }
  }

  if (opts.showAirspace) {
    for (const ring of opts.rings) {
      if (ring.points.length < 3) continue;
      const poly = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      const color = ringStrokeColor(ring.class);
      poly.setAttribute("points", projectPoints(map, ring.points));
      poly.setAttribute("fill", color);
      poly.setAttribute("fill-opacity", "0.07");
      poly.setAttribute("stroke", color);
      poly.setAttribute("stroke-width", ring.class === "D" ? "1.5" : "2");
      poly.setAttribute("stroke-opacity", "0.45");
      if (ring.class === "D") {
        poly.setAttribute("stroke-dasharray", "5 4");
      }
      svg.appendChild(poly);
    }
  }

  if (opts.showTfrs) {
    for (const tfr of opts.tfrs) {
      if (tfr.points.length < 3) continue;
      const poly = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      poly.setAttribute("points", projectPoints(map, tfr.points));
      poly.setAttribute("fill", COLORS.tfr);
      poly.setAttribute("fill-opacity", "0.12");
      poly.setAttribute("stroke", COLORS.tfr);
      poly.setAttribute("stroke-width", "1.5");
      poly.setAttribute("stroke-opacity", "0.7");
      poly.setAttribute("stroke-dasharray", "4 3");
      svg.appendChild(poly);
    }
  }

  if (opts.showRunways) {
    for (const rwy of opts.runways) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      const a = map.project([rwy.leLon, rwy.leLat]);
      const b = map.project([rwy.heLon, rwy.heLat]);
      line.setAttribute("x1", String(a.x));
      line.setAttribute("y1", String(a.y));
      line.setAttribute("x2", String(b.x));
      line.setAttribute("y2", String(b.y));
      line.setAttribute("stroke", COLORS.runway);
      line.setAttribute("stroke-width", "3");
      line.setAttribute("stroke-opacity", "0.85");
      line.setAttribute("stroke-linecap", "square");
      svg.appendChild(line);
    }
  }
}

/** Concentric range rings + crosshair for Scope mode (miles from map center). */
export function paintScopeChrome(
  map: MapLibreMap,
  svg: SVGSVGElement,
  opts: {
    centerLat: number;
    centerLon: number;
    radiusMi: number;
    sweepDeg: number | null;
  },
) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
  const size = sizeSvgToMap(map, svg);
  const cx = size.width / 2;
  const cy = size.height / 2;

  // Approximate px-per-mile from north-edge projection
  const north = map.project([
    opts.centerLon,
    opts.centerLat + opts.radiusMi / 69,
  ]);
  const pxPerMi = Math.max(4, Math.abs(cy - north.y) / Math.max(opts.radiusMi, 1));
  const maxR = Math.min(cx, cy) * 0.98;

  const rings = [0.25, 0.5, 0.75, 1].map((f) => f * opts.radiusMi);
  for (const mi of rings) {
    const r = Math.min(maxR, mi * pxPerMi);
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(r));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", COLORS.scopeRing);
    circle.setAttribute("stroke-width", "1");
    circle.setAttribute("stroke-opacity", "0.55");
    svg.appendChild(circle);
  }

  // Crosshair
  for (const [x1, y1, x2, y2] of [
    [cx, cy - maxR, cx, cy + maxR],
    [cx - maxR, cy, cx + maxR, cy],
  ] as const) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", COLORS.scopeRing);
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", "0.35");
    svg.appendChild(line);
  }

  // N label
  const n = document.createElementNS("http://www.w3.org/2000/svg", "text");
  n.setAttribute("x", String(cx));
  n.setAttribute("y", String(cy - maxR + 14));
  n.setAttribute("text-anchor", "middle");
  n.setAttribute("fill", COLORS.aircraft);
  n.setAttribute("fill-opacity", "0.55");
  n.setAttribute("font-size", "11");
  n.setAttribute("font-family", "ui-monospace, monospace");
  n.textContent = "N";
  svg.appendChild(n);

  if (opts.sweepDeg != null) {
    const rad = ((opts.sweepDeg - 90) * Math.PI) / 180;
    const trailRad = (SCOPE_TRAIL_ARC_DEG * Math.PI) / 180;

    // Phosphor trail only behind the beam (already-scanned arc), matching
    // firmware LVGL rays: ang = sweep - trail * (1 - frac).
    for (let i = 1; i <= SCOPE_TRAIL_SLICES; i++) {
      const frac0 = (i - 1) / SCOPE_TRAIL_SLICES;
      const frac1 = i / SCOPE_TRAIL_SLICES;
      const a0 = rad - trailRad * (1 - frac0);
      const a1 = rad - trailRad * (1 - frac1);
      const x0 = cx + maxR * Math.cos(a0);
      const y0 = cy + maxR * Math.sin(a0);
      const x1 = cx + maxR * Math.cos(a1);
      const y1 = cy + maxR * Math.sin(a1);
      const slice = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      slice.setAttribute(
        "d",
        `M ${cx} ${cy} L ${x0} ${y0} A ${maxR} ${maxR} 0 0 1 ${x1} ${y1} Z`,
      );
      slice.setAttribute("fill", COLORS.aircraft);
      // Brightest nearest the beam (frac1 → 1).
      slice.setAttribute(
        "fill-opacity",
        String(0.015 + 0.09 * frac1 * frac1),
      );
      svg.appendChild(slice);
    }

    const beam = document.createElementNS("http://www.w3.org/2000/svg", "line");
    beam.setAttribute("x1", String(cx));
    beam.setAttribute("y1", String(cy));
    beam.setAttribute("x2", String(cx + maxR * Math.cos(rad)));
    beam.setAttribute("y2", String(cy + maxR * Math.sin(rad)));
    beam.setAttribute("stroke", COLORS.aircraft);
    beam.setAttribute("stroke-width", "1.5");
    beam.setAttribute("stroke-opacity", "0.45");
    svg.appendChild(beam);
  }
}
