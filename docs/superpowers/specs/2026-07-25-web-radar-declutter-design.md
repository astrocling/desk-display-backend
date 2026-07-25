# Web radar declutter — design

**Date:** 2026-07-25  
**Status:** Approved  
**Scope:** User-selectable traffic declutter on the web radar, matching the desk-display device modes, without zoom-based label suppression.

## Goals

- Offer the same three declutter modes as the device: Target / Callsign / Tag.
- Let the operator change mode from a Watchlist-style header popover.
- Always honor the chosen mode at every zoom (no “dots when zoomed out” gate).
- Persist the choice in `localStorage`.

## Non-goals

- Map-layer toggles (airports / airspace / roads)
- Demo mode
- Backend preferences API
- Changing ADS-B poll zoom limits

## Modes

| Mode | Unselected | Selected |
|------|------------|----------|
| `target` | Blip + heading vector | Full ATC-lite tag |
| `callsign` | Blip + callsign | Full ATC-lite tag |
| `tag` | Blip + dense tag (callsign + alt/speed) | Full ATC-lite tag |

Default: `tag`.

## UI

- Header button labeled `Declutter · {Mode}` opens a compact popover.
- Three exclusive chips: Target / Callsign / Tag.
- Change applies immediately and closes is optional (chips apply live; popover can stay open like a settings strip, or close on pick — prefer stay open until click-away / toggle, matching Watchlist open/close).

## Behavior notes

- Remove web `showTags` zoom/range gate (`zoom >= 8.5` / `rangeMi ≤ 25`).
- Heading vectors remain available whenever track is known (all modes, all zooms).
- Selected target always gets full tag (lines 1–3) regardless of mode.
- Status bar should reflect declutter mode rather than “dots — zoom in”.

## Persistence

- Key: `desk-display.radar.declutter`
- Values: `target` | `callsign` | `tag`
- Invalid / missing → `tag`
