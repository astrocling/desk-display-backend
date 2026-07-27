# Web radar selected airport card — free enrichment design

**Date:** 2026-07-27  
**Status:** Approved  
**Scope:** Enrich the web radar **airport selection panel** (bottom card) with free static + weather + live nearby traffic. Parallel to the aircraft selection card enrichment. Web only; no paid APIs; no firmware.

## Goals

- Show **rich airport context** when an airport is selected / focused: identity, denser METAR, TAF, runways, key frequencies, and live inbound/outbound within an airport-centered ADS-B radius.
- Use available browser space; prefer completeness over a cramped mini-panel (scroll sections when needed).
- Never invent airports, frequencies, weather, or routes; omit unknown fields.
- Keep Ground view / Zoom out / ground-mode behavior unchanged.
- Phase work so detail enrichment ships first, then traffic — both intended in the same implementation day.

## Non-goals

- Paid arrival/departure boards (FlightAware AeroAPI, schedules, ETAs)
- True worldwide inbound list beyond free ADS-B coverage
- Firmware LVGL airport UI
- Changing map airport glyphs, airspace overlays, or blip tags
- Showing every OurAirports frequency type (navaids noise); prefer operational set only

## Phasing

### Phase 1 — Detail API + card UI

Extend `GET /api/airport/detail` and rebuild the airport panel as `SelectionAirportCard`.

### Phase 2 — Live nearby traffic

While an airport is focused, poll ADS-B **centered on that airport**, classify via route first/last ICAO, and render a traffic section on the card.

## Layout (card)

Structure, top → bottom:

1. **Header** — `ICAO` · `IATA` (if any) · name; subtitle `municipality · elev Ft` when known
2. **Weather** — flight category + wind / vis / ceiling / temp·dew / altimeter on one or two mono rows; raw METAR as a quieter third line when present
3. **TAF** — short forecast / truncated raw when available; omit entirely if none
4. **Runways** — scrollable list: idents · length × width · surface · lighted when known
5. **Frequencies** — compact operational rows (ATIS, TWR, GND, APP, DEP, CTAF/UNICOM); omit if empty
6. **Traffic (Phase 2)** — `Inbound N · Outbound M` plus compact callsign chips when total is small; omit if both zero or poll failed; label as live ADS-B nearby (within N nm), not a full board
7. **Actions** — Ground view / Zoom out / GROUND MODE (unchanged)

Visual tokens stay aligned with radar chrome and the aircraft card: bg `#0B0F14`, accent `#3D9CF0`, dim `#6B7280`, body `#C8D0D8`. Mono for weather / runways / freqs / traffic counts.

Omit any section whose data is missing (no invented placeholders).

## Data sources

### Phase 1 — `GET /api/airport/detail?icao=…`

Single fetch for the card (plus existing focus/ground wiring).

| Block | Fields | Source |
|-------|--------|--------|
| Identity | `icao`, `iata`, `name`, `municipality`, `elevFt`, `lat`/`lon` | OurAirports `airports.csv` (lookup by ICAO; elev from CSV) |
| Runways | existing runway fields + `lighted` when available | OurAirports runways (existing cache / `runways.json`) |
| Frequencies | `{ type, description, mhz }[]` | OurAirports `airport-frequencies.csv` (already used in map-context build; load/cache similarly to runways) |
| METAR | existing summary + `tempC` (already stored), `dewpointC`, `altimeterInHg`, keep `raw` | AviationWeather METAR JSON |
| TAF | `{ raw, validFrom, validTo }` or `null` | AviationWeather TAF JSON |

Frequency filter: prefer **ATIS, TWR, GND, APP, DEP, CTAF, UNICOM** (and close variants). Drop other types from the card payload or filter in the formatter.

### Phase 2 — Live traffic (not in detail API)

| Input | Use |
|-------|-----|
| ADS-B poll centered on focused airport lat/lon | Aircraft positions within chosen radius (reuse `/api/adsb`, clamp ≤ 250 nm) |
| Existing batch `/api/adsb/route` | `routeIcaos` for classification |

**Classification**

- **Outbound:** route first ICAO equals focused airport
- **Inbound:** route last ICAO equals focused airport
- Multi-stop: still first = out / last = in
- Case-normalized ICAO; skip aircraft with empty / unknown route — do not guess from proximity or heading alone
- On-ground at this airport: outbound only if route originates here; do not double-count as inbound

**Display**

- Counts: `Inbound N · Outbound M`
- If total ≤ ~6, also show compact callsign chips (selecting a chip may focus that aircraft when wiring is straightforward; counts-only is acceptable if click wiring is messy)
- Update while focus is active; clear on focus clear
- Explicitly **not** a schedule board — live ADS-B within N nm only

Default radius: **150 nm** (constant), clamped to adsb.lol max **250 nm**.

## Component / wiring

- Extract **`SelectionAirportCard`** (presentational), parallel to `SelectionAircraftCard`, plus testable format helpers (weather lines, runway label, freq line, traffic summary).
- `RadarMap` continues to own: open/close focus, detail fetch, ground mode, and (Phase 2) airport-centered ADS-B + route classify → pass traffic props into the card.
- Do not regress ground-mode runway overlays or airport marker heading behavior.

## Error / empty behavior

- METAR/TAF failure → omit that block (or show unavailable for weather only); identity/runways may still render
- Missing elev / IATA / municipality / freqs → omit those fields
- Traffic poll or route classify failure → omit traffic section; rest of card stays
- Never invent airports, freqs, weather, or routes

## Caching

- Detail API: keep short public cache (~60s client / ~300s edge) as today
- METAR in-process TTL ~5 min (existing); TAF similar (~10 min)
- Frequencies / runways / identity: static OurAirports, memory and/or on-disk JSON like runways
- Traffic: no store; poll while focused; stop on clear

## Testing

- Identity / elev / IATA / municipality mapping from OurAirports rows
- Frequency filter keeps operational types, drops noise
- METAR extras: dewpoint, altimeter; TAF null vs present
- Runway label includes lighted when set
- Traffic classifier: first=out / last=in / no-route skipped / case normalize / no double-count
- Format helpers omit empty sections
- Card remains presentational; fetch wiring stays in `RadarMap` / API routes

## Open follow-ups (explicitly deferred)

1. Paid full arrival/departure board
2. Clickable traffic chips → aircraft select (optional in Phase 2 if cheap)
3. Firmware airport detail card
4. Expanding frequency set or ATIS decode beyond raw mhz
