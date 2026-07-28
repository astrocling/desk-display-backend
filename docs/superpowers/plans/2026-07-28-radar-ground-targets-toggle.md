# Radar Ground Targets Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide on-ground ADS-B targets by default outside ground mode, auto-enable them when entering ground mode / disable when leaving, and expose a Declutter-menu toggle for manual override.

**Architecture:** Extract `visibleAircraftFor` into a pure helper that gates `onGround` via `showGroundTargets` and still applies the existing near-field/low-alt ground-mode filter. `RadarMap` owns session state + ref, syncs the flag on ground-mode transitions, and adds a toggle in the Declutter popover.

**Tech Stack:** React (Next.js), MapLibre markers, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-radar-ground-targets-toggle-design.md`
- Do **not** persist `showGroundTargets` in `localStorage`
- Gate only `onGround === true`; do not hide low-altitude airborne traffic outside ground mode
- Keep `GROUND_NEAR_MI = 6` and `GROUND_MAX_ALT_FT = 500` behavior unchanged
- Declutter button label stays `Declutter · {Mode}` (no ground-targets encoding)
- No airport-card, API, or firmware changes

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/radar/visibleAircraft.ts` | Pure visibility filter + ground-mode constants used by the filter |
| `src/components/radar/visibleAircraft.test.ts` | Unit tests for the four visibility matrix rows |
| `src/components/radar/RadarMap.tsx` | State/ref, `syncGroundMode` auto sync, wire all `visibleAircraftFor` callers, Declutter UI toggle |

---

### Task 1: Pure `visibleAircraftFor` helper + tests

**Files:**
- Create: `src/components/radar/visibleAircraft.ts`
- Create: `src/components/radar/visibleAircraft.test.ts`
- Modify: `src/components/radar/RadarMap.tsx` (re-export constants / replace local filter — minimal wire so tests pass against shared helper; full state wiring is Task 2)

**Interfaces:**
- Consumes: `haversineMiles` from `src/components/radar/geo.ts`
- Produces:
  - `GROUND_NEAR_MI: 6`
  - `GROUND_MAX_ALT_FT: 500`
  - `type GroundFocus = { lat: number; lon: number }`
  - `type VisibleAircraftInput = { onGround?: boolean; altFt: number \| null; lat: number; lon: number }`
  - `visibleAircraftFor<T extends VisibleAircraftInput>(aircraft: T[], ground: GroundFocus \| null, showGroundTargets: boolean): T[]`

- [ ] **Step 1: Write the failing tests**

Create `src/components/radar/visibleAircraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { visibleAircraftFor } from "./visibleAircraft";

type Ac = {
  hex: string;
  onGround?: boolean;
  altFt: number | null;
  lat: number;
  lon: number;
};

const FIELD = { lat: 39.0488, lon: -84.6678 }; // CVG-ish

function ac(partial: Partial<Ac> & Pick<Ac, "hex">): Ac {
  return {
    onGround: false,
    altFt: 5000,
    lat: FIELD.lat,
    lon: FIELD.lon,
    ...partial,
  };
}

const parked = ac({ hex: "gnd1", onGround: true, altFt: 0 });
const lowNear = ac({ hex: "low1", onGround: false, altFt: 400 });
const highNear = ac({ hex: "hi1", onGround: false, altFt: 3000 });
const parkedFar = ac({
  hex: "gndFar",
  onGround: true,
  altFt: 0,
  lat: FIELD.lat + 0.2, // ~14 mi north
  lon: FIELD.lon,
});

const all = [parked, lowNear, highNear, parkedFar];

describe("visibleAircraftFor", () => {
  it("overview + ground targets off: drops onGround only", () => {
    const out = visibleAircraftFor(all, null, false);
    expect(out.map((a) => a.hex).sort()).toEqual(["hi1", "low1"]);
  });

  it("overview + ground targets on: returns all", () => {
    const out = visibleAircraftFor(all, null, true);
    expect(out.map((a) => a.hex).sort()).toEqual([
      "gnd1",
      "gndFar",
      "hi1",
      "low1",
    ]);
  });

  it("ground mode + ground targets on: near low/onGround only", () => {
    const out = visibleAircraftFor(all, FIELD, true);
    expect(out.map((a) => a.hex).sort()).toEqual(["gnd1", "low1"]);
  });

  it("ground mode + ground targets off: near low airborne only", () => {
    const out = visibleAircraftFor(all, FIELD, false);
    expect(out.map((a) => a.hex)).toEqual(["low1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bruceclingan/Projects/desk-display-backend && npm test -- src/components/radar/visibleAircraft.test.ts`

Expected: FAIL (module not found / `visibleAircraftFor` not defined)

- [ ] **Step 3: Implement the helper**

Create `src/components/radar/visibleAircraft.ts`:

```ts
import { haversineMiles } from "./geo";

export const GROUND_NEAR_MI = 6;
export const GROUND_MAX_ALT_FT = 500;

export type GroundFocus = {
  lat: number;
  lon: number;
};

export type VisibleAircraftInput = {
  onGround?: boolean;
  altFt: number | null;
  lat: number;
  lon: number;
};

/**
 * Filter map/scope traffic.
 * 1. When showGroundTargets is false, drop onGround aircraft.
 * 2. When ground focus is set, keep only surface/low targets within GROUND_NEAR_MI.
 */
export function visibleAircraftFor<T extends VisibleAircraftInput>(
  aircraft: T[],
  ground: GroundFocus | null,
  showGroundTargets: boolean,
): T[] {
  let list = aircraft;
  if (!showGroundTargets) {
    list = list.filter((ac) => ac.onGround !== true);
  }
  if (!ground) return list;
  return list.filter((ac) => {
    const low =
      ac.onGround === true ||
      (ac.altFt != null && ac.altFt < GROUND_MAX_ALT_FT);
    if (!low) return false;
    return (
      haversineMiles(ground.lat, ground.lon, ac.lat, ac.lon) <= GROUND_NEAR_MI
    );
  });
}
```

- [ ] **Step 4: Point RadarMap at the shared helper (compat pass-through)**

In `src/components/radar/RadarMap.tsx`:

1. Add import:

```ts
import {
  GROUND_MAX_ALT_FT,
  GROUND_NEAR_MI,
  visibleAircraftFor,
} from "./visibleAircraft";
```

2. Remove the local `GROUND_NEAR_MI`, `GROUND_MAX_ALT_FT` constants (keep `GROUND_ZOOM_MIN`, `GROUND_VIEW_ZOOM`, `DEFAULT_MAP_ZOOM`).

3. Delete the local `visibleAircraftFor` function.

4. Update every call site to pass `true` as the third arg for now (preserves today’s “always show ground” behavior until Task 2):

```ts
visibleAircraftFor(
  aircraft,
  groundModeRef.current ? focusedAirportRef.current : null,
  true,
);
```

There are four call sites today: `syncAircraftMarkers`, `paintScopeAircraft`, `resyncAircraft` (scope branch), and the ADS-B poll path that builds `visible` for status/count. Update all four.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/bruceclingan/Projects/desk-display-backend && npm test -- src/components/radar/visibleAircraft.test.ts`

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/bruceclingan/Projects/desk-display-backend
git add src/components/radar/visibleAircraft.ts src/components/radar/visibleAircraft.test.ts src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: extract visibleAircraftFor with ground-target gate

EOF
)"
```

---

### Task 2: Wire `showGroundTargets` state + auto sync on ground mode

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`

**Interfaces:**
- Consumes: `visibleAircraftFor(..., showGroundTargets)` from Task 1
- Produces:
  - `showGroundTargetsRef: RefObject<boolean>` (default `false`)
  - `showGroundTargets` React state (default `false`) for UI
  - `setShowGroundTargets(next: boolean)` updates ref + state + `resyncAircraft()`
  - `syncGroundMode` sets the flag on enter (`true`) / leave (`false`) before `resyncAircraft()`

- [ ] **Step 1: Add state + ref next to existing ground mode state**

Near `groundModeRef` / `groundMode` (~lines 580–607):

```ts
const showGroundTargetsRef = useRef(false);
const [showGroundTargets, setShowGroundTargetsState] = useState(false);
```

Add setter that keeps ref/state in sync and resyncs markers:

```ts
const setShowGroundTargets = useCallback((next: boolean) => {
  if (next === showGroundTargetsRef.current) return;
  showGroundTargetsRef.current = next;
  setShowGroundTargetsState(next);
  resyncAircraft();
}, [resyncAircraft]);
```

Place this **after** `resyncAircraft` is defined (or use a ref for resync if ordering requires it — follow the existing `syncAircraftMarkersRef` pattern if a cycle appears). Prefer defining `setShowGroundTargets` after `resyncAircraft`.

- [ ] **Step 2: Pass the ref into all `visibleAircraftFor` call sites**

Replace the temporary `true` third argument with `showGroundTargetsRef.current` at all four sites:

```ts
visibleAircraftFor(
  aircraft /* or lastAircraftRef.current */,
  groundModeRef.current ? focusedAirportRef.current : null,
  showGroundTargetsRef.current,
);
```

- [ ] **Step 3: Auto-sync inside `syncGroundMode`**

Update `syncGroundMode` so that on a real transition it also sets the ground-targets flag:

```ts
const syncGroundMode = useCallback(() => {
  const map = mapRef.current;
  const focus = focusedAirportRef.current;
  const next = !!focus && !!map && map.getZoom() >= GROUND_ZOOM_MIN;
  if (next === groundModeRef.current) return;
  groundModeRef.current = next;
  setGroundMode(next);
  // Auto: enter → on, leave → off (overwrites manual override).
  showGroundTargetsRef.current = next;
  setShowGroundTargetsState(next);
  if (map) applyBasemapForGround(map, next);
  redrawOverlays();
  resyncAircraft();
}, [redrawOverlays, resyncAircraft]);
```

Do **not** call `setShowGroundTargets` here (that would double-resync); set ref + state directly, then the existing `resyncAircraft()` at the end handles markers.

- [ ] **Step 4: Smoke-check TypeScript**

Run: `cd /Users/bruceclingan/Projects/desk-display-backend && npx tsc --noEmit`

Expected: no errors from these changes.

- [ ] **Step 5: Commit**

```bash
cd /Users/bruceclingan/Projects/desk-display-backend
git add src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: auto-toggle ground targets with ground mode

EOF
)"
```

---

### Task 3: Declutter popover Ground targets toggle

**Files:**
- Modify: `src/components/radar/RadarMap.tsx` (Declutter popover JSX ~1985–2018)

**Interfaces:**
- Consumes: `showGroundTargets` state + `setShowGroundTargets` from Task 2
- Produces: Declutter popover section labeled **Ground targets** with `aria-pressed` toggle

- [ ] **Step 1: Add the Ground targets section to the Declutter popover**

Inside the popover `div` (after the Unselected traffic mode list), add:

```tsx
<div className="mt-3 border-t border-slate-700 pt-3">
  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
    Ground targets
  </div>
  <button
    type="button"
    onClick={() => setShowGroundTargets(!showGroundTargets)}
    className={`w-full rounded px-2.5 py-1.5 text-left text-sm ${
      showGroundTargets
        ? "bg-emerald-600 font-medium text-white"
        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
    }`}
    aria-pressed={showGroundTargets}
  >
    Ground targets
    <span className="mt-0.5 block text-xs font-normal text-slate-300/80">
      {showGroundTargets
        ? "On-ground aircraft visible"
        : "Hidden · shown in ground mode"}
    </span>
  </button>
</div>
```

Leave the header button as:

```tsx
Declutter · {radarDeclutterShortLabel(declutter)}
```

- [ ] **Step 2: Manual verification checklist**

Run `npm run dev` and confirm:

1. Overview at a busy field (CVG): no green/on-ground blips by default.
2. Focus airport → Ground view / zoom ≥ 12.5: surface targets appear; GROUND MODE chip still shows.
3. Zoom out / Zoom out button: ground targets disappear; airborne remain.
4. Declutter → turn Ground targets on at overview: parked aircraft appear; turn off: they disappear.
5. In ground mode, manually turn Ground targets off: parked hide; any low airborne near field can remain.
6. Scope mode follows the same visibility rules.

- [ ] **Step 3: Run unit tests**

Run: `cd /Users/bruceclingan/Projects/desk-display-backend && npm test -- src/components/radar/visibleAircraft.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/bruceclingan/Projects/desk-display-backend
git add src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: add ground targets toggle to declutter menu

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Default hide `onGround` outside ground targets flag | Task 1 + 2 (default `false`) |
| Enter ground mode → on | Task 2 `syncGroundMode` |
| Leave ground mode → off | Task 2 `syncGroundMode` |
| Manual Declutter override | Task 3 |
| Next transition overwrites override | Task 2 (sets flag on every transition) |
| Keep near-field / low-alt filter | Task 1 |
| No persistence | Task 2 (session state only) |
| Only gate `onGround`, not low airborne outside ground mode | Task 1 tests |
| Declutter button label unchanged | Task 3 |
| Four visibility matrix rows tested | Task 1 |
| Map + scope callers updated | Task 2 |

No placeholders remaining. Types (`GroundFocus`, `showGroundTargets`, `visibleAircraftFor` third arg) are consistent across tasks.
