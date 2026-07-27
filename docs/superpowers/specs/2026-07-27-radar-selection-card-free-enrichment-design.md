# Web radar selected aircraft card — free enrichment design

**Date:** 2026-07-27  
**Status:** Approved  
**Scope:** Redesign the web radar **selection panel** (bottom card) to layout C, populated only with free data already available from ADS-B + adsb.lol / VRS routeset + small static tables. Blip tags unchanged.

## Goals

- Replace the current ATC-lite selection card with the approved **layout C** structure.
- Surface **all useful free route/aircraft context** on select: full airport chain, city names, airline, telemetry extras, type expand, hex.
- Never invent airports or airline/type names; omit any field when unknown.
- Keep map blip tags (selected and unselected) exactly as they are today.

## Non-goals

- Paid APIs (FlightAware AeroAPI, Aviationstack, AirLabs, etc.)
- Filed airway / waypoint route strings or ETAs
- Planespotters / aircraft photos (UA/policy polish deferred)
- Firmware LVGL selection UI or device routeset wiring
- Changing blip tag formatters or declutter behavior

## Layout (card C)

Structure, top → bottom:

1. **Header row** — callsign (emphasized) · registration (dim, right)
2. **Route** — ICAO chain joined with `→` (e.g. `KDFW → KDAY → KDFW`)
3. **Cities** — matching `location` strings joined with ` · ` (dimmer, under route)
4. **Telemetry row 1** — altitude + trend · ground speed · track (`HDG ###`)
5. **Telemetry row 2** — ICAO type · squawk · vertical speed (`+#### fpm` / `-#### fpm`)
6. **Footer** — airline short name (or code) · expanded type name · hex (right)

Visual tokens stay aligned with existing radar chrome: bg `#0B0F14`, accent `#3D9CF0`, dim `#6B7280`, body `#C8D0D8`, selected white callsign. Mono for telemetry; system sans for callsign weight.

Omit any line or cell whose data is missing (no placeholders like `—` for unknown route).

## Data sources

### Live ADS-B (already ingested)

| Field | Card use |
|-------|----------|
| `flight` / callsign | Header |
| `r` registration | Header |
| `hex` | Footer |
| `t` type | Telemetry row 2 + type expand input |
| `squawk` | Telemetry row 2 |
| `alt_baro` / ground | Altitude / GND handling as today |
| `gs` | Ground speed |
| `track` | `HDG` (rounded degrees) |
| `baro_rate` / `geom_rate` | Trend `^`/`v` and numeric fpm |

### Route enrichment (free; expand current lookup)

Today `/api/adsb/route` returns only `originIcao`, `arrivalIcao`, `airportCodes`, `plausible`. Standing data and `GET /api/0/route/{cs}/{lat}/{lon}` also provide richer fields we currently discard.

Extend `RouteLookup` / API response to include:

| Field | Source | Card use |
|-------|--------|----------|
| `airportCodes` | `airport_codes` | Parse full ordered ICAO list for route line |
| `airportLocations[]` | `_airports[].location` (aligned to codes) | City line |
| `airlineCode` | `airline_code` | Airline expand input / fallback label |
| `flightNumber` | `number` | Optional; not required on card C v1 (callsign already shows it) |
| `plausible` | `plausible` | Not shown in UI; keep for future / debug |

**Multi-stop rule:** Do **not** collapse to first→last. Display the full chain from `airport_codes` (e.g. `KDFW-KDAY-KDFW` → three hops). First→last alone would wrongly show `KDFW → KDFW` for turnarounds.

If only a single airport is known, show that ICAO alone (no arrow). If unknown / `unknown`, omit route and city lines.

Prefer existing standing-data CDN with lat/lon route fallback (unchanged). Cache TTL remains ~10 minutes by callsign.

### Static offline tables (new, small)

| Table | Input | Output example |
|-------|--------|----------------|
| ICAO aircraft type | `CRJ9` | `CRJ-900` |
| ICAO airline | `JIA` | Short operator name `PSA` (not legal full name) |

Missing keys → show raw code, or omit expanded name and show code only. Tables live in backend (or shared TS module); no network.

## Component / wiring

- Selection state (`selected` in `RadarMap.tsx`) must carry: existing aircraft props **plus** `origin`/`arrival` replaced by ordered `routeIcaos` (or keep codes string), `routeLocations`, `airlineCode`, and ensure `trackDeg` / `baroRateFpm` / `hex` are available to the card (track and rate already on props; hex already on props).
- Route apply path that today sets only `arrivalIcao` must also attach the richer route fields onto markers / selected state.
- Blip tag builders (`updateAircraftEl` / `formatRadarTagLine*`) **must not** change inputs or output for this work. Arrival may remain on the aircraft model for tags if already used; card reads the richer route independently.
- Extract a small presentational helper or inline JSX for the card so formatting (route join, HDG, fpm sign) is testable without MapLibre.

## Formatting rules

- Route: `parts.join(" → ")` on ICAO codes (uppercase).
- Cities: join `_airports[].location` with ` · `; if length mismatches codes, omit city line rather than misalign.
- Track: `HDG ${Math.round(trackDeg)}` only when track known.
- Vertical speed: show signed fpm when rate known and outside existing deadband (same 100 fpm band as trend); inside deadband omit numeric VS (trend also none).
- Ground: when `onGround`, show `GND` in place of the altitude token on telemetry row 1 (same meaning as today’s `· GND` suffix); omit climb/descend and numeric VS while on ground.
- Footer left: `airlineExpand ?? airlineCode` then ` · ` then `typeExpand ?? type`; if both airline and type empty, omit footer left. Hex always when present.

## Error / empty behavior

- Route lookup failure → card still shows live telemetry; no route/city/airline.
- Partial route (codes without `_airports`) → ICAO chain only.
- GA / no callsign skip list unchanged (`skipRouteLookup`).

## Testing

- Parser: multi-stop `KDFW-KDAY-KDFW` → three ICAOs; `unknown` → empty; single code → one ICAO.
- Route lookup mapping: standing payload with `_airports` + `airline_code` maps into response fields.
- Card formatter / render helpers: omit missing sections; HDG/fpm formatting; footer join.
- Smoke: selecting a commercial flight with known standing data shows chain + cities; blip tag text unchanged in unit or snapshot of tag formatters.

## Open follow-ups (explicitly deferred)

1. Planespotters photo strip with proper User-Agent.
2. Firmware routeset + matching card C on device.
3. Using `plausible` to pick “current leg” highlight on multi-stop chains.
4. Paid AeroAPI for filed route / ETA.
