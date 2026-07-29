# Comms Hardware Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire and restyle the web radar Comms panel into a hardware radio deck: tap-to-play/stop presets, no map focus, LCD feed chips, collapsed play-in-place, last-feed memory.

**Architecture:** Extend `commsPresets` storage + `useCommsPresets` for `lastFeedByIcao`; teach `useAtcRadio.selectAirport` an optional preferred feed; extract a small pure `tuneOrStop` helper; restyle `CommsPanel` and remove map-focus wiring from `RadarMap`.

**Tech Stack:** Next.js App Router, React client components, Vitest, existing LiveATC HTML5 audio via `useAtcRadio`.

**Spec:** `docs/superpowers/specs/2026-07-29-comms-hardware-deck-design.md`

## Global Constraints

- Web radar only — do not touch firmware.
- Do not add LiveATC mounts or change catalog ICAOs beyond existing `ATC_FEEDS`.
- Comms preset taps must never open/focus the map airport.
- Collapsed chip tap must not expand the panel.
- One preset per airport; multi-feed switching only via expanded LCD chips.
- Tap live preset again → stop.
- Storage key remains `desk-display.commsPresets.v1` (additive `lastFeedByIcao` field).
- Follow TDD: failing test → implement → pass → commit per task.
- Run tests with `npm test` (vitest run) scoped to touched test files when noted.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/radar/commsPresets.ts` | Parse/serialize + feed memory helpers |
| `src/components/radar/commsPresets.test.ts` | Unit tests for storage / resolve |
| `src/components/radar/commsTune.ts` | Pure tune-or-stop decision |
| `src/components/radar/commsTune.test.ts` | Decision tests |
| `src/components/radar/useCommsPresets.ts` | Expose rememberFeed / lastFeedByIcao |
| `src/components/radar/useAtcRadio.ts` | `selectAirport(icao, preferredFeedId?)` |
| `src/components/radar/CommsPanel.tsx` | Hardware UI + tune/stop / feed chips |
| `src/components/radar/RadarMap.tsx` | Stop passing map focus into Comms |

---

### Task 1: Feed memory in `commsPresets`

**Files:**
- Modify: `src/components/radar/commsPresets.ts`
- Modify: `src/components/radar/commsPresets.test.ts`

**Interfaces:**
- Produces:
  - `CommsPresetsStored` gains `lastFeedByIcao: Record<string, string>`
  - `parseCommsPresetsStored` / `serializeCommsPresetsStored` round-trip it
  - `resolvedFeedIdForIcao(icao: string, lastFeedByIcao: Record<string, string>): string | undefined` — remembered id if `getFeedById` matches that ICAO; else `defaultFeedForIcao(icao)?.id`
  - `sanitizeLastFeedByIcao(raw: unknown): Record<string, string>` — catalog-valid pairs only

- [ ] **Step 1: Write failing tests**

Extend `commsPresets.test.ts`:

```ts
import { getFeedById, defaultFeedForIcao } from "@/lib/atc/feeds";
import {
  parseCommsPresetsStored,
  serializeCommsPresetsStored,
  resolvedFeedIdForIcao,
  sanitizeLastFeedByIcao,
} from "./commsPresets";

describe("lastFeedByIcao storage", () => {
  it("defaults to empty map", () => {
    expect(parseCommsPresetsStored(null)).toEqual({
      pinnedIcaos: [],
      expanded: false,
      lastFeedByIcao: {},
    });
  });

  it("round-trips lastFeedByIcao and drops invalid feeds", () => {
    const raw = JSON.stringify({
      pinnedIcaos: ["KIND"],
      expanded: true,
      lastFeedByIcao: {
        KIND: "kind9_app_dep",
        KDAY: "not-a-real-feed",
        KFFO: "kind9_twr",
      },
    });
    const parsed = parseCommsPresetsStored(raw);
    expect(parsed.lastFeedByIcao).toEqual({ KIND: "kind9_app_dep" });
    expect(
      parseCommsPresetsStored(serializeCommsPresetsStored(parsed)).lastFeedByIcao,
    ).toEqual({ KIND: "kind9_app_dep" });
  });
});

describe("resolvedFeedIdForIcao", () => {
  it("prefers remembered feed for that ICAO", () => {
    expect(
      resolvedFeedIdForIcao("KIND", { KIND: "kind9_app_dep" }),
    ).toBe("kind9_app_dep");
  });

  it("falls back to default when missing or mismatched", () => {
    expect(resolvedFeedIdForIcao("KIND", {})).toBe(
      defaultFeedForIcao("KIND")!.id,
    );
    expect(
      resolvedFeedIdForIcao("KIND", { KIND: "kday" }),
    ).toBe(defaultFeedForIcao("KIND")!.id);
  });
});

describe("sanitizeLastFeedByIcao", () => {
  it("keeps only catalog feed ids owned by the ICAO key", () => {
    expect(
      sanitizeLastFeedByIcao({
        kind: "kind9_app_dep",
        KDAY: "kind9_twr",
        junk: 1,
      }),
    ).toEqual({ KIND: "kind9_app_dep" });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/components/radar/commsPresets.test.ts`  
Expected: FAIL (missing exports / shape).

- [ ] **Step 3: Implement**

In `commsPresets.ts`:

- Import `defaultFeedForIcao`, `getFeedById`, `normalizeCatalogIcao` already present via `isCatalogIcao` path — add feed imports from `@/lib/atc/feeds`.
- Extend `CommsPresetsStored` with `lastFeedByIcao: Record<string, string>`.
- Implement `sanitizeLastFeedByIcao`, `resolvedFeedIdForIcao`.
- Update `parseCommsPresetsStored` default + parse path to include sanitized `lastFeedByIcao`.
- Update `serializeCommsPresetsStored` to write sanitized map.
- Update any existing tests that assert exact parse objects to include `lastFeedByIcao: {}`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/components/radar/commsPresets.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/commsPresets.ts src/components/radar/commsPresets.test.ts
git commit -m "$(cat <<'EOF'
feat(comms): persist last ATC feed per airport

EOF
)"
```

---

### Task 2: Pure `tuneOrStop` helper

**Files:**
- Create: `src/components/radar/commsTune.ts`
- Create: `src/components/radar/commsTune.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CommsTuneAction =
    | { type: "stop" }
    | { type: "play"; icao: string; feedId: string };

  export function decideCommsTune(args: {
    targetIcao: string;
    activeIcao: string | null;
    status: "idle" | "loading" | "playing" | "error";
    lastFeedByIcao: Record<string, string>;
  }): CommsTuneAction | null;
  ```
  - Returns `null` if `targetIcao` is not catalog (via `normalizeCatalogIcao` / `resolvedFeedIdForIcao`).
  - If normalized target === activeIcao AND status is `playing` or `loading` → `{ type: "stop" }`.
  - Else → `{ type: "play", icao, feedId }` using `resolvedFeedIdForIcao`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { decideCommsTune } from "./commsTune";
import { defaultFeedForIcao } from "@/lib/atc/feeds";

describe("decideCommsTune", () => {
  it("stops when retapping the live airport", () => {
    expect(
      decideCommsTune({
        targetIcao: "KIND",
        activeIcao: "KIND",
        status: "playing",
        lastFeedByIcao: {},
      }),
    ).toEqual({ type: "stop" });
  });

  it("plays remembered feed when switching airports", () => {
    expect(
      decideCommsTune({
        targetIcao: "KIND",
        activeIcao: "KDAY",
        status: "playing",
        lastFeedByIcao: { KIND: "kind9_app_dep" },
      }),
    ).toEqual({
      type: "play",
      icao: "KIND",
      feedId: "kind9_app_dep",
    });
  });

  it("plays default when idle with no memory", () => {
    expect(
      decideCommsTune({
        targetIcao: "kday",
        activeIcao: null,
        status: "idle",
        lastFeedByIcao: {},
      }),
    ).toEqual({
      type: "play",
      icao: "KDAY",
      feedId: defaultFeedForIcao("KDAY")!.id,
    });
  });

  it("returns null for non-catalog", () => {
    expect(
      decideCommsTune({
        targetIcao: "KFFO",
        activeIcao: null,
        status: "idle",
        lastFeedByIcao: {},
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- src/components/radar/commsTune.test.ts`

- [ ] **Step 3: Implement `commsTune.ts`**

```ts
import { normalizeCatalogIcao, resolvedFeedIdForIcao } from "./commsPresets";
import type { AtcRadioStatus } from "./useAtcRadio";

export type CommsTuneAction =
  | { type: "stop" }
  | { type: "play"; icao: string; feedId: string };

export function decideCommsTune(args: {
  targetIcao: string;
  activeIcao: string | null;
  status: AtcRadioStatus;
  lastFeedByIcao: Record<string, string>;
}): CommsTuneAction | null {
  const icao = normalizeCatalogIcao(args.targetIcao);
  if (!icao) return null;

  const live =
    args.status === "playing" || args.status === "loading";
  if (live && args.activeIcao === icao) {
    return { type: "stop" };
  }

  const feedId = resolvedFeedIdForIcao(icao, args.lastFeedByIcao);
  if (!feedId) return null;
  return { type: "play", icao, feedId };
}
```

Avoid circular imports: if importing `AtcRadioStatus` from the hook is awkward, inline the union string type in `commsTune.ts` instead.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/commsTune.ts src/components/radar/commsTune.test.ts
git commit -m "$(cat <<'EOF'
feat(comms): add tune-or-stop decision helper

EOF
)"
```

---

### Task 3: Wire feed memory into `useCommsPresets` + preferred feed on `selectAirport`

**Files:**
- Modify: `src/components/radar/useCommsPresets.ts`
- Modify: `src/components/radar/useAtcRadio.ts`
- Optional test: extend or add a small pure test only if you extract feed pick logic; do not require React hook tests.

**Interfaces:**
- Produces `CommsPresets`:
  - `lastFeedByIcao: Record<string, string>`
  - `rememberFeed(icao: string, feedId: string): void` — no-op if feed not for ICAO; persists via existing write path
- Produces `AtcRadio.selectAirport(icao: string, preferredFeedId?: string): void` — if `preferredFeedId` resolves via `getFeedById` to that ICAO, use it; else `defaultFeedForIcao`.

- [ ] **Step 1: Update `useCommsPresets`**

- State: `lastFeedByIcao` hydrated from `readStored()`.
- Persist `lastFeedByIcao` in `writeStored` / `serializeCommsPresetsStored`.
- `rememberFeed`: normalize ICAO; verify `getFeedById(feedId)?.icao === icao`; set map.

- [ ] **Step 2: Update `useAtcRadio.selectAirport`**

```ts
const selectAirport = useCallback(
  (icao: string, preferredFeedId?: string) => {
    const upper = icao.trim().toUpperCase();
    if (!isCatalogIcao(upper)) return;

    const wasPlaying =
      statusRef.current === "playing" || statusRef.current === "loading";
    if (wasPlaying) stop();

    const preferred = preferredFeedId
      ? getFeedById(preferredFeedId)
      : undefined;
    const feed =
      preferred && preferred.icao === upper
        ? preferred
        : defaultFeedForIcao(upper);

    feedIdRef.current = feed?.id ?? null;
    setActiveIcao(upper);
    setActiveFeedId(feed?.id ?? null);
    setError(null);
  },
  [stop],
);
```

- [ ] **Step 3: Smoke-run existing related tests**

Run: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/commsTune.test.ts src/components/radar/atcListenActions.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/radar/useCommsPresets.ts src/components/radar/useAtcRadio.ts
git commit -m "$(cat <<'EOF'
feat(comms): remember feeds and prefer them on select

EOF
)"
```

---

### Task 4: Decouple map focus + tune/stop interactions in `CommsPanel` (behavior before polish)

**Files:**
- Modify: `src/components/radar/CommsPanel.tsx`
- Modify: `src/components/radar/RadarMap.tsx` (remove `onSelectAirport` / `selectCommsAirport` prop wiring if unused)

**Interfaces:**
- Consumes: `decideCommsTune`, `presets.lastFeedByIcao`, `presets.rememberFeed`, `radio.selectAirport(icao, feedId?)`, `radio.selectFeed`, `radio.play`, `radio.stop`
- Produces: CommsPanel **without** `onSelectAirport` prop

- [ ] **Step 1: Remove map focus prop**

- Delete `onSelectAirport` from `CommsPanel` props and all call sites.
- In `RadarMap.tsx`, stop passing `onSelectAirport={selectCommsAirport}`. Remove `selectCommsAirport` if it becomes unused.

- [ ] **Step 2: Add `handleTune(icao)`**

```ts
const handleTune = (icao: string) => {
  const action = decideCommsTune({
    targetIcao: icao,
    activeIcao: radio.activeIcao,
    status: radio.status,
    lastFeedByIcao: presets.lastFeedByIcao,
  });
  if (!action) return;
  if (action.type === "stop") {
    radio.stop();
    return;
  }
  presets.rememberFeed(action.icao, action.feedId);
  radio.selectAirport(action.icao, action.feedId);
  void radio.play();
};
```

- Collapsed chip `onClick`: **only** `handleTune(entry.icao)` — do **not** call `setExpanded(true)`.
- Expanded preset row/button: `handleTune(entry.icao)` (pin button still `stopPropagation` + `togglePin`).
- Expand control remains the only way to expand from collapsed (status lamp button).

- [ ] **Step 3: LCD feed chips (functional)**

Replace `<select>` with buttons for `activeFeeds` when `length > 1` (and optionally show single feed as label only):

```ts
const handleFeedChip = (feedId: string) => {
  const wasLive =
    radio.status === "playing" || radio.status === "loading";
  if (radio.activeIcao) {
    presets.rememberFeed(radio.activeIcao, feedId);
  }
  radio.selectFeed(feedId);
  if (wasLive) void radio.play();
};
```

- [ ] **Step 4: Manual sanity (or lightweight assert via existing tests)**

Run: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/commsTune.test.ts src/components/radar/atcListenActions.test.ts`  
Expected: PASS.

Confirm TypeScript: `npx tsc --noEmit` if that is project-standard; otherwise rely on Next build later.

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/CommsPanel.tsx src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
fix(comms): play without map focus; collapsed tune in place

EOF
)"
```

---

### Task 5: Hardware-face visual restyle

**Files:**
- Modify: `src/components/radar/CommsPanel.tsx`

**Interfaces:**
- Same props/behavior as Task 4; visual only + minor labeling.

- [ ] **Step 1: Restyle expanded panel**

Apply hardware-face layout using existing tokens:

- Chassis: dark gradient / glass (`bg-[#0B0F14]/95`, ring `#3D9CF0/40`).
- **LCD block**: status (`RX · LIVE` / `IDLE` / `Connecting…`), ICAO, feed label; feed chips in LCD when multi-feed.
- **Preset grid**: `grid grid-cols-2 gap-1.5`; short `railLabel`-style ICAO; active live cell bordered/glow `#3D9CF0`; pin ★/☆ in cell corner.
- **Play/Stop**: prominent control (circular or filled button) calling existing `handleTogglePlay`.
- Keep collapse control, error text, LiveATC link, empty hint.

- [ ] **Step 2: Restyle collapsed rail**

- Mini chips as small bordered buttons (not only vertical text).
- Live chip accent + status lamp.
- Expand via lamp/button only.

- [ ] **Step 3: Verify behavior unchanged**

Re-check handlers: no `setExpanded(true)` on chip tune; no map focus; feed chips remember + continue play.

Run: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/commsTune.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/components/radar/CommsPanel.tsx
git commit -m "$(cat <<'EOF'
style(comms): hardware radio face for expanded and collapsed deck

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| No map focus on Comms tap | 4 |
| Hardware face chrome | 5 |
| Collapsible + chip play in place | 4–5 |
| Per-airport presets + LCD feed chips | 4–5 |
| Retap live → stop | 2, 4 |
| Last feed memory persisted | 1, 3 |
| Listen-from-card unchanged | 3–4 (no change to `atcListenActions`) |

No TBD placeholders. Types aligned: `lastFeedByIcao`, `rememberFeed`, `decideCommsTune`, `selectAirport(icao, preferredFeedId?)`.
