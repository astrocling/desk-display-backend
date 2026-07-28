# Web radar Comms / radio panel redesign

**Date:** 2026-07-28  
**Status:** Approved  
**Scope:** Collapsible, preset-capable Comms panel with modern ATC-glass theming; Listen from the airport card adds to a session rack and opens the panel. Web radar only; no firmware; no new LiveATC mounts.

## Goals

- Make the Comms panel **collapsible** so the map stays usable on desktop and mobile.
- Support a **quick-switcher rack** of airports to listen to.
- Distinguish **ephemeral listen** (session only) from **pinned presets** (persist across visits).
- From the airport detail card, **Listen** should put that airport on the Comms rack, start audio, and expand the panel.
- Restyle the panel as a cohesive **modern ATC glass** radio deck (same radar chrome tokens), not a generic overlay list.

## Non-goals

- Adding LiveATC feeds beyond the existing curated catalog (`KDAY`, `KIND`, `KCMH`, `KCVG`)
- Mapping OurAirports frequency MHz values to stream mounts
- Multi-channel / simultaneous listen
- Firmware LVGL radio UI
- Auto-populating the rack from on-screen map airports

## Decisions (from brainstorm)

| Topic | Choice |
|-------|--------|
| Persistence | Pins in `localStorage`; Listen alone does **not** persist |
| Listen from card | Add to session + play + expand panel |
| Pin UX | ★ / ☆ on each Comms list row (and available whenever the row is shown) |
| Collapsed chrome | Left **edge rail** (desktop + phone) |
| Visual theme | **Modern ATC glass** (blue accent / glass / existing tokens) |
| Implementation approach | Extend current `CommsPanel` + `useAtcRadio`; add `useCommsPresets` |

## Architecture

Keep a single shared audio session (`useAtcRadio`). Add a thin presets layer for rack membership and collapse UI state.

```
AtcListenButton ──► useCommsPresets.addSession + setExpanded(true)
                 └► useAtcRadio.selectAirport + play

CommsPanel ★/☆ ──► useCommsPresets.togglePin
CommsPanel rail ──► useCommsPresets.setExpanded
CommsPanel row  ──► useAtcRadio.selectAirport (+ Play/Stop via existing controls)

RadarMap owns both hooks and wires them into CommsPanel + SelectionAirportCard
```

### Data model

| Layer | Lifetime | Behavior |
|-------|----------|----------|
| Session rack | Until tab close / refresh | ICAOs added by **Listen** only in this pass |
| Pinned presets | `localStorage` | Explicitly starred ICAOs only |
| Audio | Existing `useAtcRadio` | One active ICAO/feed; play / stop / error |

**Merged list for UI:** pinned first, then session-only; deduped by ICAO. Each entry: `{ icao, pinned, session }`.

**Allowlist:** only catalog ICAOs (`isCatalogIcao`) may appear in the rack or be pinned. Non-catalog airports keep no Listen button (unchanged).

**Collapse memory:** persist `expanded` boolean in `localStorage` (same presets storage module). First visit default: **collapsed** (map-first, especially on mobile); remember the user’s last choice afterward.

### `useCommsPresets` API

- `entries` — merged list for the panel
- `addSession(icao)` — normalize ICAO; no-op if not catalog
- `togglePin(icao)` — add/remove pin; pinned ICAOs remain in `entries` even with `session: false`
- `removeSession(icao)` — drop session membership; pin alone keeps the row (helper for tests / future UI; no remove control required this pass)
- `expanded` / `setExpanded(boolean)`
- Storage failures: degrade to in-memory only; never throw into the map UI

### Storage shape (illustrative)

```json
{
  "pinnedIcaos": ["KIND", "KDAY"],
  "expanded": true
}
```

Key name under a single namespaced key (e.g. `desk-display.commsPresets.v1`).

## UI

### Collapsed — edge rail

- Slim left strip (~28–36px on phone, slightly wider on desktop).
- Radio / play affordance and stacked preset indicators (active + pinned highlighted).
- Tap rail (or play control) expands the panel.
- Does not replace Play/Stop semantics when already playing; rail remains a one-tap path back to the deck.

### Expanded — ATC glass panel

Left-docked panel growing from the rail:

1. **Header** — “Comms” + collapse control  
2. **Active readout** — active ICAO and feed label (no MHz / frequency readout in this pass)  
3. **Preset list** — row per entry: ICAO, ★/☆, active styling  
4. **Feed picker** — existing `<select>` when multiple feeds; single label otherwise  
5. **Play / Stop** + status (“Connecting…”, “Listening via LiveATC”) + external LiveATC link  
6. **Error** — existing error string styling when stream fails  

Visual tokens stay aligned with radar chrome: bg `#0B0F14`, accent `#3D9CF0`, dim `#6B7280`, body `#C8D0D8`, glass/`backdrop-blur`, blue ring. Prefer monospace for ICAO / status. No vintage amber or OLED-green theme in this pass.

### Empty state

If `entries` is empty: rail still renders; expanded body shows a short empty hint — e.g. “Listen from an airport card or pin a preset.”

### Listen → panel flow

When the user activates **Listen** on `SelectionAirportCard` / `AtcListenButton` for a catalog ICAO that is not the currently playing airport:

1. `addSession(icao)`
2. `selectAirport(icao)` + `play()` (keep today’s “switch airport always starts play” behavior)
3. `setExpanded(true)`

If already the active playing airport, existing toggle Stop behavior remains.

### Behavior changes vs today

- Comms list is **no longer** `on-screen towered ∩ catalog`. On-screen presence does not auto-add airports.
- Map focus on a catalog airport does **not** auto-add to the rack, expand the panel, or start audio. If that ICAO is already in `entries` and audio is idle, the panel may still call `selectAirport` for feed convenience (same as today’s idle auto-select), but focus alone never grows the rack.
- Remove the `airportsOnScreen` → membership coupling from `CommsPanel`. Drop the prop if unused after the refactor.

### Preset row interaction

- Tap ICAO / row body: `selectAirport` (existing rule: selecting while playing stops; does not auto-play).
- Tap ★/☆: `togglePin` only (does not change playback by itself).
- Play/Stop: existing `useAtcRadio` controls operate on the active selection.

## File plan

| File | Change |
|------|--------|
| `src/components/radar/useCommsPresets.ts` | **New** — session + pins + expanded; localStorage |
| `src/components/radar/useCommsPresets.test.ts` | **New** — merge order, pin/session rules, storage degrade |
| `src/components/radar/CommsPanel.tsx` | Collapse rail, glass layout, bind presets, drop on-screen list driver |
| `src/components/radar/AtcListenButton.tsx` | Accept presets hooks / callbacks; session + expand on Listen |
| `src/components/radar/SelectionAirportCard.tsx` | Pass through any new Listen wiring props if needed |
| `src/components/radar/RadarMap.tsx` | Own `useCommsPresets`; wire to panel + card |
| `src/components/radar/useAtcRadio.ts` | Unchanged unless a tiny seam helps (prefer no change) |
| `src/lib/atc/feeds.ts` | Unchanged catalog / allowlist |

Prefer extracting small presentational helpers inside `CommsPanel` (rail vs body) if the file grows, rather than a full RadioDeck rewrite.

## Edge cases

- **Non-catalog ICAO:** no Listen; cannot add or pin.
- **Unpin:** if also in session, row remains as session-only; if not in session, row leaves `entries`.
- **Refresh:** session rack cleared; pins restored; audio idle.
- **Duplicate Listen:** `addSession` is idempotent; still ensures expand + play rules above.
- **Storage quota / private mode:** pins and expanded preference stay in memory for the session.
- **One audio element:** Comms and card continue to share `useAtcRadio`.

## Testing

- Unit: merge order (pinned before session-only); dedupe; `togglePin` / `addSession` / `removeSession`; catalog guard; JSON parse failure → empty pins.
- Unit or component-light: Listen path invokes session add + expand (mock radio).
- Manual: collapse/expand on narrow viewport; pin survives reload; Listen-only airport does not survive reload; Play/Stop and feed switch still work; empty state copy.

## Success criteria

- Panel collapses to a usable left edge rail on mobile and desktop without blocking the map.
- User can pin airports and switch among them quickly after reload.
- Listen from the airport card places the airport on the rack, starts audio, and opens the panel — without implying a saved preset until starred.
- Panel reads as modern ATC glass and matches existing radar color tokens.
