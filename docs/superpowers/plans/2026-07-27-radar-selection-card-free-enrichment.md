# Radar selection card free enrichment — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Redesign the web radar selection panel to layout C using free ADS-B + routeset + static expand tables, without changing blip tags.

**Architecture:** Expand `flight_routes` lookup to pass through full airport chain, locations, and airline; add format helpers + small expand maps; rebuild only the `selected` card JSX in `RadarMap.tsx`.

**Tech Stack:** Next.js / TypeScript, existing Vitest tests, adsb.lol VRS standing-data.

## Global Constraints

- Blip tags / `formatRadarTagLine*` behavior unchanged for map markers.
- Never invent airports; omit unknown fields.
- Web only; no paid APIs; no firmware.
- Multi-stop: show full ICAO chain, not first→last only.

---

## File map

| File | Role |
|------|------|
| `src/lib/fetchers/flight_routes_parse.ts` | Parse full ICAO list + locations from payload |
| `src/lib/fetchers/flight_routes.ts` | Map richer fields into `RouteLookup` |
| `src/app/api/adsb/route/route.ts` | Pass-through API types if needed |
| `src/components/radar/types.ts` | Extend route + aircraft props |
| `src/lib/radar-expand.ts` (new) | Type/airline expand tables |
| `src/components/radar/selectionCardFormat.ts` (new) | Card string builders (testable) |
| `src/components/radar/RadarMap.tsx` | Wire route fields; render layout C card |
| `*.test.ts` | Parser, expand, card format tests |

---

### Task 1: Route parse + lookup enrichment

- [ ] Extend parser: `parseAirportCodesList`, extract locations aligned to codes
- [ ] Extend `RouteLookup` with `routeIcaos`, `routeLocations`, `airlineCode`
- [ ] Keep `originIcao`/`arrivalIcao` as first/last for existing tag use
- [ ] Tests for multi-stop / unknown / location mismatch

### Task 2: Expand tables + card format helpers

- [ ] `expandAircraftType` / `expandAirline` with modest CRJ/B73x/A32x/common airline set
- [ ] Formatters: route line, cities, HDG, VS, footer, telemetry rows
- [ ] Tests

### Task 3: Wire RadarMap + layout C UI

- [ ] Attach richer route onto aircraft / selected state
- [ ] Replace selection card JSX with layout C
- [ ] Do not touch blip `updateAircraftEl` tag content beyond existing arrival

### Task 4: Verify

- [ ] Run unit tests
- [ ] Lint touched files
