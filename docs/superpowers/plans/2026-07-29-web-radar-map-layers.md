# Web Radar Map Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Layers dropdown (airports presets + pins, Class B/C/D, ARTCC, APP/DEP, TFRs, highways) while keeping Weather as a separate header control, backed by an extended map-context bake.

**Architecture:** Extend the existing `data/map` + `/api/map/context` pipeline with a richer airport catalog, designator index, and facility-boundary polygons. Client owns Layers visibility + airport preset in React state; pins persist in `localStorage`. SVG painters gain ARTCC/APP/DEP; airport markers honor preset + pins.

**Tech Stack:** Next.js / TypeScript, MapLibre GL, Vitest, OurAirports CSVs, fixture GeoJSON for facility boundaries (same pattern as Class B/C/D).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-web-radar-map-layers-design.md`
- Web `/radar` only — no desk-display / firmware changes
- Weather stays a separate header control (on/off, opacity, frame scrubber) — not inside Layers
- First-visit defaults: Towered only, Class B/C/D on, TFRs on, highways on, Weather off, ARTCC off, APP/DEP off, pins empty
- Persist **only** pinned designators in `localStorage` key `radar.pinnedAirports` (JSON string array of uppercase codes)
- Do **not** persist full Layers visibility
- SIDs/STARs, navaids, airways are out of scope
- Facility polygons: fixture GeoJSON ingest + committed JSON (like Class B/C/D); no live GIS per request
- Ground mode hides highways, Class B/C/D, ARTCC, APP/DEP; airports follow preset + pins; leaving ground mode restores Layers toggle state
- Paved runway threshold for **Public + paved** preset: `>= 3000` ft
- `publicUse` heuristic: OurAirports `type` in `large_airport` | `medium_airport` | `small_airport` | `heliport` (exclude `closed`)
- Pin validation against full catalog index; map display still viewport-filtered

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/radar/airportLayers.ts` | Preset filters, pin normalize/storage helpers, soft-cap |
| `src/components/radar/airportLayers.test.ts` | Unit tests for presets + pins |
| `src/components/radar/types.ts` | `MapAirport`, `FacilityBoundary`, extended `MapContextResponse` |
| `src/lib/fetchers/map_context.ts` | Build/load/filter richer airports + facility boundaries + designator index |
| `src/lib/fetchers/map_context.test.ts` | Extend/add filter + build tests |
| `scripts/build-map-context-data.ts` | Write new JSON blobs |
| `data/map/airports-catalog.json` | Baked richer airports (generated) |
| `data/map/airport-designators.json` | Designator → catalog key index (generated) |
| `data/map/artcc-boundaries.json` | ARTCC polygons (generated) |
| `data/map/app-dep-boundaries.json` | APP/DEP polygons (generated) |
| `data/map/fixtures/artcc.geojson` | Sample ARTCC for Dayton-area / ZID |
| `data/map/fixtures/app-dep.geojson` | Sample APP/DEP for Dayton/IND-ish area |
| `data/map/fixtures/runways.csv` | Extend fixture if needed for paved lengths |
| `src/app/api/map/context/route.ts` | Pass-through of new fields |
| `src/app/api/map/airport-lookup/route.ts` | GET `?q=` designator lookup against index |
| `src/components/radar/radarOverlays.ts` | Paint ARTCC + APP/DEP |
| `src/components/radar/radarOverlays.test.ts` | Visibility flag tests if present / extend |
| `src/components/radar/radarFormat.ts` | Colors for facility boundaries |
| `src/components/radar/RadarMap.tsx` | Layers panel UI, state, wire markers/overlays |
| `src/components/radar/LayersPanel.tsx` | Layers dropdown UI component |

---

### Task 1: Airport preset + pin helpers (pure)

**Files:**
- Create: `src/components/radar/airportLayers.ts`
- Create: `src/components/radar/airportLayers.test.ts`

**Interfaces:**
- Produces:
  - `export type AirportPreset = "towered" | "public" | "public_paved" | "all"`
  - `export const PAVED_MIN_FT = 3000`
  - `export const PINNED_STORAGE_KEY = "radar.pinnedAirports"`
  - `export const AIRPORT_MARKER_SOFT_CAP = 400`
  - `export type MapAirportLike = { icao: string; ident?: string; towered: boolean; publicUse: boolean; pavedRunwayFt: number | null }`
  - `export function matchesAirportPreset(airport: MapAirportLike, preset: AirportPreset): boolean`
  - `export function filterAirportsForDisplay(airports: MapAirportLike[], preset: AirportPreset, pinned: Set<string>): MapAirportLike[]` — include if preset matches OR any of `icao`/`ident` (uppercased) is in `pinned`
  - `export function softCapAirports<T>(airports: T[], cap?: number): { airports: T[]; capped: boolean }`
  - `export function normalizeDesignator(raw: string): string` — trim + uppercase
  - `export function readPinnedDesignators(storage?: Pick<Storage, "getItem">): string[]` — corrupt → `[]`
  - `export function writePinnedDesignators(pins: string[], storage?: Pick<Storage, "setItem">): void`
  - `export function addPinnedDesignator(pins: string[], raw: string): string[]` — normalize, dedupe, no-op if empty

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  addPinnedDesignator,
  filterAirportsForDisplay,
  matchesAirportPreset,
  normalizeDesignator,
  readPinnedDesignators,
  softCapAirports,
  writePinnedDesignators,
} from "./airportLayers";

const towered = {
  icao: "KDAY",
  ident: "KDAY",
  towered: true,
  publicUse: true,
  pavedRunwayFt: 10900,
};
const publicPaved = {
  icao: "I69",
  ident: "I69",
  towered: false,
  publicUse: true,
  pavedRunwayFt: 3500,
};
const publicShort = {
  icao: "MGY",
  ident: "MGY",
  towered: false,
  publicUse: true,
  pavedRunwayFt: 2500,
};
const privateStrip = {
  icao: "0OH7",
  ident: "0OH7",
  towered: false,
  publicUse: false,
  pavedRunwayFt: 2000,
};

describe("matchesAirportPreset", () => {
  it("towered only", () => {
    expect(matchesAirportPreset(towered, "towered")).toBe(true);
    expect(matchesAirportPreset(publicPaved, "towered")).toBe(false);
  });
  it("public use", () => {
    expect(matchesAirportPreset(publicShort, "public")).toBe(true);
    expect(matchesAirportPreset(privateStrip, "public")).toBe(false);
  });
  it("public + paved >= 3000", () => {
    expect(matchesAirportPreset(publicPaved, "public_paved")).toBe(true);
    expect(matchesAirportPreset(publicShort, "public_paved")).toBe(false);
  });
  it("all includes private", () => {
    expect(matchesAirportPreset(privateStrip, "all")).toBe(true);
  });
});

describe("filterAirportsForDisplay", () => {
  it("includes pinned under towered preset", () => {
    const out = filterAirportsForDisplay(
      [towered, publicPaved],
      "towered",
      new Set(["I69"]),
    );
    expect(out.map((a) => a.icao).sort()).toEqual(["I69", "KDAY"]);
  });
});

describe("pins storage", () => {
  it("normalizes and dedupes", () => {
    expect(normalizeDesignator(" i69 ")).toBe("I69");
    expect(addPinnedDesignator(["I69"], "i69")).toEqual(["I69"]);
    expect(addPinnedDesignator([], "i69")).toEqual(["I69"]);
  });
  it("corrupt localStorage yields empty", () => {
    const storage = {
      getItem: () => "{not-json",
      setItem: () => {},
    };
    expect(readPinnedDesignators(storage)).toEqual([]);
  });
  it("round-trips", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    writePinnedDesignators(["KDAY", "I69"], storage);
    expect(readPinnedDesignators(storage)).toEqual(["KDAY", "I69"]);
  });
});

describe("softCapAirports", () => {
  it("flags when capped", () => {
    const list = Array.from({ length: 5 }, (_, i) => i);
    const { airports, capped } = softCapAirports(list, 3);
    expect(airports).toHaveLength(3);
    expect(capped).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/components/radar/airportLayers.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `airportLayers.ts`**

Implement the interfaces above. `matchesAirportPreset`:
- `towered` → `airport.towered`
- `public` → `airport.publicUse`
- `public_paved` → `airport.publicUse && (airport.pavedRunwayFt ?? 0) >= PAVED_MIN_FT`
- `all` → `true`

`filterAirportsForDisplay`: keep airport if `matchesAirportPreset` OR pinned has `icao` or `ident` (normalized).

`readPinnedDesignators`: parse JSON array of strings; filter non-strings; normalize; dedupe.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/components/radar/airportLayers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/airportLayers.ts src/components/radar/airportLayers.test.ts
git commit -m "feat(radar): airport preset filters and pin storage helpers"
```

---

### Task 2: Types + map_context catalog builders

**Files:**
- Modify: `src/components/radar/types.ts`
- Modify: `src/lib/fetchers/map_context.ts`
- Create or modify: `src/lib/fetchers/map_context.test.ts` (follow existing test location patterns under `src/lib/fetchers/`)

**Interfaces:**
- Produces in `types.ts` / mirrored in `map_context.ts` as needed for server:
  - `MapAirport`: `{ icao: string; ident: string; name: string; lat: number; lon: number; towered: boolean; publicUse: boolean; pavedRunwayFt: number | null; primaryRunwayHeadingDeg?: number | null }`
  - `FacilityBoundary`: `{ id: string; name: string; kind: "artcc" | "app_dep"; points: [number, number][] }`
  - `MapContextResponse`: `{ airports: MapAirport[]; rings: AirspaceRing[]; highways: HighwayPolyline[]; artcc: FacilityBoundary[]; appDep: FacilityBoundary[] }`
  - Keep `ToweredAirport` as a type alias or deprecated subset: prefer updating call sites to `MapAirport`
- Produces builders:
  - `buildAirportCatalogFromCsv(airportsCsv, frequenciesCsv, runwaysByAirportRef: Map or from runways csv text): MapAirport[]`
  - `buildDesignatorIndex(airports: MapAirport[]): Record<string, string>` — keys: uppercase ident, icao, and local_code if available during build; value: primary `ident`
  - `buildFacilityBoundariesFromGeoJson(geojson, kind): FacilityBoundary[]` — properties `id`/`name` or `ID`/`NAME`; polygon/multipolygon; reuse existing simplify helpers (`MAX_RING_VERTS`)
  - Extend `filterMapContext` to accept/filter `artcc` + `appDep` like rings; filter airports from catalog the same haversine way
  - Paths: `AIRPORTS_CATALOG_PATH`, `AIRPORT_DESIGNATORS_PATH`, `ARTCC_BOUNDARIES_PATH`, `APP_DEP_BOUNDARIES_PATH`
  - `loadMapContextData` loads new files; missing facility files → `[]` (do not throw)

**OurAirports mapping:**
- Primary key for display `ident` from CSV `ident`
- `icao`: `resolveIcao(ident, icao_code)` or fall back to `ident.toUpperCase()` so non-ICAO fields still appear
- `towered`: airport id in TWR frequency set (existing logic)
- `publicUse`: `type` in `large_airport|medium_airport|small_airport|heliport`
- `pavedRunwayFt`: max length_ft among runways for that airport_ref where surface matches `/asp|con|pem|bit|tar|concrete|asphalt/i`

- [ ] **Step 1: Write failing tests for catalog filter fields + facility parse**

Add tests that:
1. A tiny CSV fixture string builds one towered + one public non-towered with paved length
2. `filterMapContext` returns `artcc`/`appDep` intersecting radius
3. Missing optional blobs load as empty arrays

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement types + builders + filter + load**

Also update `ToweredAirport` usages in map_context exports: `MapContextResponse.airports` becomes `MapAirport[]`. Keep exporting a compatibility note in types: `export type ToweredAirport = MapAirport` temporarily if needed to reduce churn, ensuring new fields exist with defaults on old paths.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/types.ts src/lib/fetchers/map_context.ts src/lib/fetchers/map_context.test.ts
git commit -m "feat(map): richer airport catalog and facility boundary types"
```

---

### Task 3: Fixtures, build script, committed sample JSON

**Files:**
- Create: `data/map/fixtures/artcc.geojson`
- Create: `data/map/fixtures/app-dep.geojson`
- Modify: `scripts/build-map-context-data.ts`
- Generate: `data/map/airports-catalog.json`, `data/map/airport-designators.json`, `data/map/artcc-boundaries.json`, `data/map/app-dep-boundaries.json`
- Keep writing `towered-airports.json` for any legacy consumers OR stop writing it only if nothing reads it — grep first; if only map_context uses catalog, prefer catalog as source of truth and have load use catalog (towered file optional)

**Fixture content:**
- Minimal GeoJSON Polygon(s) near Dayton, OH (~39.9, -84.2) with properties `{ "id": "ZID", "name": "Indianapolis" }` for ARTCC and `{ "id": "DAY", "name": "Dayton Approach" }` for APP/DEP — rough boxes are fine for tests/dev.

- [ ] **Step 1: Add fixture GeoJSON files**

- [ ] **Step 2: Extend build script** to also:
  - Fetch/build runways CSV (already partially done) → feed catalog builder
  - Write catalog + designators + artcc + appDep
  - Log counts/sizes

- [ ] **Step 3: Run `npm run build:map-context`** (network may be needed; fixtures must work offline if download fails)

- [ ] **Step 4: Commit fixtures + generated JSON + script**

```bash
git add data/map scripts/build-map-context-data.ts src/lib/fetchers/map_context.ts
git commit -m "feat(map): bake airport catalog and facility boundary fixtures"
```

---

### Task 4: API — context fields + airport lookup

**Files:**
- Modify: `src/app/api/map/context/route.ts`
- Create: `src/app/api/map/airport-lookup/route.ts`
- Create: `src/app/api/map/airport-lookup/route.test.ts` (or colocated test pattern used by other routes)

**Interfaces:**
- Context response includes `artcc` and `appDep` arrays (from `filterMapContext`)
- `GET /api/map/airport-lookup?q=I69` → `{ ok: true, ident: "I69", icao: "I69", name: string }` or `{ ok: false, error: "not_found" }`
- Lookup loads `airport-designators.json` + catalog (or index-only with name from catalog row); case-insensitive `q`

- [ ] **Step 1: Failing route/handler tests for lookup found/not found**

- [ ] **Step 2: Implement lookup + ensure context returns new arrays**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git add src/app/api/map/context/route.ts src/app/api/map/airport-lookup
git commit -m "feat(api): map context facility fields and airport designator lookup"
```

---

### Task 5: Overlay painters for ARTCC / APP/DEP

**Files:**
- Modify: `src/components/radar/radarFormat.ts` — add `artcc` and `appDep` stroke colors (distinct from Class B/C/D; lower-contrast for ARTCC)
- Modify: `src/components/radar/radarOverlays.ts` — extend `paintMapOverlays` opts:
  - `artcc: FacilityBoundary[]`
  - `appDep: FacilityBoundary[]`
  - `showArtcc: boolean`
  - `showAppDep: boolean`
- Paint order inside function: highways → artcc → appDep → class rings → tfrs → runways
- Labels: when polygon projected centroid is on-canvas and map zoom ≥ 6 (ARTCC) or ≥ 8 (APP/DEP), draw a small SVG text with `id`
- Create: `src/components/radar/radarOverlays.facility.test.ts` — unit-test a pure helper if extracted, e.g. `shouldShowFacilityLabel(zoom, kind)` 

- [ ] **Step 1: Write failing tests for label zoom thresholds + opts wiring helper if extracted**

- [ ] **Step 2: Implement colors + paint**

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```bash
git add src/components/radar/radarFormat.ts src/components/radar/radarOverlays.ts src/components/radar/radarOverlays.facility.test.ts
git commit -m "feat(radar): paint ARTCC and APP/DEP boundary overlays"
```

---

### Task 6: LayersPanel UI component

**Files:**
- Create: `src/components/radar/LayersPanel.tsx`
- Create: `src/components/radar/LayersPanel.test.tsx` (if the repo has React Testing Library; otherwise skip component test and cover via logic already tested — check package.json for `@testing-library/react`; if absent, no component test file)

**Props:**
```ts
export type LayersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  airportPreset: AirportPreset;
  onAirportPresetChange: (p: AirportPreset) => void;
  pinned: string[];
  onAddPin: (raw: string) => Promise<"ok" | "not_found" | "duplicate">;
  onRemovePin: (code: string) => void;
  pinError: string | null;
  showClassAirspace: boolean;
  onShowClassAirspaceChange: (v: boolean) => void;
  showArtcc: boolean;
  onShowArtccChange: (v: boolean) => void;
  showAppDep: boolean;
  onShowAppDepChange: (v: boolean) => void;
  showTfrs: boolean;
  onShowTfrsChange: (v: boolean) => void;
  tfrCount: number;
  showHighways: boolean;
  onShowHighwaysChange: (v: boolean) => void;
  airportsCapped: boolean;
};
```

UI structure matches spec:
- Button `Layers` toggles panel
- Sections: AIRPORTS (select + add designator + pin chips), AIRSPACE (3 checkboxes), CONTEXT (TFRs with count, Highways)
- Escape / click-outside closes (useEffect listeners when `open`)
- Style with existing slate/radar header classes (`rounded-lg bg-slate-900/85`, etc.)

- [ ] **Step 1: Implement `LayersPanel.tsx`**

- [ ] **Step 2: Manual smoke via typecheck `npx tsc --noEmit` (or project script)**

- [ ] **Step 3: Commit**

```bash
git add src/components/radar/LayersPanel.tsx
git commit -m "feat(radar): Layers panel UI for map overlays"
```

---

### Task 7: Wire RadarMap — state, markers, overlays, Weather untouched

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`
- Modify: `src/components/radar/radarFormat.ts` / marker DOM if needed for quieter non-towered + pin indicator

**Behavior:**
1. State defaults per Global Constraints
2. Load pins from `readPinnedDesignators()` on mount
3. Remove standalone TFR checkbox from header; keep Weather group as-is
4. Mount `<LayersPanel … />` near other header controls
5. On context fetch: store `artcc`/`appDep` in refs; airports as `MapAirport[]`
6. Before `syncAirportMarkers`: `filterAirportsForDisplay` + `softCapAirports`; set `airportsCapped` for panel note
7. `makeAirportEl`: quieter style when `!towered`; pin badge when in pinned set
8. `paintMapOverlays`: pass new flags; ground mode forces `showHighways/showAirspace/showArtcc/showAppDep` false regardless of toggles (toggles preserved in state)
9. `onAddPin`: call `/api/map/airport-lookup?q=`; on ok, `writePinnedDesignators`; on not_found set error string
10. Selection/detail still works with `MapAirport` (icao field)

- [ ] **Step 1: Wire state + panel + overlay/marker paths**

- [ ] **Step 2: Run relevant unit tests**

Run: `npx vitest run src/components/radar/airportLayers.test.ts src/lib/fetchers/map_context.test.ts src/components/radar/radarOverlays.facility.test.ts`
Expected: PASS

- [ ] **Step 3: `npx tsc --noEmit` (or `npm run lint` / project typecheck) — fix errors in touched files**

- [ ] **Step 4: Commit**

```bash
git add src/components/radar/RadarMap.tsx src/components/radar/LayersPanel.tsx src/components/radar/
git commit -m "feat(radar): wire Layers panel, presets, pins, and facility overlays"
```

---

### Task 8: Soft-cap note + README touch + final verification

**Files:**
- Modify: `LayersPanel` / `RadarMap` — when `airportsCapped`, show quiet text under airports section: `Zoom in for more airports`
- Modify: `README.md` — brief note that map context includes airport catalog + ARTCC/APP/DEP; Weather remains separate; Layers panel controls overlays

- [ ] **Step 1: Add capped copy + README note**

- [ ] **Step 2: Run full focused test suite + typecheck**

- [ ] **Step 3: Commit**

```bash
git add README.md src/components/radar/
git commit -m "docs: note map layers panel and verify soft-cap UX"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Layers dropdown | 6–7 |
| Weather separate | 7 (do not move) |
| Airport presets | 1, 7 |
| Pins + localStorage | 1, 4, 7 |
| ARTCC / APP/DEP | 2–5, 7 |
| Class B/C/D + TFR + highways toggles | 6–7 |
| Ground mode hide facility + highways + class | 7 |
| Bake pipeline | 2–3 |
| Defaults | 7 |
| Soft-cap | 1, 7–8 |
| No SIDs/STARs | — |

## Placeholder / consistency self-review

- Types named `MapAirport` / `FacilityBoundary` consistently across tasks
- Storage key `radar.pinnedAirports` fixed
- Paved threshold `3000` fixed
- Lookup API path `/api/map/airport-lookup` fixed
