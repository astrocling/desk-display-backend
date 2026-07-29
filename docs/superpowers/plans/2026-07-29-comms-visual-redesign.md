# Comms Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CommsPanel visual bugs by replacing the circular Play/Stop knob with a full-width transport bar and moving pins into a Manage presets mode with large hit targets.

**Architecture:** Component-local `managingPresets` state in `CommsPanel.tsx` only. Keep existing `handleTune` / `handleFeedChip` / `handleTogglePlay` / `togglePin`. No audio or storage API changes.

**Tech Stack:** React client component, Tailwind utility classes, existing ATC tokens, Vitest for regression on untouched helpers.

**Spec:** `docs/superpowers/specs/2026-07-29-comms-visual-redesign-design.md`

## Global Constraints

- Touch only `src/components/radar/CommsPanel.tsx` (unless a tiny pure helper is extracted for clarity).
- Do not change `useAtcRadio`, `useCommsPresets`, `commsTune`, `RadarMap`, or LiveATC APIs.
- Station keys in normal mode must have **no** pin overlay badges.
- Transport must be a **full-width horizontal bar** — never put status words inside a circular control.
- Pin hit target in manage mode ≥ **24×24px**, in-row.
- Collapse must **clear** manage mode.
- Soften key glows; use tokens `#0B0F14`, `#3D9CF0`, muted grays.
- Panel width ~`w-60` (240px) acceptable.
- Preserve: tap-to-play/stop, no map focus, collapsed play-in-place, LCD feed chips, last-feed memory.
- After UI changes: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/commsTune.test.ts` must pass.

---

## File map

| File | Role |
|------|------|
| `src/components/radar/CommsPanel.tsx` | All layout/mode changes |
| Spec (read-only) | `docs/superpowers/specs/2026-07-29-comms-visual-redesign-design.md` |

---

### Task 1: Manage presets mode + remove pin overlays

**Files:**
- Modify: `src/components/radar/CommsPanel.tsx`

**Interfaces:**
- Local state: `const [managingPresets, setManagingPresets] = useState(false)`
- Collapse handler: `() => { setManagingPresets(false); setExpanded(false); }`
- Presets button: `setManagingPresets(true)`
- Done button: `setManagingPresets(false)`

- [ ] **Step 1: Add `useState` for manage mode**

Import `useState` from React (already importing `useEffect` — extend the import).

```tsx
import { useEffect, useState } from "react";
// ...
const [managingPresets, setManagingPresets] = useState(false);
```

- [ ] **Step 2: Clear manage on collapse**

Replace collapse `onClick={() => setExpanded(false)}` with:

```tsx
onClick={() => {
  setManagingPresets(false);
  setExpanded(false);
}}
```

- [ ] **Step 3: Remove absolute pin badges from the normal station grid**

In the expanded normal grid, delete the absolute-positioned ★/☆ button on each key. Keys remain `handleTune` only.

- [ ] **Step 4: Branch station area on `managingPresets`**

When `managingPresets` is true and `entries.length > 0`, render a vertical list of full-width rows:

```tsx
<ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
  {entries.map((entry) => (
    <li
      key={entry.icao}
      className="flex items-center gap-2 rounded border border-[#2A3138] bg-black/20 px-2 py-1.5"
    >
      <span className="flex-1 font-mono text-[11px] font-semibold tracking-wide text-[#C8D0D8]">
        {entry.icao}
      </span>
      <button
        type="button"
        aria-label={entry.pinned ? `Unpin ${entry.icao}` : `Pin ${entry.icao}`}
        onClick={() => togglePin(entry.icao)}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-base leading-none ${
          entry.pinned ? "text-[#3D9CF0]" : "text-[#6B7280] hover:text-[#C8D0D8]"
        }`}
      >
        {entry.pinned ? "★" : "☆"}
      </button>
    </li>
  ))}
</ul>
```

When `managingPresets` is false, keep the clean 2-col tune grid (no pins).

Empty rack: keep the existing empty hint in both modes.

- [ ] **Step 5: Footer Presets / Done control**

Below the station area (when expanded), add:

```tsx
<button
  type="button"
  onClick={() =>
    setManagingPresets((prev) => !prev)
  }
  className="mt-2 w-full rounded py-1.5 text-center text-[11px] text-[#6B7280] hover:bg-[#3D9CF0]/10 hover:text-[#C8D0D8]"
>
  {managingPresets ? "Done" : "Presets"}
</button>
```

(Or separate enter/exit handlers equivalent to toggle.) Prefer explicit:

- Normal footer: label **Presets** → `setManagingPresets(true)`
- Manage footer: label **Done** → `setManagingPresets(false)`

Show the footer even when entries are empty (so user can enter manage and see empty list / still exit).

- [ ] **Step 6: Verify handlers**

Confirm manage pin buttons do **not** call `handleTune`. Confirm normal keys still call `handleTune` only.

- [ ] **Step 7: Regression tests**

Run: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/commsTune.test.ts`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/radar/CommsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(comms): move pinning into manage-presets mode

EOF
)"
```

---

### Task 2: Full-width transport bar + visual polish

**Files:**
- Modify: `src/components/radar/CommsPanel.tsx`

**Interfaces:**
- Transport calls existing `handleTogglePlay`
- Visible when `isPlaying || canPlay` (same rule as today so stop remains available when live)
- Remains visible in manage mode

- [ ] **Step 1: Widen panel chassis**

Change expanded panel outer width from `w-56` to `w-60`.

- [ ] **Step 2: Replace circular Play/Stop with transport bar**

Remove the `rounded-full w-11` side button. After the LCD (and error line), before the station area, render:

```tsx
{(isPlaying || canPlay) && (
  <button
    type="button"
    onClick={handleTogglePlay}
    aria-label={isPlaying ? "Stop ATC radio" : "Play ATC radio"}
    className={`mt-2 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
      isPlaying
        ? "border-[#3D9CF0]/50 bg-[#3D9CF0]/10"
        : "border-[#2A3138] hover:border-[#3D9CF0]/40"
    }`}
  >
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
        isPlaying
          ? "border-[#3D9CF0] text-[#3D9CF0]"
          : "border-[#3D9CF0]/40 text-[#C8D0D8]"
      }`}
    >
      {radio.status === "loading" ? "…" : isPlaying ? "■" : "▶"}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[12px] font-semibold text-[#E8F4FF]">
        {radio.status === "loading"
          ? "Connecting"
          : isPlaying
            ? "Stop"
            : "Play"}
      </span>
      <span className="block truncate text-[10px] text-[#6B7280]">
        {radio.activeIcao
          ? `${radio.activeIcao}${
              activeFeeds.find((f) => f.id === radio.activeFeedId)?.label
                ? ` · ${activeFeeds.find((f) => f.id === radio.activeFeedId)!.label}`
                : ""
            }`
          : "Select a station"}
      </span>
    </span>
  </button>
)}
```

Compute the feed label once above JSX to avoid double `find` (e.g. `activeFeedLabel`).

Do **not** put the word “Connecting” inside a fixed-size circle alone — the circular glyph may show `…` only; the word lives in the bar’s text column / LCD.

- [ ] **Step 3: Soften live key glow**

On live-active station keys, prefer `border-[#3D9CF0] bg-[#3D9CF0]/15 text-[#3D9CF0]` **without** `shadow-[0_0_8px_…]` (or use a very subtle shadow if needed). Same restraint on transport icon.

- [ ] **Step 4: Layout order check**

Expanded order must be:

1. Header  
2. LCD (+ feed chips)  
3. Error (if any)  
4. Transport bar  
5. Empty hint **or** station grid / manage rows  
6. Presets / Done  
7. LiveATC link  

- [ ] **Step 5: Regression tests**

Run: `npm test -- src/components/radar/commsPresets.test.ts src/components/radar/commsTune.test.ts`  
Expected: PASS.

Optionally: `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add src/components/radar/CommsPanel.tsx
git commit -m "$(cat <<'EOF'
style(comms): full-width transport bar and quieter key chrome

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| Manage presets via Presets/Done | 1 |
| No pin overlays on normal keys | 1 |
| Pin ≥24px in manage | 1 (`h-8 w-8`) |
| Collapse clears manage | 1 |
| Full-width transport bar | 2 |
| No status words in circle | 2 |
| Soften glows / ~240px width | 2 |
| Audio behavior unchanged | Both (handlers preserved) |

No TBD placeholders. Single-file scope matches Approach 1.
