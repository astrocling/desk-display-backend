# Radar airport card live traffic (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While an airport is focused on the web radar, poll ADS-B centered on that airport and show live nearby inbound/outbound traffic (counts + optional callsign chips) on `SelectionAirportCard`, classified only by route first/last ICAO.

**Architecture:** `RadarMap` already owns airport focus (`focusedAirportRef`/`focusedIcao`), the main viewport ADS-B poll (`fetchAdsb`), and bulk route lookups (`fetchRoutes` → `/api/adsb/route`, cached in `arrivalCacheRef`). Phase 2 adds a second, independent poll (`fetchAirportTraffic`) that calls the existing `/api/adsb` proxy centered on the focused airport's lat/lon at a fixed 150 nm radius, seeds routes from the same cache, runs a new pure classifier (`classifyAirportTraffic` in `airportTraffic.ts`) to bucket aircraft into inbound/outbound by first/last route ICAO, and stores the result in state that's passed into `SelectionAirportCard`'s `traffic` prop (built by Phase 1). This poll never touches the main map's `aircraftMarkersRef`/`aircraftCount` — it exists only to feed the card.

**Tech Stack:** Next.js / TypeScript, React hooks (`useState`/`useCallback`/`useEffect`/`useRef`), Vitest, existing `/api/adsb` proxy and `/api/adsb/route` bulk lookup (adsb.lol backed).

## Global Constraints

- Never invent airports, frequencies, weather, or routes; omit unknown fields.
- Web only; no paid APIs (no FlightAware AeroAPI, no schedules/ETAs, no full arrival/departure board); no firmware.
- Ground view / Zoom out / ground-mode runway overlays unchanged in behavior.
- `AIRPORT_TRAFFIC_RADIUS_NM = 150` (constant, not user-configurable), clamped to adsb.lol max **250 nm**.
- Classification is **route first/last ICAO only** — no proximity or heading heuristics. Outbound: route first ICAO equals focused airport. Inbound: route last ICAO equals focused airport. Multi-stop: still first = out / last = in. Case-normalize ICAO. Skip aircraft with empty/unknown route. Local turnaround (first === last === focused) counts as **outbound only** — never double-count.
- Poll is centered on the focused airport and is for the card only — it must **not** replace or resize the main map's viewport ADS-B markers/count.
- Display: `Inbound N · Outbound M`; also show compact callsign chips when `inbound.length + outbound.length <= 6`; label as live ADS-B nearby within the radius, explicitly **not** a schedule board.
- Traffic updates while focus is active; clears immediately when focus clears (poll stops).
- Traffic poll or route-classify failure → omit the traffic section; the rest of the card stays.
- Traffic has no persistent store — poll only while focused.

---

## Dependencies / preconditions

This plan **depends on Phase 1** (`docs/superpowers/plans/2026-07-27-radar-airport-selection-card-enrichment.md`, Task 5) already being merged onto this branch: `SelectionAirportCard` must exist as a presentational component accepting a `traffic` prop, currently wired as `traffic={null}` from `RadarMap`. This plan assumes that prop's contract is exactly:

```tsx
traffic?: {
  inbound: { callsign: string; hex: string }[];
  outbound: { callsign: string; hex: string }[];
  radiusNm: number;
} | null;
onSelectTrafficHex?: (hex: string) => void;
```

Task 3, Step 1 below verifies this contract against the real Phase 1 code before wiring real data into it. If Phase 1 landed with a different shape (different field names, missing `onSelectTrafficHex`, or no traffic section rendered yet), patch `SelectionAirportCard.tsx` in Task 3 Step 1 to match — don't change the shape defined above without updating that file's prop types and render logic together.

Before starting, confirm Phase 1 is present:

```bash
git log --oneline | grep -i "airport selection card" | head -5
grep -n "traffic" src/components/radar/SelectionAirportCard.tsx
```

If `SelectionAirportCard.tsx` doesn't exist yet, stop and implement/merge Phase 1 first.

---

## File map

| File | Role |
|------|------|
| `src/components/radar/airportTraffic.ts` | `AIRPORT_TRAFFIC_RADIUS_NM` constant, `TrafficAircraft` type, pure `classifyAirportTraffic` inbound/outbound classifier |
| `src/components/radar/airportTraffic.test.ts` | Classifier unit tests (first/last, turnaround, no-route skip, case normalize, dedupe) |
| `src/components/radar/RadarMap.tsx` | New `airportTraffic` state + `fetchAirportTraffic` poll effect; wires real traffic + chip-click into `SelectionAirportCard` |
| `src/components/radar/SelectionAirportCard.tsx` | Consumes the `traffic`/`onSelectTrafficHex` props built by Phase 1; edited only if that contract needs patching (Task 3, Step 1) |

---

### Task 1: Traffic classifier (pure)

**Files:**
- Create: `src/components/radar/airportTraffic.ts`
- Create: `src/components/radar/airportTraffic.test.ts`

**Interfaces:**
- Produces:
  - `export const AIRPORT_TRAFFIC_RADIUS_NM = 150`
  - `export type TrafficAircraft = { hex: string; callsign: string; routeIcaos?: string[] | null }`
  - `export type AirportTrafficClassification = { inbound: TrafficAircraft[]; outbound: TrafficAircraft[] }`
  - `export function classifyAirportTraffic(focusedIcao: string, aircraft: TrafficAircraft[]): AirportTrafficClassification`
- Consumed by: Task 2 (`RadarMap.tsx`)

- [ ] **Step 1: Write failing tests**

Create `src/components/radar/airportTraffic.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  AIRPORT_TRAFFIC_RADIUS_NM,
  classifyAirportTraffic,
  type TrafficAircraft,
} from "./airportTraffic";

describe("AIRPORT_TRAFFIC_RADIUS_NM", () => {
  it("is 150 nm", () => {
    expect(AIRPORT_TRAFFIC_RADIUS_NM).toBe(150);
  });
});

describe("classifyAirportTraffic", () => {
  it("classifies first ICAO as outbound and last ICAO as inbound", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "a1", callsign: "AAL1", routeIcaos: ["KDFW", "KDAY"] },
      { hex: "b2", callsign: "AAL2", routeIcaos: ["KDAY", "KORD"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.inbound.map((a) => a.hex)).toEqual(["a1"]);
    expect(result.outbound.map((a) => a.hex)).toEqual(["b2"]);
  });

  it("keeps first=out / last=in for multi-stop routes", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "c3", callsign: "UAL3", routeIcaos: ["KDAY", "KORD", "KSEA"] },
      { hex: "d4", callsign: "UAL4", routeIcaos: ["KSEA", "KORD", "KDAY"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.outbound.map((a) => a.hex)).toEqual(["c3"]);
    expect(result.inbound.map((a) => a.hex)).toEqual(["d4"]);
  });

  it("counts a local turnaround as outbound only, never both", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "t1", callsign: "JIA1", routeIcaos: ["KDAY", "KDAY"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.outbound.map((a) => a.hex)).toEqual(["t1"]);
    expect(result.inbound).toHaveLength(0);
  });

  it("skips aircraft with missing or empty routes", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "n1", callsign: "N123AB", routeIcaos: null },
      { hex: "n2", callsign: "N456CD", routeIcaos: [] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.inbound).toHaveLength(0);
    expect(result.outbound).toHaveLength(0);
  });

  it("does not classify unrelated routes", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "u1", callsign: "SWA1", routeIcaos: ["KMDW", "KSTL"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.inbound).toHaveLength(0);
    expect(result.outbound).toHaveLength(0);
  });

  it("normalizes ICAO case and whitespace before comparing", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "l1", callsign: "AAL5", routeIcaos: [" kdfw ", " kday "] },
    ];
    const result = classifyAirportTraffic(" kday ", aircraft);
    expect(result.inbound.map((a) => a.hex)).toEqual(["l1"]);
  });

  it("deduplicates by hex, keeping one entry per aircraft", () => {
    const aircraft: TrafficAircraft[] = [
      { hex: "dup1", callsign: "DAL1", routeIcaos: ["KDAY", "KATL"] },
      { hex: "dup1", callsign: "DAL1", routeIcaos: ["KDAY", "KATL"] },
    ];
    const result = classifyAirportTraffic("KDAY", aircraft);
    expect(result.outbound).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/components/radar/airportTraffic.test.ts`
Expected: FAIL — `Cannot find module './airportTraffic'` (file doesn't exist yet).

- [ ] **Step 3: Implement the classifier**

Create `src/components/radar/airportTraffic.ts`:

```ts
/** Live nearby traffic radius for the focused airport card (nm). Not user-configurable. */
export const AIRPORT_TRAFFIC_RADIUS_NM = 150;

export type TrafficAircraft = {
  hex: string;
  callsign: string;
  /** Ordered ICAO chain from route lookup; null/empty when unknown. */
  routeIcaos?: string[] | null;
};

export type AirportTrafficClassification = {
  inbound: TrafficAircraft[];
  outbound: TrafficAircraft[];
};

function normalizeIcao(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Classify nearby aircraft as inbound/outbound of `focusedIcao` using only the
 * route's first/last ICAO — no proximity or heading heuristics. A local
 * turnaround (first === last === focused) counts as outbound only, so an
 * aircraft is never double-counted. Aircraft with missing/empty routes are
 * skipped rather than guessed at.
 */
export function classifyAirportTraffic(
  focusedIcao: string,
  aircraft: TrafficAircraft[],
): AirportTrafficClassification {
  const focus = normalizeIcao(focusedIcao);
  const inboundByHex = new Map<string, TrafficAircraft>();
  const outboundByHex = new Map<string, TrafficAircraft>();

  for (const ac of aircraft) {
    const route = ac.routeIcaos;
    if (!route || route.length === 0) continue;
    const first = normalizeIcao(route[0] ?? "");
    const last = normalizeIcao(route[route.length - 1] ?? "");
    if (!first || !last) continue;

    if (first === focus) {
      outboundByHex.set(ac.hex, ac);
    } else if (last === focus) {
      inboundByHex.set(ac.hex, ac);
    }
  }

  return {
    inbound: Array.from(inboundByHex.values()),
    outbound: Array.from(outboundByHex.values()),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/components/radar/airportTraffic.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/airportTraffic.ts src/components/radar/airportTraffic.test.ts
git commit -m "feat: classify airport inbound and outbound traffic"
```

---

### Task 2: Airport-centered traffic poll in `RadarMap`

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`

**Interfaces:**
- Consumes: `AIRPORT_TRAFFIC_RADIUS_NM`, `TrafficAircraft`, `classifyAirportTraffic` (Task 1); already-present `ADSB_MIN_NM`/`ADSB_MAX_NM`/`clamp` (from `./geo`), `ADSB_POLL_MS`, `parseAdsbAircraft`, `normalizeCallsign`, `arrivalCacheRef`, `fetchRoutes`, `focusedAirportRef`, `focusedIcao`, `clearAirportFocus` (all already defined in this file)
- Produces: `airportTraffic: AirportTrafficState` (React state), consumed by Task 3

This task has no isolated unit test — `RadarMap.tsx` is a client component with no existing direct test file (`airportTraffic.test.ts` already covers the risky classification logic). Verification here is manual sanity + the existing suite staying green.

Note: this file's line numbers shift once Phase 1 lands (it replaces the inline airport footer JSX around what is today ~line 2002). The insertion points below are all **above** that region and are anchored by surrounding code/function names rather than exact line numbers, since Phase 1 doesn't touch these areas.

- [ ] **Step 1: Import the classifier**

Add to the import block near the top of `RadarMap.tsx` (alongside the existing `./radarFormat` import):

```ts
import {
  AIRPORT_TRAFFIC_RADIUS_NM,
  classifyAirportTraffic,
  type TrafficAircraft,
} from "./airportTraffic";
```

- [ ] **Step 2: Add traffic state types next to `FocusedAirport`**

Find:

```ts
type FocusedAirport = {
  icao: string;
  name: string;
  lat: number;
  lon: number;
};
```

Add immediately after it:

```ts
type AirportTrafficChip = { callsign: string; hex: string };

type AirportTrafficState = {
  inbound: AirportTrafficChip[];
  outbound: AirportTrafficChip[];
  radiusNm: number;
} | null;
```

- [ ] **Step 3: Add a ref + state for the poll**

Find the ref block that includes `focusedAirportRef`:

```ts
const focusedAirportRef = useRef<FocusedAirport | null>(null);
```

Add immediately after it:

```ts
/** Guards against a stale traffic response landing after focus changed/cleared. */
const airportTrafficGenerationRef = useRef(0);
```

Find the state block that includes `airportError`:

```ts
const [airportError, setAirportError] = useState<string | null>(null);
```

Add immediately after it:

```ts
const [airportTraffic, setAirportTraffic] =
  useState<AirportTrafficState>(null);
```

- [ ] **Step 4: Add the `fetchAirportTraffic` poll function**

Add this right after the closing of the existing `fetchAdsb` callback (the `}, [clearAircraftMarkers, fetchRoutes, overlaysActive, readViewport, syncAircraftMarkers]);` block) and before `fetchTfrs`:

```ts
/**
 * Poll ADS-B centered on the focused airport (not the viewport) so the
 * selection card can show live nearby inbound/outbound. Never touches the
 * main map's aircraft markers or count.
 */
const fetchAirportTraffic = useCallback(async () => {
  const focus = focusedAirportRef.current;
  if (!focus) return;
  const generation = ++airportTrafficGenerationRef.current;
  const dist = clamp(AIRPORT_TRAFFIC_RADIUS_NM, ADSB_MIN_NM, ADSB_MAX_NM);

  try {
    const res = await fetch(
      `/api/adsb?lat=${focus.lat}&lon=${focus.lon}&dist=${dist}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      if (generation === airportTrafficGenerationRef.current) {
        setAirportTraffic(null);
      }
      return;
    }
    const json = await res.json();
    const aircraft = parseAdsbAircraft(json);
    for (const ac of aircraft) {
      const route = arrivalCacheRef.current.get(
        normalizeCallsign(ac.callsign),
      );
      if (route) ac.routeIcaos = route.routeIcaos;
    }
    // Resolve routes we don't have cached yet; next poll tick will see them.
    void fetchRoutes(aircraft);

    if (
      generation !== airportTrafficGenerationRef.current ||
      focusedAirportRef.current?.icao !== focus.icao
    ) {
      return; // focus changed/cleared or a newer poll is in flight
    }

    const trafficAircraft: TrafficAircraft[] = aircraft.map((ac) => ({
      hex: ac.hex,
      callsign: ac.callsign,
      routeIcaos: ac.routeIcaos,
    }));
    const { inbound, outbound } = classifyAirportTraffic(
      focus.icao,
      trafficAircraft,
    );
    setAirportTraffic({
      inbound: inbound.map((a) => ({ callsign: a.callsign, hex: a.hex })),
      outbound: outbound.map((a) => ({ callsign: a.callsign, hex: a.hex })),
      radiusNm: AIRPORT_TRAFFIC_RADIUS_NM,
    });
  } catch {
    if (generation === airportTrafficGenerationRef.current) {
      setAirportTraffic(null);
    }
  }
}, [fetchRoutes]);
```

- [ ] **Step 5: Poll while focused, stop and clear on close**

Find the existing interval effect for the main ADS-B poll:

```ts
useEffect(() => {
  const id = setInterval(() => {
    void fetchAdsb();
  }, ADSB_POLL_MS);
  return () => clearInterval(id);
}, [fetchAdsb]);
```

Add a new effect immediately after it:

```ts
useEffect(() => {
  if (!focusedIcao) {
    setAirportTraffic(null);
    return;
  }
  void fetchAirportTraffic();
  const id = setInterval(() => {
    void fetchAirportTraffic();
  }, ADSB_POLL_MS);
  return () => clearInterval(id);
}, [focusedIcao, fetchAirportTraffic]);
```

- [ ] **Step 6: Clear traffic immediately on focus close**

Find:

```ts
const clearAirportFocus = useCallback(() => {
  focusedAirportRef.current = null;
  runwaysRef.current = [];
  setFocusedIcao(null);
  setAirportDetail(null);
  setAirportError(null);
  syncGroundMode();
  redrawOverlays();
}, [redrawOverlays, syncGroundMode]);
```

Replace with:

```ts
const clearAirportFocus = useCallback(() => {
  focusedAirportRef.current = null;
  runwaysRef.current = [];
  airportTrafficGenerationRef.current++;
  setFocusedIcao(null);
  setAirportDetail(null);
  setAirportError(null);
  setAirportTraffic(null);
  syncGroundMode();
  redrawOverlays();
}, [redrawOverlays, syncGroundMode]);
```

(Bumping the generation here ensures an in-flight `fetchAirportTraffic` response from before the close can't repopulate `airportTraffic` after the user closed the card.)

- [ ] **Step 7: Manual sanity**

Run the dev server, focus a towered airport that has live traffic (a busy hub is easiest to verify against). Open browser devtools → Network and confirm:
- A new `/api/adsb?lat=...&dist=150` request fires immediately on focus and again every ~10s.
- The main viewport's aircraft count/markers are unaffected by this request (only the original viewport-radius `/api/adsb` calls change those).
- Closing the airport card stops the 150 nm requests and the interval.

- [ ] **Step 8: Run tests + lint (regression)**

Run: `npm test`
Expected: PASS (no regressions; `airportTraffic.test.ts` still passes)

Run: `npx eslint src/components/radar/RadarMap.tsx src/components/radar/airportTraffic.ts`
Expected: no new errors

- [ ] **Step 9: Commit**

```bash
git add src/components/radar/RadarMap.tsx
git commit -m "feat: poll airport-centered ADS-B traffic while airport is focused"
```

---

### Task 3: Wire live traffic into `SelectionAirportCard`

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`
- Modify: `src/components/radar/SelectionAirportCard.tsx` (only if Step 1 finds the contract needs patching)

**Interfaces:**
- Consumes: `airportTraffic` state (Task 2), `AirportDetailResponse`, existing `aircraftMarkersRef`, `lastAircraftRef`, `selectAircraftRef` (all already in `RadarMap.tsx`)
- Produces: real `traffic` + `onSelectTrafficHex` props flowing into `SelectionAirportCard`

- [ ] **Step 1: Verify the Phase 1 contract**

Read `src/components/radar/SelectionAirportCard.tsx` and confirm its props include:

```tsx
traffic?: {
  inbound: { callsign: string; hex: string }[];
  outbound: { callsign: string; hex: string }[];
  radiusNm: number;
} | null;
onSelectTrafficHex?: (hex: string) => void;
```

and that it renders a traffic section (counts always when `traffic` has any inbound/outbound; chips only when `inbound.length + outbound.length <= 6`; a caption noting it's live ADS-B within `radiusNm` nm, not a schedule board).

- **If it matches:** skip to Step 2, no changes needed to `SelectionAirportCard.tsx`.
- **If it's missing or shaped differently:** patch `SelectionAirportCard.tsx` so the traffic block (placed after the frequencies section, before actions, per the design spec's card layout) looks like:

```tsx
{traffic && (traffic.inbound.length > 0 || traffic.outbound.length > 0) ? (
  <div className="mt-2 border-t border-[#3D9CF0]/20 pt-2">
    <div className="font-mono text-xs text-[#3D9CF0]">
      Inbound {traffic.inbound.length} · Outbound {traffic.outbound.length}
    </div>
    <div className="text-[10px] text-[#6B7280]">
      live ADS-B · {traffic.radiusNm} nm
    </div>
    {traffic.inbound.length + traffic.outbound.length <= 6 ? (
      <div className="mt-1 flex flex-wrap gap-1">
        {[...traffic.outbound, ...traffic.inbound].map((chip) => (
          <button
            key={chip.hex}
            type="button"
            onClick={() => onSelectTrafficHex?.(chip.hex)}
            className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-[#C8D0D8] hover:bg-slate-700"
          >
            {chip.callsign || chip.hex}
          </button>
        ))}
      </div>
    ) : null}
  </div>
) : null}
```

Ensure the component's prop type includes `traffic` and `onSelectTrafficHex` exactly as shown above (add them to the existing props destructure/type if missing).

- [ ] **Step 2: Add a chip-click handler in `RadarMap`**

Add this near `clearAirportFocus` (or any other callback that references `selectAircraftRef`/`aircraftMarkersRef`/`lastAircraftRef`):

```ts
/** Chip click on the airport card: select the aircraft if it's currently known, else no-op. */
const selectAirportTrafficHex = useCallback((hex: string) => {
  const entry = aircraftMarkersRef.current.get(hex);
  if (entry) {
    selectAircraftRef.current(entry.ac);
    return;
  }
  const ac = lastAircraftRef.current.find((candidate) => candidate.hex === hex);
  if (ac) selectAircraftRef.current(ac);
}, []);
```

- [ ] **Step 3: Pass real traffic data into the card**

Find the `<SelectionAirportCard .../>` usage that Phase 1 added (search for `traffic={null}`):

```tsx
<SelectionAirportCard
  detail={airportDetail}
  groundMode={groundMode}
  onClose={clearAirportFocus}
  onEnterGround={enterGroundView}
  onExitGround={exitGroundView}
  traffic={null}
/>
```

Replace with:

```tsx
<SelectionAirportCard
  detail={airportDetail}
  groundMode={groundMode}
  onClose={clearAirportFocus}
  onEnterGround={enterGroundView}
  onExitGround={exitGroundView}
  traffic={airportTraffic}
  onSelectTrafficHex={selectAirportTrafficHex}
/>
```

- [ ] **Step 4: Manual sanity**

Focus an airport with live traffic and confirm: the card shows `Inbound N · Outbound M`; when the total is ≤ 6, callsign chips appear; clicking a chip for an aircraft currently visible on the map selects it (the aircraft selection card appears); clicking a chip for an aircraft not currently tracked is a silent no-op (no crash). Close the airport card and confirm the traffic section disappears. Confirm ground mode, Ground view, and Zoom out still behave exactly as before.

- [ ] **Step 5: Run tests + lint**

Run: `npm test`
Expected: PASS

Run: `npx eslint src/components/radar/RadarMap.tsx src/components/radar/SelectionAirportCard.tsx`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/components/radar/RadarMap.tsx src/components/radar/SelectionAirportCard.tsx
git commit -m "feat: show live nearby inbound and outbound on airport card"
```

---

### Task 4: Verify and self-review against spec

- [ ] **Step 1: Run full unit suite**

Run: `npm test`
Expected: PASS (or only pre-existing failures unrelated to this work — fix any new failures before proceeding)

- [ ] **Step 2: Lint all touched paths**

Run: `npx eslint src/components/radar/airportTraffic.ts src/components/radar/RadarMap.tsx src/components/radar/SelectionAirportCard.tsx`
Expected: no new errors

- [ ] **Step 3: Spec coverage checklist**

Confirm each Phase 2 requirement from `docs/superpowers/specs/2026-07-27-radar-airport-selection-card-enrichment-design.md` maps to a completed task:

| Spec requirement | Covered by |
|---|---|
| Poll ADS-B centered on the focused airport (not the viewport) | Task 2, Step 4 (`fetchAirportTraffic` uses `focus.lat`/`focus.lon`) |
| Default radius 150 nm, clamped to adsb.lol max 250 nm | Task 1 (`AIRPORT_TRAFFIC_RADIUS_NM = 150`); Task 2, Step 4 (`clamp(..., ADSB_MIN_NM, ADSB_MAX_NM)`) |
| Classify via route first/last ICAO only, no proximity/heading guessing | Task 1 (`classifyAirportTraffic`) |
| Multi-stop: first = out / last = in | Task 1 test "keeps first=out / last=in for multi-stop routes" |
| Case-normalized ICAO comparison | Task 1 test "normalizes ICAO case and whitespace" |
| Skip aircraft with empty/unknown route | Task 1 test "skips aircraft with missing or empty routes" |
| Local turnaround counts as outbound only, no double-count | Task 1 test "counts a local turnaround as outbound only" |
| Do not replace/resize viewport map ADS-B markers or count | Task 2, Step 4 (`fetchAirportTraffic` never calls `syncAircraftMarkers`/`setAircraftCount`); verified manually in Task 2, Step 7 |
| Card shows `Inbound N · Outbound M` | Task 3, Step 1 |
| Chips shown only when total ≤ 6 | Task 3, Step 1 |
| Labeled as live ADS-B within N nm, not a schedule board | Task 3, Step 1 (`live ADS-B · {radiusNm} nm` caption) |
| Update while focus active; clear on focus clear | Task 2, Steps 5–6 |
| Traffic poll/classify failure omits section, rest of card stays | Task 2, Step 4 (`catch` sets `airportTraffic` to `null`; detail/runways/freqs are independent state) |
| No paid arrival/departure boards | Global Constraints; only `/api/adsb` + `/api/adsb/route` used anywhere in this plan |
| Optional: clickable traffic chips → aircraft select | Task 3, Steps 2–4 |

- [ ] **Step 4: Placeholder scan**

Confirm this plan file contains no "TBD"/"implement later"/"add appropriate handling"-style placeholders and that every code step above is copy-pasteable as written (re-read Tasks 1–3 if in doubt).

- [ ] **Step 5: Final commit only if verify fixed anything**

If Steps 1–2 required any fixes, commit them:

```bash
git add -A
git commit -m "fix: address regressions found in phase 2 traffic verification"
```

Otherwise, Phase 2 is done.
