# Web radar map layers — design

**Date:** 2026-07-29  
**Status:** Approved  
**Scope:** Web `/radar` only — unified Layers panel, richer airport catalog with presets + pinned designators, ARTCC and APP/DEP boundary overlays. Weather remains a separate header control.

## Problem

The web radar shows towered airports, Class B/C/D, TFRs, highways, ADS-B traffic, and optional weather, but operators cannot turn most of those overlays on or off, cannot show smaller airports, and cannot see facility boundaries (ARTCC / approach–departure). SIDs/STARs and navaids are interesting later but need a different, facility-scoped approach — not a global “all on” dump.

## Goals

- Light default view matching today’s feel; denser layers available on demand.
- One **Layers** dropdown for map overlays (airports, Class B/C/D, ARTCC, APP/DEP, TFRs, highways).
- Keep **Weather** as its own header quick action (on/off, opacity, frame scrubber).
- Airport presets plus pin-by-designator (browser `localStorage`).
- ARTCC and APP/DEP boundaries as optional overlays from baked map data.
- Stay on the existing MapLibre + `data/map` + `/api/map/context` pipeline (no new vector-tile stack).

## Non-goals

- SIDs / STARs (airport- or facility-scoped design in a later pass).
- Navaids, airways, waypoints, sectional/IFR chart tiles.
- Server-side or account-synced preferences.
- Desk-display / firmware / non-web surfaces.
- Facility boundary click-through detail cards.
- Persisting full Layers panel visibility in `localStorage` (first visit always matches today’s defaults; only pins persist).
- Changing ADS-B declutter behavior.

## Defaults (first visit)

| Layer / control | Default |
|-----------------|---------|
| Towered airports | On (via **Towered only** preset) |
| Class B / C / D | On |
| TFRs | On |
| Highways | On (subject to existing ground-mode hide) |
| Weather | Off |
| Smaller airports / denser presets | Off until preset changed |
| ARTCC | Off |
| APP / DEP | Off |
| Pinned airports | Empty list |

## UI

### Weather (unchanged role)

Remains a dedicated header control group:

- Checkbox: Weather on/off
- When on: opacity slider + frame scrubber (same as today)

Not listed inside the Layers panel.

### Layers dropdown

Header control labeled **Layers** opens a floating panel (click outside / Escape closes).

**Airports**

- Preset select:
  - **Towered only** (default) — airports with TWR frequencies (today’s set)
  - **Public use** — public airports/heliports with a usable runway
  - **Public + paved** — public fields with a paved runway ≥ 3,000 ft
  - **All airports** — full catalog in viewport; still radius-capped
- **Add designator…** text field: ICAO or local code (case-insensitive). Validated against the **full** airport catalog (not only the current viewport); unknown → inline “not found”.
- Pinned list: always shown regardless of preset; each pin removable. A pin outside the current viewport does not appear on the map until the operator pans/zooms so that airport is in context.

**Airspace**

- Class B / C / D (checkbox)
- ARTCC boundaries (checkbox)
- APP / DEP boundaries (checkbox)

**Context**

- TFRs (checkbox; keep count when available)
- Highways (checkbox)

The existing header TFR checkbox moves into this panel; Weather stays in the header.

### Airport glyphs

- Towered: keep current `+` + designator treatment.
- Non-towered / smaller: quieter mark (smaller, lower contrast).
- Pinned: type-appropriate glyph plus a subtle pin indicator.

## Behavior

### Airport visibility

An airport marker is shown when it is in the current viewport context payload **and** either:

1. It matches the active preset filter, or  
2. Its designator is in the pinned list.

Pins never remove airports that the preset already includes; they only force-show extras.

### Ground mode

Unchanged clutter rule, extended to new facility layers:

- Entering ground mode: hide highways, Class B/C/D, ARTCC, APP/DEP; show runways for the focused airport.
- Airport markers continue to follow preset + pins.
- Leaving ground mode restores according to current Layers toggles (not hard-coded defaults).

### Facility airspace

- ARTCC: center boundaries labeled with facility ID when zoom allows.
- APP/DEP: TRACON / approach boundaries labeled with facility name or ID when zoomed enough.
- Distinct stroke styles from Class B/C/D (wider/lower-contrast for ARTCC; tighter for APP/DEP).
- Independent toggles; both default off.
- Viewport-filtered via map context — no full national dump to the client at once.
- Missing data file: toggle disabled or empty paint; no crash.

### Density / performance

- Map context remains radius-capped (existing map context limits).
- If “All airports” would still overwhelm the client, soft-cap marker count and show a quiet “zoom in for more” note rather than freezing the UI.

### Pins persistence

- Key in `localStorage` (e.g. `radar.pinnedAirports`): normalized uppercase designator strings.
- Corrupt JSON → treat as empty list; map still loads.
- Duplicate add → no-op.

## Architecture

### Approach

Extend the existing offline GIS bake (`npm run build:map-context` → `data/map/*.json` → `GET /api/map/context`) rather than introducing live vector tiles or a second rendering stack.

### Build pipeline

- **Airports:** OurAirports CSVs → richer catalog with fields for presets (`type`, public-use, paved runway length, ICAO + local code, lat/lon), plus the existing towered/TWR set used by the default preset.
- **ARTCC + APP/DEP:** NASR-derived (or equivalent public FAA) boundary polygons → simplified rings + facility id/name → committed JSON under `data/map/`.
- Class B/C/D, highways, runways: existing roles unchanged.

### API

`GET /api/map/context` viewport-filters and returns:

- Airports (richer catalog for painting)
- Class B/C/D rings
- Highways
- ARTCC polygons
- APP/DEP polygons

Pin validation uses a lightweight full-catalog designator lookup (same bake, small index or dedicated check endpoint) so operators can pin fields not currently in view.

TFRs and weather remain separate fetches as today.

### Client

- Layers visibility + airport preset: React state; first-visit defaults as in the Defaults table.
- Pins: `localStorage` only.
- SVG painters (or equivalent overlay path) gain ARTCC / APP/DEP; airport marker sync honors preset + pins.
- Paint order (bottom → top): highways → ARTCC → APP/DEP → Class B/C/D → TFRs → runways (ground) → airport markers → traffic.

### Code touchpoints (expected)

- `scripts/build-map-context-data.ts`, `src/lib/fetchers/map_context.ts`
- `src/app/api/map/context/route.ts`
- `src/components/radar/RadarMap.tsx` (panel UI, state, marker sync)
- `src/components/radar/radarOverlays.ts` (facility boundary paint)
- `src/components/radar/types.ts`
- New small helpers for preset filters + pin storage (unit-tested)

## Testing

- Preset filter pure functions (towered / public / public+paved / all).
- Pin add/remove/normalize + `localStorage` round-trip and corrupt-input recovery.
- Context API / filter includes new blob types and viewport clipping.
- Overlay paint respects visibility flags; ground-mode hides facility layers + highways + Class airspace.
- Manual: Layers dropdown open/close; Weather controls still work independently; pin unknown designator shows error; pin known non-towered field appears under Towered-only preset.

## Follow-ups (explicitly later)

- SIDs/STARs scoped to focused airport or selected facility (not global toggle).
- Navaids / airways.
- Optional “remember last Layers visibility” if operators want it after living with pins-only persistence.
- Facility boundary selection cards.
