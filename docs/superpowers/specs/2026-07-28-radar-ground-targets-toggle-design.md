# Radar ground targets toggle — design

**Date:** 2026-07-28  
**Status:** Approved  
**Scope:** Hide on-ground ADS-B targets outside ground mode by default, with a Declutter-menu toggle and auto on/off tied to ground-mode enter/leave.

## Problem

Busy airports (e.g. CVG) show many parked/surface targets on the overview map. Operators enter ground view to inspect the field, then zoom out and still see those ground targets cluttering the scope. Ground targets should be off when not in ground view, with an explicit way to turn them back on.

## Goals

- Default: hide `onGround` aircraft when not showing ground targets.
- Entering ground mode turns ground targets **on**.
- Leaving ground mode turns ground targets **off**.
- Manual override via Declutter popover; next enter/leave transition overwrites the override.
- Keep existing ground-mode near-field / low-alt traffic filter unchanged.

## Non-goals

- Persisting the toggle (`localStorage`) — auto enter/leave would fight stored values.
- Changing ADS-B fetch / poll behavior or radius.
- Firmware / device declutter parity for this flag.
- Filtering low-altitude airborne traffic (`altFt < 500`) outside ground mode — only `onGround === true` is gated.
- Airport-card UI changes (Ground view / Zoom out stay as today).

## Behavior

New session flag: `showGroundTargets` (default **false**).

| `showGroundTargets` | Ground mode | Visible traffic |
|---------------------|-------------|-----------------|
| off | off | Viewport traffic **excluding** `onGround` |
| on | off | Full viewport traffic (including on-ground) |
| on | on | Existing ground filter: within 6 mi of focused airport and (`onGround` or `altFt < 500`) |
| off | on | Same ground filter, then drop `onGround` (low airborne near field only) |

### Auto sync

In `syncGroundMode`, when ground mode **transitions**:

- `false → true` → set `showGroundTargets = true`, then resync aircraft.
- `true → false` → set `showGroundTargets = false`, then resync aircraft.

Manual toggle updates the flag and resyncs immediately; it is not “sticky across” the next auto transition.

### Definition of on-ground

Unchanged: ADS-B `alt_baro` or `alt_geom` string `"ground"` → `onGround: true` (existing parse path).

## UI

Extend the existing Declutter popover (same control that hosts Target / Callsign / Tag):

1. Existing **Unselected traffic** section unchanged.
2. New **Ground targets** section below it:
   - One toggle button labeled `Ground targets` with `aria-pressed` (pressed styling when on), matching declutter chip chrome.
   - Helper when off: `Hidden · shown in ground mode`
   - Helper when on: `On-ground aircraft visible`

Header button label stays `Declutter · {Mode}` (do not encode ground-targets state in the button text).

## Code touchpoints

- `visibleAircraftFor(aircraft, groundFocus, showGroundTargets)` in `RadarMap.tsx` (or a small extracted pure helper):
  1. If `!showGroundTargets`, exclude `ac.onGround === true`.
  2. If `groundFocus` is set, apply existing `GROUND_NEAR_MI` / `GROUND_MAX_ALT_FT` filter.
- `RadarMap`: state + ref for `showGroundTargets`; update from `syncGroundMode` transitions and Declutter toggle; call existing `resyncAircraft` on change.
- All current callers of `visibleAircraftFor` (map sync, scope paint, ADS-B poll status) pass the new flag.
- Unit tests for the four visibility matrix rows above.

## Persistence

None. Session default is off until ground mode (or the operator) turns it on.

## Testing

- Overview at CVG (or similar hub): no green/on-ground blips by default.
- Enter Ground view / zoom into ground mode: surface targets appear; `GROUND MODE` UI unchanged.
- Zoom out / Zoom out button: ground targets disappear; airborne remain.
- With overview visible, open Declutter → turn Ground targets on → parked aircraft appear; turn off → they disappear.
- Manual off while still in ground mode: parked targets hide; low airborne near field (if any) still follow ground filter.
- Scope mode uses the same visibility rules as map mode.
