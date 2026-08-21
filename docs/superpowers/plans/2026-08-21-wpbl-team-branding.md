# WPBL Team Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add official WPBL team logos and primary brand colors across the `/wpbl` league board and game detail UI, with left accent bars on leader rows.

**Architecture:** Static logos in `public/wpbl/`, a shared brand lookup module keyed by team abbr, and small presentational helpers (`TeamLogo`, accent style) wired into existing WPBL components. No API or Redis changes.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind 4, Vitest.

## Global Constraints

- Do **not** change dial HTML WPBL (`src/lib/fetchers/wpbl.ts`) or `/api/scores`.
- Do **not** change Redis blobs or `/api/wpbl/*` response shapes for branding.
- Branding maps from existing abbrs: `LA` | `NY` | `SF` | `BOS`.
- Left accent ~3px primary color only — no full-row tints.
- Host logos locally under `public/wpbl/` (no runtime remote logo fetch).
- Prefer official media kit assets; known web marks are acceptable fallbacks.
- Read `node_modules/next/dist/docs/` before using `next/image` patterns if unsure for this Next version.
- TDD for brand lookup; keep desk-display density (do not inflate row heights).

**Spec:** `docs/superpowers/specs/2026-08-21-wpbl-team-branding-design.md`

---

## File map

| File | Role |
|------|------|
| `public/wpbl/la.png` (or kit format) | Los Angeles Queens mark |
| `public/wpbl/ny.png` | New York Heights mark |
| `public/wpbl/sf.png` | San Francisco Firebells mark |
| `public/wpbl/bos.png` | Boston Hunters mark |
| `src/lib/wpbl-team-brand.ts` | Abbr → primary hex, logo path, display name |
| `src/lib/wpbl-team-brand.test.ts` | Lookup + fallback tests |
| `src/components/wpbl/TeamLogo.tsx` | Logo image helper |
| `src/components/wpbl/teamAccent.ts` | Accent style helper for left border |
| `src/components/wpbl/TeamFilter.tsx` | Logos + active color accent |
| `src/components/wpbl/StandingsTable.tsx` | Logo before team |
| `src/components/wpbl/ScheduleList.tsx` | Logos on matchup |
| `src/components/wpbl/LeadersBoards.tsx` | Left accent bar per player row |
| `src/components/wpbl/GameDetailClient.tsx` | Logos in score header |
| `src/components/wpbl/LineScore.tsx` | Logo in team label |
| `src/components/wpbl/BoxTables.tsx` | Logo + accent on side tabs |

---

### Task 1: Logo assets + brand lookup module

**Files:**
- Create: `public/wpbl/{la,ny,sf,bos}.png` (or `.webp` / `.svg` if kit provides; keep extensions consistent in the brand map)
- Create: `src/lib/wpbl-team-brand.ts`
- Create: `src/lib/wpbl-team-brand.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WpblBrandAbbr = "LA" | "NY" | "SF" | "BOS";

  export type WpblTeamBrand = {
    abbr: WpblBrandAbbr;
    name: string;       // Queens | Heights | …
    fullName: string;
    primary: string;    // #RRGGBB
    logoSrc: string;    // /wpbl/la.png
  };

  export function getWpblTeamBrand(abbr: string): WpblTeamBrand | null;
  export function wpblTeamPrimary(abbr: string): string; // known primary or "#64748b" slate-500
  export function wpblTeamLogoSrc(abbr: string): string | null;
  ```

- [ ] **Step 1: Download official logos into `public/wpbl/`**

Prefer extracting primary marks from:

`https://www.womensprobaseballleague.com/wp-content/uploads/2026/07/WPBL-Team-Brands-Media-Kit-20260708T133043Z-3-001.zip`

If kit download/extraction fails, curl these fallbacks and rename:

```bash
mkdir -p public/wpbl
curl -fsSL -o public/wpbl/la.png \
  "https://www.womensprobaseballleague.com/wp-content/uploads/2026/07/queens-logo-q.png"
curl -fsSL -o public/wpbl/ny.png \
  "https://www.womensprobaseballleague.com/wp-content/uploads/2026/07/ny-white-logo.png"
curl -fsSL -o public/wpbl/bos.png \
  "https://www.womensprobaseballleague.com/wp-content/uploads/2026/07/hunters-logo.png"
curl -fsSL -o public/wpbl/sf.webp \
  "https://www.womensprobaseballleague.com/wp-content/uploads/2025/12/SF-I-R-1.webp"
```

If SF is `.webp` and others `.png`, either convert SF to PNG or set `logoSrc` per team to the correct extension. Prefer four PNGs when practical (`sips` / `magick` on macOS is fine).

Verify files are non-empty:

```bash
ls -la public/wpbl/
```

- [ ] **Step 2: Write failing brand lookup tests**

Create `src/lib/wpbl-team-brand.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getWpblTeamBrand,
  wpblTeamLogoSrc,
  wpblTeamPrimary,
} from "./wpbl-team-brand";

describe("getWpblTeamBrand", () => {
  it("returns brand for each known abbr", () => {
    for (const abbr of ["LA", "NY", "SF", "BOS"] as const) {
      const brand = getWpblTeamBrand(abbr);
      expect(brand).not.toBeNull();
      expect(brand!.abbr).toBe(abbr);
      expect(brand!.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(brand!.logoSrc).toMatch(/^\/wpbl\//);
    }
  });

  it("returns null for unknown abbr", () => {
    expect(getWpblTeamBrand("XX")).toBeNull();
    expect(getWpblTeamBrand("")).toBeNull();
  });
});

describe("wpblTeamPrimary", () => {
  it("returns team primary for known abbrs", () => {
    expect(wpblTeamPrimary("LA")).toBe("#AF9067");
    expect(wpblTeamPrimary("NY")).toBe("#0B1F3A");
    expect(wpblTeamPrimary("SF")).toBe("#5B2A8C");
    expect(wpblTeamPrimary("BOS")).toBe("#0B6B3A");
  });

  it("returns slate fallback for unknown", () => {
    expect(wpblTeamPrimary("??")).toBe("#64748b");
  });
});

describe("wpblTeamLogoSrc", () => {
  it("returns path for known and null for unknown", () => {
    expect(wpblTeamLogoSrc("SF")).toMatch(/^\/wpbl\//);
    expect(wpblTeamLogoSrc("nope")).toBeNull();
  });
});
```

Adjust expected hexes only if you sample different official primaries from the media kit; then update both the module and the tests together.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/wpbl-team-brand.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 4: Implement `src/lib/wpbl-team-brand.ts`**

```ts
export type WpblBrandAbbr = "LA" | "NY" | "SF" | "BOS";

export type WpblTeamBrand = {
  abbr: WpblBrandAbbr;
  name: string;
  fullName: string;
  primary: string;
  logoSrc: string;
};

const FALLBACK_PRIMARY = "#64748b";

const BRANDS: Record<WpblBrandAbbr, WpblTeamBrand> = {
  LA: {
    abbr: "LA",
    name: "Queens",
    fullName: "Los Angeles Queens",
    primary: "#AF9067",
    logoSrc: "/wpbl/la.png",
  },
  NY: {
    abbr: "NY",
    name: "Heights",
    fullName: "New York Heights",
    primary: "#0B1F3A",
    logoSrc: "/wpbl/ny.png",
  },
  SF: {
    abbr: "SF",
    name: "Firebells",
    fullName: "San Francisco Firebells",
    primary: "#5B2A8C",
    logoSrc: "/wpbl/sf.png", // or .webp if that is what was saved
  },
  BOS: {
    abbr: "BOS",
    name: "Hunters",
    fullName: "Boston Hunters",
    primary: "#0B6B3A",
    logoSrc: "/wpbl/bos.png",
  },
};

function isBrandAbbr(abbr: string): abbr is WpblBrandAbbr {
  return abbr === "LA" || abbr === "NY" || abbr === "SF" || abbr === "BOS";
}

export function getWpblTeamBrand(abbr: string): WpblTeamBrand | null {
  if (!isBrandAbbr(abbr)) return null;
  return BRANDS[abbr];
}

export function wpblTeamPrimary(abbr: string): string {
  return getWpblTeamBrand(abbr)?.primary ?? FALLBACK_PRIMARY;
}

export function wpblTeamLogoSrc(abbr: string): string | null {
  return getWpblTeamBrand(abbr)?.logoSrc ?? null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/wpbl-team-brand.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/wpbl src/lib/wpbl-team-brand.ts src/lib/wpbl-team-brand.test.ts
git commit -m "$(cat <<'EOF'
feat(wpbl): add team brand colors and logo assets

EOF
)"
```

---

### Task 2: `TeamLogo` + accent helpers

**Files:**
- Create: `src/components/wpbl/TeamLogo.tsx`
- Create: `src/components/wpbl/teamAccent.ts`
- Test: extend `src/lib/wpbl-team-brand.test.ts` only if accent helper lives in lib; otherwise keep `teamAccent` as a thin style helper without a separate heavy test

**Interfaces:**
- Consumes: `getWpblTeamBrand`, `wpblTeamLogoSrc`, `wpblTeamPrimary`
- Produces:
  ```ts
  // TeamLogo.tsx
  export type TeamLogoProps = {
    abbr: string;
    size?: "sm" | "md"; // sm=16 md=24
    className?: string;
  };
  export function TeamLogo(props: TeamLogoProps): React.ReactElement | null;

  // teamAccent.ts
  export function teamAccentStyle(abbr: string): React.CSSProperties;
  // → { borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: wpblTeamPrimary(abbr) }
  ```

- [ ] **Step 1: Implement `teamAccent.ts`**

```ts
import type { CSSProperties } from "react";
import { wpblTeamPrimary } from "@/lib/wpbl-team-brand";

export function teamAccentStyle(abbr: string): CSSProperties {
  return {
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: wpblTeamPrimary(abbr),
  };
}
```

- [ ] **Step 2: Implement `TeamLogo.tsx`**

Use a plain `<img>` to avoid Next image remote/config friction for static public files (or `next/image` with width/height if that is the repo norm — check existing components). Prefer matching existing patterns.

```tsx
"use client";

import { useState } from "react";

import { getWpblTeamBrand, wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

const SIZES = { sm: 16, md: 24 } as const;

export type TeamLogoProps = {
  abbr: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function TeamLogo({ abbr, size = "sm", className }: TeamLogoProps) {
  const src = wpblTeamLogoSrc(abbr);
  const brand = getWpblTeamBrand(abbr);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  const px = SIZES[size];
  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      className={`inline-block shrink-0 object-contain ${className ?? ""}`}
      onError={() => setFailed(true)}
      title={brand?.fullName}
    />
  );
}
```

Note: `"use client"` is required for `onError` state. If a parent is already a client component, this is fine. For RSC parents (e.g. if any), keep `TeamLogo` as a client island.

For NY white logo on light backgrounds: wrap with a subtle dark rounded pad when `abbr === "NY"` if the mark is illegible on white — e.g. `className` includes `rounded bg-slate-800 p-0.5` only for NY. Keep this minimal.

- [ ] **Step 3: Smoke-check TypeScript**

Run: `npx tsc --noEmit` (or project’s usual typecheck if defined in package.json)

Expected: no errors from new files

- [ ] **Step 4: Commit**

```bash
git add src/components/wpbl/TeamLogo.tsx src/components/wpbl/teamAccent.ts
git commit -m "$(cat <<'EOF'
feat(wpbl): add TeamLogo and accent style helpers

EOF
)"
```

---

### Task 3: Wire league page surfaces

**Files:**
- Modify: `src/components/wpbl/TeamFilter.tsx`
- Modify: `src/components/wpbl/StandingsTable.tsx`
- Modify: `src/components/wpbl/ScheduleList.tsx`
- Modify: `src/components/wpbl/LeadersBoards.tsx`

**Interfaces:**
- Consumes: `TeamLogo`, `teamAccentStyle`, `wpblTeamPrimary`

- [ ] **Step 1: Update `TeamFilter.tsx`**

For each team option (not `ALL`):
- Render `<TeamLogo abbr={opt.value} size="sm" />` before the label.
- When `active && opt.value !== "ALL"`, use `style={{ borderColor: wpblTeamPrimary(opt.value), backgroundColor: … }}` or a left border / ring using primary while keeping text contrast (white text on dark primary, or outline style). Prefer: active = filled with primary (darken if needed for white text); inactive = border + logo + label.

Keep `ALL` as the existing slate active style.

- [ ] **Step 2: Update `StandingsTable.tsx`**

In the team cell:

```tsx
<td className="px-3 py-2">
  <span className="inline-flex items-center gap-2">
    <TeamLogo abbr={row.abbr} size="sm" />
    <span className="font-medium">{row.abbr}</span>
    <span className="text-slate-500">{row.name}</span>
  </span>
</td>
```

`StandingsTable` will need `"use client"` only if `TeamLogo` cannot be imported into a server component — in Next, client children can be imported into server components. Prefer keeping `StandingsTable` as a server component importing client `TeamLogo`.

- [ ] **Step 3: Update `ScheduleList.tsx`**

In the matchup span, place logos next to away/home abbrs:

```tsx
<span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
  <span className="inline-flex items-center gap-1.5 font-medium">
    <TeamLogo abbr={game.awayAbbr} size="sm" />
    {game.awayAbbr}
  </span>
  <span className="text-slate-400">@</span>
  <span className="inline-flex items-center gap-1.5 font-medium">
    <TeamLogo abbr={game.homeAbbr} size="sm" />
    {game.homeAbbr}
  </span>
  <span className="text-slate-500">
    {game.awayName} at {game.homeName}
  </span>
</span>
```

- [ ] **Step 4: Update `LeadersBoards.tsx`**

On each `<li>` player row, apply `style={teamAccentStyle(entry.teamAbbr)}` and add a little left padding so text clears the bar (`pl-2` in addition to existing `px-3`, or replace left padding carefully). Keep rank, name, abbr, value. Do **not** require logos on leader rows (accent bar is the signal).

Example:

```tsx
<li
  key={`${entry.playerId}-${i}`}
  className="flex items-baseline gap-2 py-1.5 pl-3 pr-3 text-sm"
  style={teamAccentStyle(entry.teamAbbr)}
>
```

- [ ] **Step 5: Run unit tests still green**

Run: `npx vitest run src/lib/wpbl-team-brand.test.ts src/components/wpbl/scheduleSort.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/wpbl/TeamFilter.tsx src/components/wpbl/StandingsTable.tsx src/components/wpbl/ScheduleList.tsx src/components/wpbl/LeadersBoards.tsx
git commit -m "$(cat <<'EOF'
feat(wpbl): show team logos and leader accent colors on league board

EOF
)"
```

---

### Task 4: Wire game detail surfaces

**Files:**
- Modify: `src/components/wpbl/GameDetailClient.tsx`
- Modify: `src/components/wpbl/LineScore.tsx`
- Modify: `src/components/wpbl/BoxTables.tsx`

**Interfaces:**
- Consumes: `TeamLogo`, `wpblTeamPrimary`
- `BoxTables` should accept `awayAbbr` and `homeAbbr` (in addition to labels) for logos/accents

- [ ] **Step 1: Update game header in `GameDetailClient.tsx`**

Replace the plain abbr scoreline with logos:

```tsx
<h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
  <span className="inline-flex items-center gap-2">
    <TeamLogo abbr={game.awayAbbr} size="md" />
    {game.awayAbbr}
  </span>
  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
    {scoreLine(game)}
  </span>
  <span className="inline-flex items-center gap-2">
    <TeamLogo abbr={game.homeAbbr} size="md" />
    {game.homeAbbr}
  </span>
</h1>
```

Pass abbrs into `BoxTables`:

```tsx
<BoxTables
  batting={boxscore.batting}
  pitching={boxscore.pitching}
  awayLabel={`${game.awayAbbr} ${game.awayName}`}
  homeLabel={`${game.homeAbbr} ${game.homeName}`}
  awayAbbr={game.awayAbbr}
  homeAbbr={game.homeAbbr}
/>
```

- [ ] **Step 2: Update `LineScore.tsx` team cell**

```tsx
<td className="px-3 py-2">
  <span className="inline-flex items-center gap-2">
    <TeamLogo abbr={team.abbr} size="sm" />
    <span className="font-medium">{team.abbr}</span>
    <span className="text-slate-500">{team.name}</span>
  </span>
</td>
```

- [ ] **Step 3: Update `BoxTables.tsx` tabs**

Extend props:

```ts
export type BoxTablesProps = {
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
  awayLabel: string;
  homeLabel: string;
  awayAbbr: string;
  homeAbbr: string;
};
```

On each side tab button, show `<TeamLogo abbr={…} />` and when active, set `style={{ borderBottomColor: wpblTeamPrimary(abbr) }}` (override the default slate border). Keep existing layout otherwise. Player rows inside the box do **not** need per-player accent bars (entire tab is already one team).

- [ ] **Step 4: Typecheck / tests**

Run: `npx vitest run src/lib/wpbl-team-brand.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/wpbl/GameDetailClient.tsx src/components/wpbl/LineScore.tsx src/components/wpbl/BoxTables.tsx
git commit -m "$(cat <<'EOF'
feat(wpbl): brand game detail header, line score, and box tabs

EOF
)"
```

---

### Task 5: Visual verification

**Files:** none required unless contrast fixes are needed

- [ ] **Step 1: Manual / local check**

If the app can run locally, open `/wpbl` and one `/wpbl/games/[id]`:
- Logos visible on filter, standings, schedule, game header, line score, box tabs
- Leader rows show distinct left colors for LA / NY / SF / BOS
- NY white logo readable on light mode (add dark pad if not)
- Dark mode still readable

If you cannot run the UI, at least confirm logo files load via `curl -I http://localhost:3000/wpbl/la.png` when the server is up, or that files exist under `public/wpbl/`.

- [ ] **Step 2: Fix any contrast/path issues and commit if needed**

```bash
git add -A public/wpbl src/components/wpbl src/lib/wpbl-team-brand.ts
git commit -m "$(cat <<'EOF'
fix(wpbl): tweak team brand contrast and logo paths

EOF
)"
```

Only commit if there were actual fixes.

---

## Self-review checklist (plan author)

1. Spec coverage: logos everywhere, leader left accents, official colors, static hosting, fallbacks — covered in Tasks 1–4.
2. No placeholders left in steps.
3. Types/names consistent: `getWpblTeamBrand`, `wpblTeamPrimary`, `wpblTeamLogoSrc`, `TeamLogo`, `teamAccentStyle`.
