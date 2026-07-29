# Comms hardware deck UX redesign

**Date:** 2026-07-29  
**Status:** Approved  
**Scope:** Web radar Comms panel only — interaction + chrome rethink. No new LiveATC mounts; no firmware.

## Goals

- Comms channel / preset taps **play audio only** — never focus or open the map airport.
- Replace list/settings feel with a **hardware radio face** (LCD now-playing, preset grid, play/stop control).
- Keep **collapsible** slim rail; collapsed preset chips **play in place** (do not expand).
- One preset **per airport**; multi-feed airports switch Tower / App / etc. via **LCD feed chips** on the expanded face.
- Tap the **already-live** preset again → **stop** (toggle).

## Non-goals

- Per-feed preset keys (DAY TWR as separate rack entries)
- Simultaneous multi-channel listen
- Expanding catalog / new mounts
- Auto-populating rack from on-screen map airports
- Removing Listen-from-card flow (keep: add session + expand + play)

## Decisions

| Topic | Choice |
|-------|--------|
| Visual direction | Hardware face (LCD + preset grid + stop/play control) |
| Implementation | Restyle + rewire existing `CommsPanel` + `useAtcRadio` + `useCommsPresets` |
| Collapsed chip tap | Play immediately; stay collapsed |
| Multi-feed | One button per airport; feed chips on expanded LCD only |
| Retap live station | Stop |
| Map coupling | Remove Comms → map focus; map may still idle-select radio when focused ICAO already on rack |
| Feed memory | Persist last feed id per ICAO in Comms presets `localStorage` |

## Behavior

| Action | Result |
|--------|--------|
| Tap preset (expanded or collapsed) | If that ICAO is live (playing/loading) → **stop**. Else select ICAO with remembered/default feed and **play**. Collapsed stays collapsed. |
| Tap LCD feed chip | Select that feed; **remember** it for the ICAO. If audio was playing/loading → continue by playing the new feed. If idle → select only (no auto-play). |
| Dedicated Play/Stop control | Existing `toggle()` for active feed (or pick preferred rack ICAO then toggle, same as today). |
| Pin ★/☆ | Expanded face only; persistence unchanged. |
| Listen on airport card | `addSession` + `setExpanded(true)` + select + play (unchanged intent). |
| Comms preset tap | **Must not** call `openAirportDetail` / map focus. |

**Feed resolution:** `lastFeedByIcao[icao]` if still a valid catalog feed for that ICAO; else `defaultFeedForIcao(icao)`.

## UI (hardware face)

### Expanded

- Dark hardware chassis (existing ATC glass tokens: `#0B0F14` / `#3D9CF0` / teal live accents).
- **LCD**: RX/LIVE or idle status, ICAO, active feed label; when multiple feeds, chip row for each feed (active chip highlighted).
- **Preset grid**: 2-column buttons (short ICAO label e.g. `DAY`); active live preset lit; pin control on each cell.
- **Play/Stop** control (button or knob-styled control — functional toggle is required; heavy skeuomorphism optional).
- Collapse control; LiveATC external link when connected; error line when needed.
- Empty rack hint unchanged in meaning.

### Collapsed

- Slim left rail with status lamp + mini preset chips (short ICAO).
- Chip tap = tune/play or stop if live; **does not** expand.
- Separate expand control (status lamp / chevron) opens the deck.

## Architecture

Keep single shared audio session. Extend presets storage for feed memory. Panel owns tune/stop orchestration.

```
AtcListenButton ──► addSession + setExpanded(true) + select + play
CommsPanel preset ──► tuneOrStop(icao)  [no map focus]
CommsPanel feed chip ──► selectFeed + rememberFeed; play if was live
CommsPanel ★/☆ ──► togglePin
RadarMap ──► drop onSelectAirport wiring into CommsPanel (or no-op prop removal)
```

### Storage (`desk-display.commsPresets.v1`)

```json
{
  "pinnedIcaos": ["KIND", "KDAY"],
  "expanded": true,
  "lastFeedByIcao": {
    "KIND": "kind9_app_dep",
    "KCMH": "kcmh1_twr"
  }
}
```

Invalid / unknown feed ids ignored on read; fall back to default feed.

### API additions (sketch)

- `commsPresets`: parse/serialize `lastFeedByIcao`; helpers `rememberFeed(icao, feedId)`, `resolvedFeedIdForIcao(icao, lastFeedByIcao)`.
- `useCommsPresets`: expose `lastFeedByIcao`, `rememberFeed(icao, feedId)`.
- `useAtcRadio.selectAirport(icao, preferredFeedId?: string)` — use preferred when valid for ICAO.
- `CommsPanel`: remove `onSelectAirport` (or stop calling it); implement `tuneOrStop` using select + play / stop.

## Testing

- Unit: parse/serialize last feeds; resolve remembered vs default; invalid feed ignored.
- Unit: tune/stop decision helper if extracted (same ICAO live → stop; else play path).
- Manual: collapsed chip play without expand; no map focus on Comms tap; feed chip switch while live; Listen still expands + plays.

## Out of scope follow-ups

- Session-only row dismiss control
- Per-feed presets if hardware face proves too limited
