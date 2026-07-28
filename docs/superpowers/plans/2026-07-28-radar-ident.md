# Radar Ident Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ephemeral Ident find-aid: type a squawk or callsign fragment to highlight matches and auto-select the best match on the radar.

**Architecture:** Pure `identMatch` helpers (match + rank) with Vitest coverage. `RadarMap` owns session Ident query state, paints matches with `COLORS.ident`, auto-selects the best match after traffic sync / query change, and exposes an always-visible header field plus `/` to focus it.

**Tech Stack:** React (Next.js), MapLibre markers, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-radar-ident-design.md`
- Do **not** persist Ident query in `localStorage` or URL
- Match **either** squawk (digits-only contains) **or** callsign (normalized contains) — no mode toggle
- Highlight non-matches unchanged; Ident color only on matches
- Color precedence: selected → emergency → Ident match → existing ground/notable/watchlist/default
- `COLORS.ident` must be `#22D3EE`
- Clearing Ident removes highlight but **keeps** current selection
- Keyboard shortcut is `/` only when focus is not in an editable field
- No ADS-B API, watchlist, or firmware changes

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/radar/identMatch.ts` | Pure match + best-match ranking |
| `src/components/radar/identMatch.test.ts` | Unit tests for match/rank |
| `src/components/radar/radarFormat.ts` | Add `COLORS.ident` |
| `src/components/radar/RadarMap.tsx` | State/ref, paint, auto-select, header UI, `/` shortcut |

---

### Task 1: Pure `identMatch` helpers + tests

**Files:**
- Create: `src/components/radar/identMatch.ts`
- Create: `src/components/radar/identMatch.test.ts`

**Interfaces:**
- Consumes: `haversineMiles` from `src/components/radar/geo.ts`
- Produces:
  - `normalizeIdentQuery(raw: string): string` — trim + upper + strip whitespace
  - `digitsOnly(raw: string): string` — keep `0-9` only
  - `type IdentAircraft = { hex: string; callsign: string; squawk: string; lat: number; lon: number }`
  - `type IdentCenter = { lat: number; lon: number }`
  - `aircraftMatchesIdent(ac: IdentAircraft, query: string): boolean` — empty normalized query → false; else true if digits-only squawk contains digits-only query (when query has ≥1 digit) **OR** normalized callsign contains normalized query. When the normalized query has no digits, squawk-substring is skipped (callsign path only). When the query is digits-only after normalize, still also check callsign contains.
  - `isExactSquawkMatch(ac: IdentAircraft, query: string): boolean` — true when digits-only query is non-empty and equals `digitsOnly(ac.squawk)` after padding the query digits to length 4 with leading zeros (e.g. `"75"` → `"0075"`). If query digits length > 4, compare without padding (exact digit string equality only).
  - `pickBestIdentMatch<T extends IdentAircraft>(matches: T[], center: IdentCenter, query: string): T | null` — empty → null; else prefer exact squawk matches; among remaining pool pick min `haversineMiles`; tie-break lower `hex`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/radar/identMatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  aircraftMatchesIdent,
  isExactSquawkMatch,
  normalizeIdentQuery,
  pickBestIdentMatch,
} from "./identMatch";

type Ac = {
  hex: string;
  callsign: string;
  squawk: string;
  lat: number;
  lon: number;
};

const CENTER = { lat: 39.05, lon: -84.67 };

function ac(partial: Partial<Ac> & Pick<Ac, "hex">): Ac {
  return {
    callsign: "N123AB",
    squawk: "1200",
    lat: CENTER.lat,
    lon: CENTER.lon,
    ...partial,
  };
}

describe("normalizeIdentQuery", () => {
  it("trims, uppercases, strips spaces", () => {
    expect(normalizeIdentQuery("  aa l 529 ")).toBe("AAL529");
  });
});

describe("aircraftMatchesIdent", () => {
  it("empty query matches nothing", () => {
    expect(aircraftMatchesIdent(ac({ hex: "a" }), "")).toBe(false);
    expect(aircraftMatchesIdent(ac({ hex: "a" }), "   ")).toBe(false);
  });

  it("matches callsign substring", () => {
    const a = ac({ hex: "a", callsign: "AAL529" });
    expect(aircraftMatchesIdent(a, "529")).toBe(true);
    expect(aircraftMatchesIdent(a, "aal")).toBe(true);
    expect(aircraftMatchesIdent(a, "UAL")).toBe(false);
  });

  it("matches squawk digit substring", () => {
    const a = ac({ hex: "a", squawk: "0475", callsign: "N1" });
    expect(aircraftMatchesIdent(a, "475")).toBe(true);
    expect(aircraftMatchesIdent(a, "0475")).toBe(true);
    expect(aircraftMatchesIdent(a, "1200")).toBe(false);
  });

  it("matches if either field hits", () => {
    const a = ac({ hex: "a", callsign: "SWA100", squawk: "7700" });
    expect(aircraftMatchesIdent(a, "SWA")).toBe(true);
    expect(aircraftMatchesIdent(a, "7700")).toBe(true);
  });
});

describe("isExactSquawkMatch", () => {
  it("pads numeric query to 4 digits", () => {
    const a = ac({ hex: "a", squawk: "0075" });
    expect(isExactSquawkMatch(a, "75")).toBe(true);
    expect(isExactSquawkMatch(a, "0075")).toBe(true);
    expect(isExactSquawkMatch(a, "075")).toBe(true);
  });

  it("false for non-exact squawk", () => {
    const a = ac({ hex: "a", squawk: "0475" });
    expect(isExactSquawkMatch(a, "475")).toBe(false);
  });
});

describe("pickBestIdentMatch", () => {
  it("returns null when no matches", () => {
    expect(pickBestIdentMatch([], CENTER, "529")).toBeNull();
  });

  it("prefers exact squawk over nearer callsign-only match", () => {
    const nearCallsign = ac({
      hex: "near",
      callsign: "XYZ75",
      squawk: "1200",
      lat: CENTER.lat,
      lon: CENTER.lon,
    });
    const farExact = ac({
      hex: "far",
      callsign: "N9",
      squawk: "0075",
      lat: CENTER.lat + 0.5,
      lon: CENTER.lon,
    });
    const best = pickBestIdentMatch([nearCallsign, farExact], CENTER, "75");
    expect(best?.hex).toBe("far");
  });

  it("among non-exact, picks closest then lower hex", () => {
    const far = ac({
      hex: "b",
      callsign: "AAL529",
      squawk: "1200",
      lat: CENTER.lat + 0.2,
      lon: CENTER.lon,
    });
    const nearHighHex = ac({
      hex: "c",
      callsign: "UAL529",
      squawk: "1200",
      lat: CENTER.lat + 0.01,
      lon: CENTER.lon,
    });
    const nearLowHex = ac({
      hex: "a",
      callsign: "DAL529",
      squawk: "1200",
      lat: CENTER.lat + 0.01,
      lon: CENTER.lon,
    });
    const best = pickBestIdentMatch(
      [far, nearHighHex, nearLowHex],
      CENTER,
      "529",
    );
    expect(best?.hex).toBe("a");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/radar/identMatch.test.ts`

Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement `identMatch.ts`**

Create `src/components/radar/identMatch.ts`:

```ts
import { haversineMiles } from "./geo";

export type IdentAircraft = {
  hex: string;
  callsign: string;
  squawk: string;
  lat: number;
  lon: number;
};

export type IdentCenter = { lat: number; lon: number };

export function normalizeIdentQuery(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function paddedSquawkDigits(queryDigits: string): string {
  if (!queryDigits) return "";
  if (queryDigits.length >= 4) return queryDigits;
  return queryDigits.padStart(4, "0");
}

export function isExactSquawkMatch(
  ac: IdentAircraft,
  query: string,
): boolean {
  const qDigits = digitsOnly(normalizeIdentQuery(query));
  if (!qDigits) return false;
  const squawkDigits = digitsOnly(ac.squawk);
  if (!squawkDigits) return false;
  return squawkDigits === paddedSquawkDigits(qDigits);
}

export function aircraftMatchesIdent(
  ac: IdentAircraft,
  query: string,
): boolean {
  const q = normalizeIdentQuery(query);
  if (!q) return false;

  const cs = normalizeIdentQuery(ac.callsign);
  if (cs.includes(q)) return true;

  const qDigits = digitsOnly(q);
  if (!qDigits) return false;
  const squawkDigits = digitsOnly(ac.squawk);
  return squawkDigits.includes(qDigits);
}

export function pickBestIdentMatch<T extends IdentAircraft>(
  matches: T[],
  center: IdentCenter,
  query: string,
): T | null {
  if (matches.length === 0) return null;

  const exact = matches.filter((m) => isExactSquawkMatch(m, query));
  const pool = exact.length > 0 ? exact : matches;

  let best: T | null = null;
  let bestDist = Infinity;
  for (const m of pool) {
    const d = haversineMiles(center.lat, center.lon, m.lat, m.lon);
    if (
      !best ||
      d < bestDist - 1e-9 ||
      (Math.abs(d - bestDist) <= 1e-9 && m.hex < best.hex)
    ) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/radar/identMatch.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/identMatch.ts src/components/radar/identMatch.test.ts
git commit -m "$(cat <<'EOF'
feat: add pure Ident match and rank helpers

EOF
)"
```

---

### Task 2: Paint Ident matches + auto-select in `RadarMap`

**Files:**
- Modify: `src/components/radar/radarFormat.ts` — add `ident: "#22D3EE"` to `COLORS`
- Modify: `src/components/radar/RadarMap.tsx` — Ident query ref/state, color path, auto-select after sync

**Interfaces:**
- Consumes: `aircraftMatchesIdent`, `pickBestIdentMatch` from `./identMatch`
- Produces (internal to RadarMap):
  - `identQueryRef` + `identQuery` state (session string, default `""`)
  - After painting visible aircraft (map sync and scope path that already refreshes selection), if `identQueryRef` non-empty: collect visible matches, `pickBestIdentMatch(..., map.getCenter(), query)`, call `selectAircraftRef.current(best)` when best exists
  - `updateAircraftEl` / callers pass whether the aircraft matches Ident; color uses precedence from Global Constraints

- [ ] **Step 1: Add `COLORS.ident`**

In `src/components/radar/radarFormat.ts`, inside `COLORS`:

```ts
  ident: "#22D3EE",
```

- [ ] **Step 2: Thread Ident into `updateAircraftEl`**

Change `updateAircraftEl` signature to accept `identMatched: boolean` (after `selected` or at end — keep call sites consistent).

Color resolution:

```ts
  const notable = notableFor(ac, interestingEntries);
  const onGround = ac.onGround === true;
  let color: string;
  if (selected) {
    color = COLORS.selected;
  } else if (notable === "emergency") {
    color = COLORS.alert;
  } else if (identMatched) {
    color = COLORS.ident;
  } else if (onGround && notable === "none") {
    color = COLORS.ground;
  } else {
    color = markColorFor(notable, false, entry?.color);
  }
```

Update every `updateAircraftEl(...)` call to pass:

```ts
aircraftMatchesIdent(ac, identQueryRef.current)
```

(or the `ac` in that call site). Add `identQueryRef` initialized to `""` alongside other refs; keep a `useState` mirror only if needed for UI in Task 3 — for this task a ref is enough if you also add a no-op setter path, but prefer adding both `identQuery` state and `identQueryRef` now so Task 3 only builds the input.

Helper used after sync:

```ts
function applyIdentSelection(map: MapLibreMap, visible: AircraftPoint[]) {
  const q = identQueryRef.current;
  if (!normalizeIdentQuery(q)) return;
  const matches = visible.filter((a) => aircraftMatchesIdent(a, q));
  const center = map.getCenter();
  const best = pickBestIdentMatch(
    matches,
    { lat: center.lat, lon: center.lng },
    q,
  );
  if (best) selectAircraftRef.current(best);
}
```

Call `applyIdentSelection` at the end of `syncAircraftMarkers` (and the scope-mode paint path that updates the same visible set — mirror wherever selection is refreshed from the latest poll today).

When Ident query becomes empty via a future setter, do **not** clear selection.

- [ ] **Step 3: Run radar unit tests**

Run: `npm test -- src/components/radar`

Expected: existing tests still PASS (Ident helpers included)

- [ ] **Step 4: Commit**

```bash
git add src/components/radar/radarFormat.ts src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: highlight and auto-select Ident matches on radar

EOF
)"
```

---

### Task 3: Ident header field + `/` focus shortcut

**Files:**
- Modify: `src/components/radar/RadarMap.tsx` — header UI + keyboard listener; wire query setter to refresh marks + apply Ident selection

**Interfaces:**
- Consumes: Task 2 Ident state/ref + `applyIdentSelection` / marker refresh
- Produces: always-visible Ident input near Declutter; `/` focuses it

- [ ] **Step 1: Query setter that refreshes paint + selection**

```ts
const setIdentQuery = useCallback((raw: string) => {
  identQueryRef.current = raw;
  setIdentQueryState(raw);
  refreshAircraftLabels();
  const map = mapRef.current;
  if (map) {
    const visible = visibleAircraftFor(
      lastAircraftRef.current,
      groundModeRef.current ? focusedAirportRef.current : null,
      showGroundTargetsRef.current,
    );
    applyIdentSelection(map, visible);
  }
}, [refreshAircraftLabels]);
```

Ensure `refreshAircraftLabels` / `updateAircraftEl` still read `identQueryRef` for match coloring.

When clearing to `""`, skip selection changes (only refresh labels).

- [ ] **Step 2: Header UI**

Place a compact Ident control in the top controls row near Declutter (same `pointer-events-auto` chrome):

```tsx
<div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-slate-900/85 px-2 py-1 shadow-lg backdrop-blur">
  <label htmlFor="radar-ident" className="text-xs font-medium uppercase tracking-wide text-slate-400">
    Ident
  </label>
  <input
    ref={identInputRef}
    id="radar-ident"
    type="text"
    value={identQueryState}
    onChange={(e) => setIdentQuery(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIdentQuery("");
        (e.target as HTMLInputElement).blur();
      }
    }}
    placeholder="squawk / callsign"
    spellCheck={false}
    autoComplete="off"
    aria-label="Ident squawk or callsign"
    className="w-36 rounded bg-slate-800 px-2 py-1 font-mono text-sm uppercase outline-none ring-cyan-500/40 focus:ring"
  />
  {identQueryState ? (
    <button
      type="button"
      onClick={() => setIdentQuery("")}
      className="text-xs text-slate-400 hover:text-slate-200"
      aria-label="Clear Ident"
    >
      ×
    </button>
  ) : null}
</div>
```

- [ ] **Step 3: `/` shortcut**

```ts
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLElement) {
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }
    }
    e.preventDefault();
    identInputRef.current?.focus();
    identInputRef.current?.select();
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, []);
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/radar`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: add Ident header field and slash focus shortcut

EOF
)"
```

---

## Self-review (plan)

1. Spec coverage: match either field, highlight color + precedence, best-match ranking, session-only, header + `/`, clear keeps selection — Tasks 1–3.
2. No placeholders.
3. Types consistent: `IdentAircraft`, `pickBestIdentMatch`, `COLORS.ident` `#22D3EE`.
