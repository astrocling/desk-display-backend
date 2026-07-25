# Web radar declutter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add device-matching Target / Callsign / Tag declutter to the web radar via a Watchlist-style popover, always applied (no zoom gate), persisted in localStorage.

**Architecture:** Pure helpers in `radarFormat.ts` map mode → unselected label density. `RadarMap` owns mode state + popover UI, passes mode into aircraft marker updates, and drops the zoom-based `showTags` boolean.

**Tech Stack:** React (Next.js), MapLibre markers, Vitest, localStorage.

---

### Task 1: Declutter helpers + tests

**Files:**
- Modify: `src/components/radar/radarFormat.ts`
- Modify: `src/components/radar/radarFormat.test.ts`

- [ ] Add `RadarDeclutterMode` (`"target" | "callsign" | "tag"`), `RADAR_DECLUTTER_DEFAULT`, `radarUnselectedLabel(mode)`, `parseRadarDeclutterMode(raw)`, `radarDeclutterLabel(mode)`
- [ ] Tests for parse / label mapping / default

### Task 2: Apply declutter in aircraft markers

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`

- [ ] Replace `showTags: boolean` with declutter mode in `updateAircraftEl` / `syncAircraftMarkers`
- [ ] Unselected: none / callsign-only / dense tag per mode; selected always full
- [ ] Vectors whenever `trackDeg` is known (all modes)
- [ ] Remove zoom/range `showTags` gate in `fetchAdsb`; status uses mode name

### Task 3: Popover UI + persistence

**Files:**
- Modify: `src/components/radar/RadarMap.tsx`

- [ ] State + `localStorage` load/save
- [ ] Header `Declutter · {Mode}` button + exclusive chips popover
- [ ] Manual check: switch modes, refresh page, confirm persistence
