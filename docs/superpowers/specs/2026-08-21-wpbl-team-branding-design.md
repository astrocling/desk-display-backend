# WPBL team branding (logos + colors)

**Date:** 2026-08-21  
**Status:** Approved for implementation  
**Repo:** `desk-display-backend`  
**Scope:** Add official team logos and primary brand colors across the WPBL stats UI wherever teams appear (league page + game detail). Leaders and similar player rows use a left accent bar in team color.

## Goals

- Show **team logos** next to teams on standings, schedule, team filter, game header, and line score.
- Color-code **individual leader rows** (and analogous player rows where useful) with a **left accent bar** in the player’s team primary color so affiliation is visible at a glance.
- Use **official WPBL brand assets** and published primary colors, hosted statically in the app (no runtime CDN dependency).

## Non-goals

- Full brand-kit recreation (wordmarks, secondary patterns, jersey textures)
- Full-row background tints or colored table themes
- Dial / firmware / `/api/scores` HTML WPBL path changes
- API or Redis schema changes for branding (UI maps from existing abbrs)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Everywhere teams appear (league + game detail) |
| Logo source | Official WPBL assets, downloaded into `public/wpbl/` |
| Leader color cue | ~3px left accent bar (primary only) |
| Colors | Official / published primaries, hardcoded hex |
| Architecture | Shared brand map + small presentational helpers |

## Brand data

Centralize branding keyed by team abbr (`LA` | `NY` | `SF` | `BOS`), alongside or extending `src/lib/fetchers/wpbl-v1/teams.ts`:

| Abbr | Team | Primary accent (initial) | Notes |
|------|------|--------------------------|--------|
| LA | Queens | `#AF9067` (gold) | Black/gold/white; gold is the readable accent on slate UI |
| NY | Heights | `#0B1F3A` (navy) | Navy / light blue / white |
| SF | Firebells | `#5B2A8C` (purple) | Purple / red / lavender; International Orange `#FF4F00` optional secondary only |
| BOS | Hunters | `#0B6B3A` (green) | Green / orange / cream |

Exact hexes may be refined by sampling the official media kit marks if published values differ slightly; contrast on light and dark slate backgrounds is required.

**Logo assets**

- Prefer files from the official kit:  
  `https://www.womensprobaseballleague.com/wp-content/uploads/2026/07/WPBL-Team-Brands-Media-Kit-20260708T133043Z-3-001.zip`
- Fallback known web marks if kit extraction is awkward:
  - LA: `…/2026/07/queens-logo-q.png`
  - NY: `…/2026/07/ny-white-logo.png` (may need a dark-friendly variant or dark pill behind the mark)
  - BOS: `…/2026/07/hunters-logo.png`
  - SF: `…/2025/12/SF-I-R-1.webp` (or kit SVG/PNG)
- Store under `public/wpbl/` as stable paths, e.g. `la.png`, `ny.png`, `sf.png`, `bos.png` (extension matches chosen format).

## UI components

### `getWpblTeamBrand(abbr: string)`

Returns `{ abbr, primary, logoSrc, name }` or a neutral fallback (`primary: slate`, `logoSrc: null`) for unknown abbrs.

### `TeamLogo`

- Renders `next/image` or `<img>` at fixed sizes (`sm` ~16–20px for lists, `md` ~24–28px for headers).
- `alt=""` when adjacent text already names the team; otherwise `alt="{fullName} logo"`.
- On error / missing `logoSrc`: render nothing (caller keeps abbr text).

### Team accent

- Utility: `teamAccentStyle(abbr)` → `{ borderLeftColor: primary }` or class + CSS variable.
- Accent width ~3px; do not change row height for desk density.

## Placement

| Surface | Treatment |
|---------|-----------|
| **TeamFilter** | Logo beside label; active button may use team primary as border/background accent (keep readable contrast) |
| **StandingsTable** | Logo before abbr + name |
| **ScheduleList** | Logos beside away/home abbrs |
| **LeadersBoards** | Left accent bar per row from `entry.teamAbbr`; keep abbr text; optional tiny logo only if it does not hurt density |
| **GameDetailClient** header | Logos with away/home abbrs in the scoreline |
| **LineScore** | Logo in team label cell |
| **BoxTables** side tabs | Logo + optional primary underline/accent on active tab for that side’s team |

## Resilience

- Broken or missing logo → text labels remain; accent still applies when abbr is known.
- Unknown abbr → neutral slate accent, no crash.
- No remote fetch of logos at render time.

## Testing

- Unit tests for brand lookup: known abbrs → expected primary + logo path; unknown → fallback.
- Leaders row: accent color/style resolves correctly for each of the four abbrs.
- Manual: `/wpbl` and one `/wpbl/games/[id]` in light and dark.

## Out of scope follow-ups

- League logo in page chrome
- Cap / secondary mark variants
- Animated branding
