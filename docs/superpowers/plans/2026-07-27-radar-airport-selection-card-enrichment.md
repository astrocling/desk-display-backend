# Radar airport selection card enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the web radar airport selection panel with free identity, denser METAR/TAF, runways, key frequencies, and live inbound/outbound traffic within 150 nm of the focused airport.

**Architecture:** Extend `/api/airport/detail` with OurAirports identity + frequencies and AviationWeather TAF/METAR extras; extract `SelectionAirportCard` + format helpers; Phase 2 polls ADS-B centered on the focused airport and classifies via route first/last ICAO.

**Tech Stack:** Next.js / TypeScript, Vitest, OurAirports CSVs, AviationWeather METAR/TAF, adsb.lol via existing `/api/adsb` + `/api/adsb/route`.

## Global Constraints

- Never invent airports, frequencies, weather, or routes; omit unknown fields.
- Web only; no paid APIs; no firmware.
- Ground view / Zoom out / ground-mode runway overlays unchanged in behavior.
- Traffic is live ADS-B within 150 nm of the airport — not a schedule board.
- Prefer completeness over a cramped card; scroll long runway lists.

---

## File map

| File | Role |
|------|------|
| `src/lib/fetchers/airport_detail.ts` | Identity, freqs, lighted runways, METAR extras, TAF |
| `src/lib/fetchers/airport_detail.test.ts` | Parser / METAR / TAF / freq filter tests |
| `src/components/radar/types.ts` | Extend `AirportDetailResponse`, traffic types |
| `src/app/api/airport/detail/route.ts` | Pass-through richer detail (minimal if fetcher owns shape) |
| `src/components/radar/airportCardFormat.ts` | Testable string builders for airport card |
| `src/components/radar/airportCardFormat.test.ts` | Format tests |
| `src/components/radar/airportTraffic.ts` | Classify inbound/outbound from routes |
| `src/components/radar/airportTraffic.test.ts` | Classifier tests |
| `src/components/radar/SelectionAirportCard.tsx` | Presentational airport card |
| `src/components/radar/RadarMap.tsx` | Wire detail props + Phase 2 traffic poll |

---

### Task 1: OurAirports identity + frequencies + lighted runways

**Files:**
- Modify: `src/lib/fetchers/airport_detail.ts`
- Modify: `src/lib/fetchers/airport_detail.test.ts`
- Produce types used by later tasks (also mirrored in `types.ts` in Task 3)

**Interfaces:**
- Produces:
  - `AirportIdentity { icao, iata, name, municipality, elevFt, lat, lon }`
  - `AirportFrequency { type, description, mhz }`
  - `AirportRunway` gains optional `lighted: boolean | null`
  - `buildAirportIdentityFromCsv(csv): Record<string, AirportIdentity>`
  - `buildFrequenciesFromCsv(airportsCsv, frequenciesCsv): Record<string, AirportFrequency[]>`
  - `filterOperationalFrequencies(freqs): AirportFrequency[]`
  - `loadAirportIdentityByIcao()`, `loadFrequenciesByIcao()` (cache like runways; disk JSON optional cold path — in-memory from CSV URL/fixtures is fine)

- [ ] **Step 1: Write failing tests for identity, freqs, lighted**

```ts
import { describe, expect, it } from "vitest";
import {
  buildAirportIdentityFromCsv,
  buildFrequenciesFromCsv,
  buildRunwaysFromCsv,
  filterOperationalFrequencies,
} from "./airport_detail";

const AIRPORTS_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
3622,"KDAY","large_airport","James M Cox Dayton International Airport",39.9024,-84.2194,1009,"NA","US","US-OH","Dayton","yes","KDAY","DAY","KDAY","DAY",,,
`;

const FREQ_CSV = `"id","airport_ref","type","description","frequency_mhz"
1,3622,"ATIS","ATIS",134.875
2,3622,"TWR","Tower",119.9
3,3622,"GND","Ground",121.9
4,3622,"APP","Approach",126.375
5,3622,"VOR","VORTAC",117.0
`;

describe("buildAirportIdentityFromCsv", () => {
  it("maps ICAO to iata, municipality, elev", () => {
    const map = buildAirportIdentityFromCsv(AIRPORTS_CSV);
    expect(map.KDAY).toEqual({
      icao: "KDAY",
      iata: "DAY",
      name: "James M Cox Dayton International Airport",
      municipality: "Dayton",
      elevFt: 1009,
      lat: 39.9024,
      lon: -84.2194,
    });
  });
});

describe("buildFrequenciesFromCsv", () => {
  it("keeps operational freqs and drops VOR", () => {
    const byIcao = buildFrequenciesFromCsv(AIRPORTS_CSV, FREQ_CSV);
    const filtered = filterOperationalFrequencies(byIcao.KDAY ?? []);
    expect(filtered.map((f) => f.type)).toEqual(["ATIS", "TWR", "GND", "APP"]);
    expect(filtered.find((f) => f.type === "ATIS")?.mhz).toBe(134.875);
  });
});

describe("buildRunwaysFromCsv lighted", () => {
  it("parses lighted flag", () => {
    const csv = `"id","airport_ref","airport_ident","length_ft","width_ft","surface","lighted","closed","le_ident","le_latitude_deg","le_longitude_deg","le_elevation_ft","le_heading_degT","le_displaced_threshold_ft","he_ident","he_latitude_deg","he_longitude_deg","he_elevation_ft","he_heading_degT","he_displaced_threshold_ft"
1,"1","KDAY","10901","150","ASP","1","0","06L","39.895","-84.246","1009","55.3","","24R","39.912","-84.214","1009","235.3",""
`;
    const byIcao = buildRunwaysFromCsv(csv);
    expect(byIcao.KDAY[0].lighted).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (exports missing)**

Run: `npm test -- src/lib/fetchers/airport_detail.test.ts`
Expected: FAIL — `buildAirportIdentityFromCsv` / `filterOperationalFrequencies` not exported or lighted missing.

- [ ] **Step 3: Implement parsers + loaders**

In `airport_detail.ts`:

- Extend `AirportRunway` with `lighted: boolean | null`; set from CSV `lighted` (`"1"` → true, `"0"` → false, else null).
- Add identity + frequency types and CSV builders.
- Operational types (case-insensitive includes): `ATIS`, `TWR`, `GND`, `GROUND`, `APP`, `DEP`, `CTAF`, `UNICOM`.
- Sort freqs: ATIS → TWR → GND → APP → DEP → CTAF → UNICOM → other kept.
- Cache loaders: try on-disk under `data/map/` if present; else fetch OurAirports URLs (same base as `map_context.ts`); fall back to fixtures under `data/map/fixtures/` on failure.
- Reuse existing CSV parse helper in this file (do not duplicate from `map_context` unless extracting a shared util is trivial).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/fetchers/airport_detail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/airport_detail.ts src/lib/fetchers/airport_detail.test.ts
git commit -m "feat: parse airport identity, frequencies, and lighted runways"
```

---

### Task 2: METAR extras + TAF fetch

**Files:**
- Modify: `src/lib/fetchers/airport_detail.ts`
- Modify: `src/lib/fetchers/airport_detail.test.ts`

**Interfaces:**
- Produces:
  - `MetarSummary` gains `dewpointC: number | null`, `altimeterInHg: number | null` (keep `tempC`)
  - `TafSummary { raw: string; validFrom: string | null; validTo: string | null }`
  - `fetchTaf(icao: string): Promise<TafSummary | null>`
  - `fetchMetar` populates dewpoint + altimeter

**Notes:**
- AviationWeather METAR JSON: `dewp` (°C), `altim` is **hPa** — convert to inHg: `altim / 33.8639`, round to 2 decimals (e.g. 1011.3 → 29.86). Prefer JSON fields; do not invent from raw if JSON missing.
- TAF URL: `https://aviationweather.gov/api/data/taf?ids={icao}&format=json`
- TAF fields: `rawTAF`, `validTimeFrom` / `validTimeTo` (unix seconds → ISO strings)
- Cache TAF ~10 min in-process Map (like METAR’s 5 min)

- [ ] **Step 1: Write failing tests**

```ts
describe("metar altimeter conversion", () => {
  it("converts hPa to inHg", () => {
    // Export a pure helper for testability:
    // hPaToInHg(1011.3) ≈ 29.86
    expect(hPaToInHg(1011.3)).toBeCloseTo(29.86, 2);
  });
});

describe("parseTafRow", () => {
  it("maps raw and validity window", () => {
    const summary = parseTafRow({
      rawTAF: "TAF KDAY ...",
      validTimeFrom: 1785175200,
      validTimeTo: 1785261600,
    });
    expect(summary?.raw).toContain("TAF KDAY");
    expect(summary?.validFrom).toBe(new Date(1785175200 * 1000).toISOString());
  });

  it("returns null for empty", () => {
    expect(parseTafRow(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/fetchers/airport_detail.test.ts`
Expected: FAIL — helpers not defined.

- [ ] **Step 3: Implement `hPaToInHg`, extend `fetchMetar`, add `parseTafRow` + `fetchTaf`**

Update `MetarSummary` and `fetchMetar` to set:
- `dewpointC` from `m.dewp` when number
- `altimeterInHg` from `hPaToInHg(m.altim)` when number

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/airport_detail.ts src/lib/fetchers/airport_detail.test.ts
git commit -m "feat: add METAR dewpoint/altimeter and TAF fetch"
```

---

### Task 3: Wire `getAirportDetail` + shared types

**Files:**
- Modify: `src/lib/fetchers/airport_detail.ts` (`getAirportDetail`)
- Modify: `src/components/radar/types.ts` (`AirportDetailResponse`, `AirportRunway`)
- Modify: `src/app/api/airport/detail/route.ts` only if needed for typing/comments

**Interfaces:**
- Consumes: Task 1–2 loaders + `fetchTaf`
- Produces: `AirportDetail` / `AirportDetailResponse` with:

```ts
{
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  elevFt: number | null;
  lat: number;
  lon: number;
  runways: AirportRunway[]; // includes lighted
  frequencies: AirportFrequency[];
  metar: MetarSummary | null; // includes dewpointC, altimeterInHg
  taf: TafSummary | null;
}
```

- [ ] **Step 1: Write failing test for assembled detail shape**

```ts
describe("getAirportDetail assembly", () => {
  it("merges identity, freqs, metar, taf without inventing", async () => {
    // Prefer unit-testing a pure assembleAirportDetail(...) helper
    // that takes already-loaded pieces, so no network in tests.
    const detail = assembleAirportDetail({
      icao: "KDAY",
      identity: {
        icao: "KDAY",
        iata: "DAY",
        name: "James M Cox Dayton International Airport",
        municipality: "Dayton",
        elevFt: 1009,
        lat: 39.9,
        lon: -84.2,
      },
      runways: [],
      frequencies: [{ type: "ATIS", description: "ATIS", mhz: 134.875 }],
      metar: null,
      taf: null,
    });
    expect(detail.iata).toBe("DAY");
    expect(detail.municipality).toBe("Dayton");
    expect(detail.elevFt).toBe(1009);
    expect(detail.frequencies).toHaveLength(1);
    expect(detail.taf).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `assembleAirportDetail` + update `getAirportDetail`**

`getAirportDetail` should:
1. Load identity by ICAO (fallback to opts.name/lat/lon when identity missing)
2. Load runways + operational frequencies
3. `Promise.all([fetchMetar(icao), fetchTaf(icao)])`
4. Return assembled object; never invent iata/municipality/elev

Update `types.ts` `AirportDetailResponse` to match.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/airport_detail.ts src/lib/fetchers/airport_detail.test.ts src/components/radar/types.ts src/app/api/airport/detail/route.ts
git commit -m "feat: return enriched airport detail payload"
```

---

### Task 4: Airport card format helpers

**Files:**
- Create: `src/components/radar/airportCardFormat.ts`
- Create: `src/components/radar/airportCardFormat.test.ts`

**Interfaces:**
- Produces:
  - `formatAirportSubtitle({ municipality, elevFt }): string | null`
  - `formatAirportWeatherRows(metar): { row1: string[]; row2: string[]; raw: string | null }`
  - `formatAirportTafLine(taf): string | null` (truncate raw to ~120 chars if needed)
  - `formatAirportRunwayLabel(rwy): string` (idents · L×W · surface · lighted)
  - `formatAirportFreqLine(freqs): string | null` (`ATIS 134.875 · TWR 119.9 · …`)
  - `formatAirportTrafficSummary({ inbound, outbound }): string | null`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  formatAirportFreqLine,
  formatAirportRunwayLabel,
  formatAirportSubtitle,
  formatAirportTrafficSummary,
  formatAirportWeatherRows,
} from "./airportCardFormat";

describe("airportCardFormat", () => {
  it("formats subtitle", () => {
    expect(
      formatAirportSubtitle({ municipality: "Dayton", elevFt: 1009 }),
    ).toBe("Dayton · 1009 ft");
    expect(formatAirportSubtitle({ municipality: null, elevFt: null })).toBeNull();
  });

  it("builds weather rows and omits empties", () => {
    const { row1, row2, raw } = formatAirportWeatherRows({
      raw: "METAR KDAY ...",
      flightCategory: "VFR",
      wind: "230@11kt",
      visibility: "10SM",
      ceiling: "BKN250",
      tempC: 28.9,
      dewpointC: 20.6,
      altimeterInHg: 29.86,
      observed: null,
    });
    expect(row1[0]).toBe("VFR");
    expect(row1).toContain("230@11kt");
    expect(row2.some((p) => p.includes("29/21") || p.includes("28.9"))).toBe(true);
    expect(raw).toContain("METAR");
  });

  it("formats runway with lighted", () => {
    expect(
      formatAirportRunwayLabel({
        leIdent: "06L",
        heIdent: "24R",
        lengthFt: 10901,
        widthFt: 150,
        surface: "ASP",
        lighted: true,
        leLat: 0,
        leLon: 0,
        heLat: 0,
        heLon: 0,
        leHeadingDeg: null,
        heHeadingDeg: null,
      }),
    ).toMatch(/06L\/24R/);
    expect(
      formatAirportRunwayLabel({
        leIdent: "06L",
        heIdent: "24R",
        lengthFt: 10901,
        widthFt: 150,
        surface: "ASP",
        lighted: true,
        leLat: 0,
        leLon: 0,
        heLat: 0,
        heLon: 0,
        leHeadingDeg: null,
        heHeadingDeg: null,
      }),
    ).toMatch(/lighted/i);
  });

  it("formats freqs and traffic", () => {
    expect(
      formatAirportFreqLine([
        { type: "ATIS", description: "ATIS", mhz: 134.875 },
        { type: "TWR", description: "Tower", mhz: 119.9 },
      ]),
    ).toBe("ATIS 134.875 · TWR 119.9");
    expect(
      formatAirportTrafficSummary({ inbound: 3, outbound: 1 }),
    ).toBe("Inbound 3 · Outbound 1");
    expect(
      formatAirportTrafficSummary({ inbound: 0, outbound: 0 }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- src/components/radar/airportCardFormat.test.ts`

- [ ] **Step 3: Implement formatters**

Temp/dew display: prefer `Math.round(tempC)/Math.round(dewpointC)` style `29/21` when both known; else single temp. Altimeter: `A29.86` when known.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/airportCardFormat.ts src/components/radar/airportCardFormat.test.ts
git commit -m "feat: add airport selection card format helpers"
```

---

### Task 5: `SelectionAirportCard` + RadarMap Phase 1 UI

**Files:**
- Create: `src/components/radar/SelectionAirportCard.tsx`
- Modify: `src/components/radar/RadarMap.tsx` (replace inline airport card JSX ~2002–2080; remove local `metarOneLiner` / `runwayLabel` if unused)
- Types already updated in Task 3

**Interfaces:**
- Consumes: `AirportDetailResponse`, format helpers, optional traffic props (default empty for Phase 1)

```tsx
export function SelectionAirportCard(props: {
  detail: AirportDetailResponse;
  groundMode: boolean;
  onClose: () => void;
  onEnterGround: () => void;
  onExitGround: () => void;
  traffic?: {
    inbound: { callsign: string; hex: string }[];
    outbound: { callsign: string; hex: string }[];
    radiusNm: number;
  } | null;
  onSelectTrafficHex?: (hex: string) => void;
})
```

- [ ] **Step 1: Implement presentational card**

Layout per spec: header → weather → TAF → runways (scroll) → freqs → traffic (if props) → actions.

Use same chrome classes as `SelectionAircraftCard` / existing airport panel (`bg-[#0B0F14]/90`, accent rings). Show traffic radius hint when traffic present: e.g. dim `within 150 nm`.

- [ ] **Step 2: Wire RadarMap**

Replace inline airport footer card with:

```tsx
{airportDetail ? (
  <SelectionAirportCard
    detail={airportDetail}
    groundMode={groundMode}
    onClose={clearAirportFocus}
    onEnterGround={enterGroundView}
    onExitGround={exitGroundView}
    traffic={null}
  />
) : null}
```

Keep loading/error UI wrappers as today.

- [ ] **Step 3: Manual sanity** — open radar, select KDAY (or local towered), confirm IATA/city/elev/METAR extras/freqs/TAF when available; Ground view still works.

- [ ] **Step 4: Run unit tests + lint touched files**

Run: `npm test -- src/lib/fetchers/airport_detail.test.ts src/components/radar/airportCardFormat.test.ts`
Run: `npx eslint src/components/radar/SelectionAirportCard.tsx src/components/radar/RadarMap.tsx src/lib/fetchers/airport_detail.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/SelectionAirportCard.tsx src/components/radar/RadarMap.tsx
git commit -m "feat: render enriched airport selection card"
```

---

### Task 6: Traffic classifier (pure)

**Files:**
- Create: `src/components/radar/airportTraffic.ts`
- Create: `src/components/radar/airportTraffic.test.ts`

**Interfaces:**
- Produces:

```ts
export const AIRPORT_TRAFFIC_RADIUS_NM = 150;

export type TrafficAircraft = {
  hex: string;
  callsign: string;
  routeIcaos?: string[] | null;
};

export function classifyAirportTraffic(
  focusedIcao: string,
  aircraft: TrafficAircraft[],
): {
  inbound: TrafficAircraft[];
  outbound: TrafficAircraft[];
}
```

Rules:
- Normalize ICAO uppercase trim
- Outbound: `routeIcaos[0] === focused`
- Inbound: `routeIcaos[routeIcaos.length - 1] === focused`
- If first === last === focused (local turnaround), count **outbound only** (avoid double-count)
- Skip empty / missing routes
- Deduplicate by hex

- [ ] **Step 1: Write failing tests**

```ts
describe("classifyAirportTraffic", () => {
  it("classifies first=out last=in", () => {
    const r = classifyAirportTraffic("KDAY", [
      { hex: "a", callsign: "AAL1", routeIcaos: ["KDFW", "KDAY"] },
      { hex: "b", callsign: "AAL2", routeIcaos: ["KDAY", "KORD"] },
      { hex: "c", callsign: "N123", routeIcaos: null },
    ]);
    expect(r.inbound.map((x) => x.hex)).toEqual(["a"]);
    expect(r.outbound.map((x) => x.hex)).toEqual(["b"]);
  });

  it("does not double-count turnaround", () => {
    const r = classifyAirportTraffic("KDAY", [
      { hex: "t", callsign: "JIA1", routeIcaos: ["KDAY", "KDAY"] },
    ]);
    expect(r.outbound).toHaveLength(1);
    expect(r.inbound).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement classifier**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/airportTraffic.ts src/components/radar/airportTraffic.test.ts
git commit -m "feat: classify airport inbound and outbound traffic"
```

---

### Task 7: Phase 2 — airport-centered ADS-B + card traffic

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`
- Modify: `src/components/radar/SelectionAirportCard.tsx` if chip UI needs polish
- Modify: `src/components/radar/types.ts` only if shared traffic type lives there

**Behavior:**
- When `focusedAirportRef` is set (airport detail open), start a poll (same interval as main ADS-B or ~5–10s) to:

```
GET /api/adsb?lat={focus.lat}&lon={focus.lon}&dist=150
```

- Parse aircraft; run existing `fetchRoutes` / arrival cache so `routeIcaos` populate
- `classifyAirportTraffic(focus.icao, aircraftWithRoutes)`
- `setAirportTraffic({ inbound, outbound, radiusNm: 150 })`
- Pass into `SelectionAirportCard`
- On `clearAirportFocus`, clear traffic state and stop the airport-centered poll (viewport ADS-B continues as today)
- Do **not** replace the main map’s viewport ADS-B markers with the 150 nm poll — traffic poll is for the card only
- Optional: chip click → select aircraft if hex exists in `lastAircraftRef` / markers; if not on map, skip or no-op (counts still shown)

- [ ] **Step 1: Add state + effect for focused airport traffic poll**

Keep abort/generation token so stale responses after close are ignored.

- [ ] **Step 2: Wire traffic props into `SelectionAirportCard`**

Show summary + chips when `inbound.length + outbound.length <= 6`; otherwise counts only. Dim caption: `live ADS-B · 150 nm`.

- [ ] **Step 3: Manual sanity** — focus airport, confirm inbound/outbound update; close clears section; ground mode still works; map traffic still viewport-based.

- [ ] **Step 4: Run full relevant tests**

Run: `npm test -- src/lib/fetchers/airport_detail.test.ts src/components/radar/airportCardFormat.test.ts src/components/radar/airportTraffic.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/RadarMap.tsx src/components/radar/SelectionAirportCard.tsx src/components/radar/types.ts
git commit -m "feat: show live nearby inbound and outbound on airport card"
```

---

### Task 8: Verify

- [ ] **Step 1: Run full unit suite**

Run: `npm test`
Expected: PASS (or only pre-existing failures unrelated to this work — fix any new failures)

- [ ] **Step 2: Lint touched paths**

Run: `npx eslint src/lib/fetchers/airport_detail.ts src/components/radar/airportCardFormat.ts src/components/radar/airportTraffic.ts src/components/radar/SelectionAirportCard.tsx src/components/radar/RadarMap.tsx src/components/radar/types.ts`

- [ ] **Step 3: Spec checklist**

Confirm against `docs/superpowers/specs/2026-07-27-radar-airport-selection-card-enrichment-design.md`:
- Identity / elev / IATA / municipality
- Denser METAR + TAF
- Runways + lighted
- Operational frequencies
- Traffic 150 nm airport-centered, first/last classify, no schedule board
- Omit unknowns; ground actions unchanged

- [ ] **Step 4: Final commit only if verify fixed anything**; otherwise done.
