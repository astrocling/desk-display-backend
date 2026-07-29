# Comms panel visual redesign (manage presets + transport bar)

**Date:** 2026-07-29  
**Status:** Approved  
**Scope:** Web radar `CommsPanel` chrome and pin UX only. Listen/tune behavior from the hardware-deck spec remains; no new LiveATC mounts; no firmware.

## Goals

- Fix visual bugs from the hardware-face pass (overflowing “Connecting” on a circular control, unusable pin badges, cramped competing chrome).
- Move pinning into a dedicated **Manage presets** mode so station keys stay listen-only.
- Replace the side Play/Stop knob with a **full-width transport bar**.
- Keep existing audio behavior: tap-to-play/stop, no map focus, collapsed play-in-place, LCD feed chips, last-feed memory.

## Non-goals

- Changing `useAtcRadio` / `decideCommsTune` / feed-memory APIs
- Per-feed preset keys
- Pinning airports that are not already on the rack (still: Listen → session, then pin in manage)
- Persisting manage-mode open/closed
- Collapsed-rail pin UI

## Decisions

| Topic | Choice |
|-------|--------|
| Implementation | Restyle `CommsPanel` only (Approach 1) |
| Pin UX | Manage presets mode via **Presets** / **Done** under the station area |
| Transport | Full-width transport bar (icon + label + subtitle) |
| Manage state | Component-local `useState`; exit manage on collapse |
| Behavior | Unchanged from `2026-07-29-comms-hardware-deck-design.md` |

## Layout

### Normal (listen) mode — top to bottom

1. Header: `COMMS` + collapse
2. **LCD**: status (`IDLE` / `Connecting…` / `RX · LIVE`), ICAO, single feed label or multi-feed chips
3. **Transport bar** (full width): icon (`▶` / `■` / `…`) + short label (`Play` / `Stop` / `Connecting`) + subtitle (active ICAO · feed when known); tap = existing play/stop toggle
4. **Station grid**: clean 2-column keys; tap = `handleTune`; **no** pin overlays
5. **Presets** text control → enter manage mode
6. LiveATC link when connected (playing/loading with `listenUrl`)

### Manage mode

- LCD remains (identity / feed chips still usable)
- Transport bar remains (so audio can always be stopped)
- Station area becomes **full-width rows**: ICAO + large ★/☆ control (≥24×24px hit target)
- Pin/unpin calls `togglePin` only — does **not** tune or play
- Footer control becomes **Done** (exits manage)
- Collapse while managing: collapse panel and **clear** manage mode

### Collapsed rail

Unchanged intent: status lamp expands; chips call `handleTune` only (play in place, no expand); no pin UI.

## Visual constraints

- No circular control that embeds status words (root cause of “CONNECTING” overflow)
- Soften key glows; prefer border/fill over heavy bloom
- Existing ATC tokens (`#0B0F14`, `#3D9CF0`, muted grays)
- Panel may widen slightly (~240px) so the transport bar breathes

## Architecture

```
CommsPanel
  managingPresets: boolean (local)
  Normal: LCD → Transport → key grid → Presets
  Manage: LCD → Transport → pin rows → Done
  Handlers (unchanged): handleTune, handleFeedChip, handleTogglePlay, togglePin
```

No changes required to `RadarMap`, `useAtcRadio`, `useCommsPresets`, or `commsTune` beyond what already shipped.

## Testing

- Manual: normal tune/stop; transport stop while connecting; Presets → pin/unpin with large targets; Done returns to clean keys; collapse clears manage; collapsed chip still plays in place; no map focus on Comms taps
- Existing unit tests for `commsTune` / `commsPresets` remain green (no logic change expected)

## Relationship to prior spec

Supersedes the **UI chrome / pin placement** portions of `docs/superpowers/specs/2026-07-29-comms-hardware-deck-design.md`. Audio interaction and feed-memory rules from that spec still apply.
