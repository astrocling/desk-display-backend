# Radio Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapsible ATC-glass Comms panel with session rack + pinned presets; Listen from the airport card adds to the rack, plays, and expands the panel.

**Architecture:** Keep `useAtcRadio` for audio. Add `useCommsPresets` (session + localStorage pins + expanded). Refactor `CommsPanel` to edge-rail collapse + preset list. Wire Listen via callbacks from `RadarMap`.

**Tech Stack:** Next.js (App Router) / React / TypeScript, Vitest, Tailwind, existing LiveATC catalog in `src/lib/atc/feeds.ts`.

## Global Constraints

- Web radar only; no firmware; no new LiveATC mounts.
- Catalog allowlist only: `isCatalogIcao` (`KDAY`, `KIND`, `KCMH`, `KCVG`).
- Listen alone does **not** persist; only explicit pin (`★`) persists in `localStorage`.
- Storage key: `desk-display.commsPresets.v1` with shape `{ pinnedIcaos: string[], expanded: boolean }`.
- First visit default: **collapsed** (`expanded: false` when no stored value).
- Visual tokens: bg `#0B0F14`, accent `#3D9CF0`, dim `#6B7280`, body `#C8D0D8`, glass/`backdrop-blur`, blue ring — modern ATC glass only.
- Empty copy: `Listen from an airport card or pin a preset.`
- Do not auto-populate rack from on-screen airports; drop `airportsOnScreen` membership coupling.
- Map focus must not grow the rack, expand the panel, or start audio.
- One shared `useAtcRadio` instance for Comms + Listen.
- Spec: `docs/superpowers/specs/2026-07-28-radio-panel-redesign-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/radar/commsPresets.ts` | Pure merge/storage helpers (testable) |
| `src/components/radar/commsPresets.test.ts` | Unit tests for helpers |
| `src/components/radar/useCommsPresets.ts` | React hook wrapping helpers + session state |
| `src/components/radar/CommsPanel.tsx` | Edge rail + expanded glass UI bound to presets |
| `src/components/radar/AtcListenButton.tsx` | Session + expand callbacks on Listen |
| `src/components/radar/SelectionAirportCard.tsx` | Pass through Listen callbacks |
| `src/components/radar/RadarMap.tsx` | Own `useCommsPresets`; wire panel + card |

---

### Task 1: Preset helpers + `useCommsPresets`

**Files:**
- Create: `src/components/radar/commsPresets.ts`
- Create: `src/components/radar/commsPresets.test.ts`
- Create: `src/components/radar/useCommsPresets.ts`

**Interfaces:**
- Produces:
  - `COMMS_PRESETS_STORAGE_KEY = "desk-display.commsPresets.v1"`
  - `CommsPresetEntry = { icao: string; pinned: boolean; session: boolean }`
  - `CommsPresetsStored = { pinnedIcaos: string[]; expanded: boolean }`
  - `normalizeCatalogIcao(icao: string): string | null`
  - `mergeCommsEntries(pinnedIcaos: string[], sessionIcaos: string[]): CommsPresetEntry[]`
  - `parseCommsPresetsStored(raw: string | null): CommsPresetsStored` — invalid/missing → `{ pinnedIcaos: [], expanded: false }`
  - `serializeCommsPresetsStored(data: CommsPresetsStored): string`
  - `useCommsPresets(): { entries, expanded, addSession, togglePin, removeSession, setExpanded }`

- [ ] **Step 1: Write failing tests** in `commsPresets.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  COMMS_PRESETS_STORAGE_KEY,
  mergeCommsEntries,
  normalizeCatalogIcao,
  parseCommsPresetsStored,
  serializeCommsPresetsStored,
} from "./commsPresets";

describe("normalizeCatalogIcao", () => {
  it("uppercases catalog ICAOs", () => {
    expect(normalizeCatalogIcao(" kind ")).toBe("KIND");
  });
  it("returns null for non-catalog", () => {
    expect(normalizeCatalogIcao("KFFO")).toBeNull();
  });
});

describe("mergeCommsEntries", () => {
  it("lists pinned before session-only and dedupes", () => {
    expect(
      mergeCommsEntries(["KCMH", "KIND"], ["KIND", "KDAY"]),
    ).toEqual([
      { icao: "KCMH", pinned: true, session: false },
      { icao: "KIND", pinned: true, session: true },
      { icao: "KDAY", pinned: false, session: true },
    ]);
  });
  it("drops non-catalog ids", () => {
    expect(mergeCommsEntries(["KFFO"], ["KZZZ"])).toEqual([]);
  });
});

describe("parseCommsPresetsStored", () => {
  it("defaults expanded false and empty pins", () => {
    expect(parseCommsPresetsStored(null)).toEqual({
      pinnedIcaos: [],
      expanded: false,
    });
  });
  it("parses valid JSON and filters pins", () => {
    expect(
      parseCommsPresetsStored(
        JSON.stringify({ pinnedIcaos: ["kind", "KFFO"], expanded: true }),
      ),
    ).toEqual({ pinnedIcaos: ["KIND"], expanded: true });
  });
  it("degrades on invalid JSON", () => {
    expect(parseCommsPresetsStored("{")).toEqual({
      pinnedIcaos: [],
      expanded: false,
    });
  });
});

describe("serializeCommsPresetsStored", () => {
  it("round-trips", () => {
    const data = { pinnedIcaos: ["KIND"], expanded: true };
    expect(parseCommsPresetsStored(serializeCommsPresetsStored(data))).toEqual(
      data,
    );
  });
});

describe("COMMS_PRESETS_STORAGE_KEY", () => {
  it("is namespaced v1", () => {
    expect(COMMS_PRESETS_STORAGE_KEY).toBe("desk-display.commsPresets.v1");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/components/radar/commsPresets.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `commsPresets.ts`**

```ts
import { isCatalogIcao } from "@/lib/atc/feeds";

export const COMMS_PRESETS_STORAGE_KEY = "desk-display.commsPresets.v1";

export type CommsPresetEntry = {
  icao: string;
  pinned: boolean;
  session: boolean;
};

export type CommsPresetsStored = {
  pinnedIcaos: string[];
  expanded: boolean;
};

export function normalizeCatalogIcao(icao: string): string | null {
  const upper = icao.trim().toUpperCase();
  return isCatalogIcao(upper) ? upper : null;
}

export function mergeCommsEntries(
  pinnedIcaos: string[],
  sessionIcaos: string[],
): CommsPresetEntry[] {
  const pinned: string[] = [];
  const pinnedSet = new Set<string>();
  for (const raw of pinnedIcaos) {
    const icao = normalizeCatalogIcao(raw);
    if (!icao || pinnedSet.has(icao)) continue;
    pinnedSet.add(icao);
    pinned.push(icao);
  }

  const sessionSet = new Set<string>();
  for (const raw of sessionIcaos) {
    const icao = normalizeCatalogIcao(raw);
    if (icao) sessionSet.add(icao);
  }

  const entries: CommsPresetEntry[] = pinned.map((icao) => ({
    icao,
    pinned: true,
    session: sessionSet.has(icao),
  }));

  for (const icao of sessionSet) {
    if (pinnedSet.has(icao)) continue;
    entries.push({ icao, pinned: false, session: true });
  }
  return entries;
}

export function parseCommsPresetsStored(raw: string | null): CommsPresetsStored {
  if (raw == null || raw === "") {
    return { pinnedIcaos: [], expanded: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CommsPresetsStored>;
    const pinnedIcaos = Array.isArray(parsed.pinnedIcaos)
      ? parsed.pinnedIcaos
          .map((x) => normalizeCatalogIcao(String(x)))
          .filter((x): x is string => x != null)
      : [];
    // dedupe preserving order
    const seen = new Set<string>();
    const unique = pinnedIcaos.filter((icao) => {
      if (seen.has(icao)) return false;
      seen.add(icao);
      return true;
    });
    return {
      pinnedIcaos: unique,
      expanded: parsed.expanded === true,
    };
  } catch {
    return { pinnedIcaos: [], expanded: false };
  }
}

export function serializeCommsPresetsStored(data: CommsPresetsStored): string {
  const pinnedIcaos = mergeCommsEntries(data.pinnedIcaos, []).map((e) => e.icao);
  return JSON.stringify({
    pinnedIcaos,
    expanded: data.expanded === true,
  });
}
```

- [ ] **Step 4: Implement `useCommsPresets.ts`**

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMMS_PRESETS_STORAGE_KEY,
  mergeCommsEntries,
  normalizeCatalogIcao,
  parseCommsPresetsStored,
  serializeCommsPresetsStored,
  type CommsPresetEntry,
} from "./commsPresets";

export type CommsPresets = {
  entries: CommsPresetEntry[];
  expanded: boolean;
  addSession: (icao: string) => void;
  togglePin: (icao: string) => void;
  removeSession: (icao: string) => void;
  setExpanded: (expanded: boolean) => void;
};

function readStored(): ReturnType<typeof parseCommsPresetsStored> {
  if (typeof window === "undefined") {
    return { pinnedIcaos: [], expanded: false };
  }
  try {
    return parseCommsPresetsStored(
      window.localStorage.getItem(COMMS_PRESETS_STORAGE_KEY),
    );
  } catch {
    return { pinnedIcaos: [], expanded: false };
  }
}

function writeStored(pinnedIcaos: string[], expanded: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMMS_PRESETS_STORAGE_KEY,
      serializeCommsPresetsStored({ pinnedIcaos, expanded }),
    );
  } catch {
    // private mode / quota — keep in-memory only
  }
}

export function useCommsPresets(): CommsPresets {
  const [pinnedIcaos, setPinnedIcaos] = useState<string[]>([]);
  const [sessionIcaos, setSessionIcaos] = useState<string[]>([]);
  const [expanded, setExpandedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setPinnedIcaos(stored.pinnedIcaos);
    setExpandedState(stored.expanded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(pinnedIcaos, expanded);
  }, [pinnedIcaos, expanded, hydrated]);

  const entries = useMemo(
    () => mergeCommsEntries(pinnedIcaos, sessionIcaos),
    [pinnedIcaos, sessionIcaos],
  );

  const addSession = useCallback((icao: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    setSessionIcaos((prev) => (prev.includes(upper) ? prev : [...prev, upper]));
  }, []);

  const removeSession = useCallback((icao: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    setSessionIcaos((prev) => prev.filter((x) => x !== upper));
  }, []);

  const togglePin = useCallback((icao: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    setPinnedIcaos((prev) =>
      prev.includes(upper) ? prev.filter((x) => x !== upper) : [...prev, upper],
    );
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
  }, []);

  return {
    entries,
    expanded,
    addSession,
    togglePin,
    removeSession,
    setExpanded,
  };
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test -- src/components/radar/commsPresets.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/radar/commsPresets.ts src/components/radar/commsPresets.test.ts src/components/radar/useCommsPresets.ts
git commit -m "$(cat <<'EOF'
feat: add comms preset session and pin storage

EOF
)"
```

---

### Task 2: Redesign `CommsPanel` (edge rail + glass + presets)

**Files:**
- Modify: `src/components/radar/CommsPanel.tsx` (full rewrite of props + UI)
- Modify: `src/components/radar/RadarMap.tsx` (partial — only enough to typecheck: pass presets; can finish Listen in Task 3)

**Interfaces:**
- Consumes: `CommsPresets` from Task 1; `AtcRadio` from `useAtcRadio`
- Produces: `CommsPanel` props:

```ts
{
  focusedIcao: string | null;
  radio: AtcRadio;
  presets: CommsPresets;
  onSelectAirport: (icao: string) => void;
}
```

- Remove `airportsOnScreen` prop entirely.

**Behavior:**
- If `!presets.expanded`: render slim left edge rail only (expand on click). Show play affordance + stacked ICAO/dot indicators from `presets.entries`; highlight `radio.activeIcao` and pinned rows.
- If `presets.expanded`: glass panel with header “Comms” + collapse, active ICAO + feed label, preset rows with ★/☆, feed select, Play/Stop, status/error, empty hint when `entries.length === 0`.
- Idle auto-select: only when `focusedIcao` is catalog **and already in `presets.entries`** and radio not playing/loading → `radio.selectAirport(focused)`. Do not select from on-screen list. Do not add to session.
- Play with no feed: if `entries.length > 0`, prefer focused-if-in-entries else `entries[0].icao`, then `toggle()`.
- Row body click: `radio.selectAirport(icao)` + `onSelectAirport(icao)`.
- Star button click: `presets.togglePin(icao)` and `stopPropagation`.
- Tokens: `#0B0F14` / `#3D9CF0` / `#6B7280` / `#C8D0D8`.

- [ ] **Step 1: Rewrite `CommsPanel.tsx`** per behavior above (keep `"use client"`; import `feedsForIcao`, `isCatalogIcao`, types).

Collapsed rail sketch:

```tsx
if (!presets.expanded) {
  return (
    <div className="pointer-events-auto flex w-9 flex-col items-center gap-2 rounded-r-lg bg-[#0B0F14]/90 py-2 ring-1 ring-[#3D9CF0]/40 backdrop-blur sm:w-10">
      <button type="button" aria-label="Expand comms" onClick={() => presets.setExpanded(true)} ...>
        {/* radio / chevron */}
      </button>
      {presets.entries.map((entry) => (
        <button
          key={entry.icao}
          type="button"
          title={entry.icao}
          onClick={() => {
            radio.selectAirport(entry.icao);
            onSelectAirport(entry.icao);
            presets.setExpanded(true);
          }}
          className={radio.activeIcao === entry.icao ? "text-[#3D9CF0]" : "text-[#6B7280]"}
        >
          {/* short indicator or vertical ICAO */}
        </button>
      ))}
    </div>
  );
}
```

Expanded body must include empty state string exactly:
`Listen from an airport card or pin a preset.`

- [ ] **Step 2: Update `RadarMap.tsx` Comms wiring**

```tsx
const atcRadio = useAtcRadio();
const commsPresets = useCommsPresets();
// ...
<CommsPanel
  focusedIcao={focusedIcao}
  radio={atcRadio}
  presets={commsPresets}
  onSelectAirport={selectCommsAirport}
/>
```

Remove `airportsOnScreen={onScreenAirports}`. Import `useCommsPresets`.

- [ ] **Step 3: Typecheck / tests**

Run: `npx tsc --noEmit` (or project’s usual check) and `npm test -- src/components/radar/commsPresets.test.ts`
Expected: PASS / no CommsPanel type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/radar/CommsPanel.tsx src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: collapse Comms panel into preset edge rail

EOF
)"
```

---

### Task 3: Listen → session + expand

**Files:**
- Modify: `src/components/radar/AtcListenButton.tsx`
- Modify: `src/components/radar/SelectionAirportCard.tsx`
- Modify: `src/components/radar/RadarMap.tsx`
- Create: `src/components/radar/AtcListenButton.test.ts` (pure handler helper if easier) **or** keep logic inline and add a tiny exported helper:

**Preferred:** extract click orchestration to testable function in `AtcListenButton.tsx` or `atcListenActions.ts`:

```ts
export function beginListenToAirport(opts: {
  icao: string;
  activeIcao: string | null;
  status: AtcRadioStatus;
  selectAirport: (icao: string) => void;
  play: () => Promise<void>;
  toggle: () => Promise<void>;
  addSession: (icao: string) => void;
  setExpanded: (expanded: boolean) => void;
}): void {
  const upper = icao.trim().toUpperCase();
  const isActive = opts.activeIcao === upper;
  const isPlaying =
    isActive && (opts.status === "playing" || opts.status === "loading");
  if (!isActive) {
    opts.addSession(upper);
    opts.setExpanded(true);
    opts.selectAirport(upper);
    void opts.play();
    return;
  }
  if (isPlaying) {
    void opts.toggle();
    return;
  }
  // active but idle — start play and ensure rack/panel
  opts.addSession(upper);
  opts.setExpanded(true);
  void opts.play();
}
```

- [ ] **Step 1: Write failing test** `src/components/radar/atcListenActions.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { beginListenToAirport } from "./atcListenActions";

describe("beginListenToAirport", () => {
  it("adds session, expands, selects, and plays when switching airport", () => {
    const addSession = vi.fn();
    const setExpanded = vi.fn();
    const selectAirport = vi.fn();
    const play = vi.fn(async () => {});
    const toggle = vi.fn(async () => {});
    beginListenToAirport({
      icao: "KDAY",
      activeIcao: "KIND",
      status: "playing",
      selectAirport,
      play,
      toggle,
      addSession,
      setExpanded,
    });
    expect(addSession).toHaveBeenCalledWith("KDAY");
    expect(setExpanded).toHaveBeenCalledWith(true);
    expect(selectAirport).toHaveBeenCalledWith("KDAY");
    expect(play).toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
  });

  it("toggles stop when already playing this airport", () => {
    const toggle = vi.fn(async () => {});
    const addSession = vi.fn();
    beginListenToAirport({
      icao: "KIND",
      activeIcao: "KIND",
      status: "playing",
      selectAirport: vi.fn(),
      play: vi.fn(async () => {}),
      toggle,
      addSession,
      setExpanded: vi.fn(),
    });
    expect(toggle).toHaveBeenCalled();
    expect(addSession).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**; implement `atcListenActions.ts`; run PASS

- [ ] **Step 3: Wire UI**

`AtcListenButton` accepts optional `onBeforeListen?: (icao: string) => void` **or** explicit `addSession` + `setExpanded`. Prefer:

```ts
export function AtcListenButton({
  icao,
  radio,
  addSession,
  setExpanded,
}: {
  icao: string;
  radio: AtcRadio;
  addSession: (icao: string) => void;
  setExpanded: (expanded: boolean) => void;
})
```

Use `beginListenToAirport` in onClick. Still return `null` if `!isCatalogIcao`.

`SelectionAirportCard`: add `addSession` + `setExpanded` props (required when `radio` provided, or pass through nullable). Simplest: always pass from RadarMap when radio is passed:

```tsx
{radio ? (
  <AtcListenButton
    icao={detail.icao}
    radio={radio}
    addSession={addSession}
    setExpanded={setExpanded}
  />
) : null}
```

`RadarMap`:

```tsx
<SelectionAirportCard
  ...
  radio={atcRadio}
  addSession={commsPresets.addSession}
  setExpanded={commsPresets.setExpanded}
/>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/atcListenActions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/radar/atcListenActions.ts src/components/radar/atcListenActions.test.ts src/components/radar/AtcListenButton.tsx src/components/radar/SelectionAirportCard.tsx src/components/radar/RadarMap.tsx
git commit -m "$(cat <<'EOF'
feat: Listen adds airport to Comms session rack

EOF
)"
```

---

### Task 4: Smoke verification

**Files:** none required unless fixes

- [ ] **Step 1: Run full radar-related unit tests**

Run: `npm test -- src/components/radar/`
Expected: all PASS

- [ ] **Step 2: Manual checklist** (note in commit message if no code change; fix bugs if found)
  - Collapsed rail visible; expand/collapse persists after reload
  - Listen from KIND card → panel opens, KIND in rack unpinned, audio starts
  - Pin KIND → reload → KIND still listed
  - Listen-only (no pin) → reload → gone from rack
  - Empty state copy when no entries
  - Mobile-narrow: rail does not block map center

- [ ] **Step 3: Commit fixes only if needed**

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Collapsible edge rail | 2 |
| Session vs pin persistence | 1 |
| Listen → session + play + expand | 3 |
| Modern ATC glass tokens | 2 |
| Drop on-screen list membership | 2 |
| Catalog allowlist | 1–3 |
| Empty state copy | 2 |
| Storage key / degrade | 1 |
| Tests for merge/pin/Listen | 1, 3 |
