# Radar Ident — design

**Date:** 2026-07-28  
**Status:** Approved  
**Scope:** Ephemeral find-aid: type a squawk or callsign fragment; matching flights highlight; best match is selected.

## Problem

When listening to ATC, the operator hears a callsign fragment or squawk and needs to find that aircraft on a busy scope quickly. There is no lightweight search — only click selection and a persistent watchlist.

## Goals

- Single Ident query matches **either** squawk **or** callsign (substring / contains).
- Matching non-selected aircraft get a dedicated Ident highlight color; non-matches unchanged.
- Always select the **best** match when ≥1 match exists.
- Always-visible Ident field in the radar header; `/` focuses it.
- Session-only — no persistence.

## Non-goals

- Persisting the query (`localStorage` or URL).
- Separate Squawk / Callsign mode toggle.
- Dimming or hiding non-matches.
- Matching registration (N-number) unless it already appears in the displayed callsign.
- Firmware / device declutter parity.
- Changing ADS-B fetch behavior.

## Behavior

### Query

- Trimmed string; empty → no Ident highlight; do not change selection solely because Ident cleared (keep the open card so the operator can keep reading).
- Comparison is case-insensitive.
- Squawk side: compare digits-only forms of query and `squawk` (substring contains).
- Callsign side: normalize like existing `normalizeCallsign` (trim, upper, strip whitespace); match if callsign **contains** the normalized query.

### Best match (selected when ≥1 match)

1. Prefer aircraft whose squawk **exactly equals** the query interpreted as a 4-digit squawk when the query is numeric:
   - Length 1–2: pad with leading zeros to 4 digits (e.g. `75` → `0075`).
   - Length 3: exact only if it starts with `0` (e.g. `075` → `0075`); bare 3-digit queries like `475` are substring-only (no exact preference).
   - Length ≥4: compare digit strings as-is (pad only when length &lt;4).
2. Otherwise (or among those preferred), pick closest to the **current map viewport center** (haversine).
3. Stable tie-break: lower `hex` string wins.

### Highlight precedence (mark / tag color)

1. Selected → existing white (`COLORS.selected`)
2. Emergency notable → existing alert red
3. Ident match (non-selected) → `COLORS.ident` (cyan `#22D3EE`)
4. Else existing ground / notable / watchlist / default path unchanged

### Lifecycle

- Session only; refresh clears Ident.
- Clear: empty the field, clear (×) control, or Escape while Ident input is focused.
- Clearing stops Ident highlighting; leaves current selection as-is.

## UI

- Always-visible control in the top radar chrome, near Declutter / Watchlist:
  - Label or placeholder: Ident
  - Mono input, placeholder e.g. `squawk / callsign`
  - Clear button when non-empty
- Keyboard: `/` focuses the Ident input when focus is not already in an editable field (`input`, `textarea`, `select`, or `contenteditable`).
- Do not steal `/` when typing elsewhere in a form control.

## Architecture

- Pure helpers in `src/components/radar/identMatch.ts` (match + rank) with unit tests.
- `RadarMap` owns `identQuery` state + ref, header input, `/` listener, and wires Ident into `updateAircraftEl` / marker sync / auto-select after visible traffic updates and on query change.
- Reuse existing `selectAircraftRef` for selection; no watchlist API changes.

## Testing

- Unit tests for match rules (squawk digits, callsign substring, empty query).
- Unit tests for best-match ranking (exact squawk preferred, then distance, then hex).
- Manual: type partial callsign heard on radio → match highlights + card opens; type `1200` → VFR squawk hits; Escape clears highlight.

## Persistence

None.
