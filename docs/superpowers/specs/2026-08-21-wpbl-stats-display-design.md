# WPBL stats display (personal league board)

**Date:** 2026-08-21  
**Status:** Approved for implementation  
**Repo:** `desk-display-backend`  
**Scope:** Public Next.js pages and Redis-backed APIs that pull Women’s Pro Baseball League data from the official stats JSON API and present standings, full schedule, batting/pitching leaders, and game box scores for personal use for the remainder of the 2026 season.

## Goals

- Give a **personal command center** that is more useful than the official WPBL stats UI for day-to-day following of the league.
- Show **standings**, **full season schedule**, **stats leaders**, and **game detail** (line score + batting/pitching).
- **Neutral league view** by default, with the ability to **filter by team** (All | LA | NY | SF | BOS).
- Host as a **public route** on this app (e.g. `/wpbl`), same deployment as radar — no auth for v1.
- Prefer **manual refresh**, with **light auto-poll (~45–60s)** only when a game is live (main page + that game’s detail page).
- Keep the existing dial WPBL HTML scraper and `GET /api/scores` → `wpbl` contract **unchanged**.

## Non-goals

- Dial / firmware changes
- Replacing or unifying the homepage-HTML WPBL path used by `/api/scores`
- Play-by-play, TrackMan, WebSockets, or a full Game Center clone
- Auth, SEO/marketing polish, or password gating
- Player profile pages or multi-season history beyond the current season
- Favorite-team localStorage preference (team filter is enough for v1)

## Context

- This app already caches sports for the desk dial: cron → Upstash Redis → public GETs. WPBL on the dial comes from HTML parse of `https://stats.womensprobaseballleague.com/` (today’s slate + basic standings only).
- The same host exposes a JSON API used by their Game Center, including at least:
  - `GET /v1/games` — full schedule (~47 games), scores, status
  - `GET /v1/teams` and `GET /v1/teams/{id}/stats?season_id=` — standings-quality team season stats
  - `GET /v1/teams/{id}/players` — roster
  - `GET /v1/players/{id}/stats?season_id=` — player season stats
  - `GET /v1/games/{id}` and `GET /v1/games/{id}/boxscore` — game + boxscore
- There is **no** ready-made `/v1/leaders` endpoint; leaders are derived by aggregating player season stats (~69 players).

## Approach

**New WPBL JSON client + Redis cache + dedicated UI**, separate from the dial HTML scraper.

```text
WPBL /v1 (games, team stats, player stats, boxscore)
        │
        ▼
 Cron + on-demand refreshers  →  Upstash Redis blobs
        │
        ▼
 GET /api/wpbl/*  →  /wpbl UI (RSC + light client poll when live)
```

## Architecture

### Ingestion

- Server-only fetchers under `src/lib/fetchers/wpbl-v1/` that call WPBL `/v1` with `Accept: application/json`.
- **Season id** discovered from game/team payloads (current season observed as `c9sgab9f9yx00z75`); resolve from live data first, with that id as fallback only if discovery fails.
- Team abbreviations stay aligned with the dial map: LA Queens, NY Heights, SF Firebells, BOS Hunters.
- Soft-fail per upstream call; **never overwrite a good Redis blob with empty on failure**.

### Redis blobs

| `REDIS_KEYS` entry | Contents |
|--------------------|----------|
| `wpblLeague` → `wpbl:league` | Standings + full schedule + `updatedAt` |
| `wpblLeaders` → `wpbl:leaders` | Ranked batting/pitching boards + qualifier metadata + `updatedAt` |
| `wpblGame(id)` → `wpbl:game:{id}` | Game header + boxscore projection + `updatedAt` |

### Refresh policy

| Data | When |
|------|------|
| League snapshot + leaders | Cron every ~5 minutes (sibling to or alongside scores cron; Bearer `CRON_SECRET`) |
| Game boxscore | On `GET /api/wpbl/games/[id]` if missing, or stale while game may be live (~45–60s), or first fetch after final |
| UI poll | Client polls our APIs every ~45–60s **only if** any game (home) or this game (detail) has status `live` |

### Dial isolation

- `src/lib/fetchers/wpbl.ts` (HTML homepage) and `ScoresBlob.wpbl` remain the dial path.
- No requirement to migrate the dial onto JSON in this project.

## Pages & UI

### Routes

- `/wpbl` — league home
- `/wpbl/games/[id]` — game detail
- Link from existing `src/app/page.tsx` next to Radar

### League home (`/wpbl`)

One scrollable page, three blocks:

1. **Standings** — full table from team season stats: rank, team, W, L, T, PCT, GB, RF, RA, DIFF, L10, streak (columns may trim on narrow screens; horizontal scroll acceptable).
2. **Schedule** — full season from `/v1/games`. Emphasize upcoming + recent finals; older finals below or visually de-emphasized. Status badges: `scheduled` | `live` | `final`. Rows link to game detail. Prefer API as source of truth; collapse obvious duplicate matchups only if the API still emits them.
3. **Leaders** — compact boards (top ~5–10): batting e.g. AVG, HR, RBI, H; pitching e.g. ERA, SO, W, SV. Omit a board if the category has no usable data. Show qualifier note for rate stats (e.g. min AB).

**Team filter:** All | LA | NY | SF | BOS. Filters schedule and leaders; standings remain full-league (optional highlight of selected row). No persisted preference in v1.

**Tone:** Useful personal board — clear tables, phone + desktop readable. May nod at WPBL green without cloning their marketing site.

### Game detail (`/wpbl/games/[id]`)

- Header: away @ home, status, score, inning/half when applicable, `updatedAt`
- Line score table
- Batting and pitching tables (tabs or stacked)
- Soft empty state if boxscore not yet available
- Back link to `/wpbl`
- Auto-poll our game API when status is `live`

## API contract

All responses include `updatedAt` (ISO). Empty cache → **503** (same pattern as other read APIs). Last-good served when upstream fails after a successful cache write.

### `GET /api/wpbl`

League snapshot.

```ts
interface WpblLeagueResponse {
  updatedAt: string;
  seasonId: string;
  standings: WpblStandingRow[];
  games: WpblScheduleGame[];
}

interface WpblStandingRow {
  teamId: string;
  abbr: string; // LA | NY | SF | BOS
  name: string; // Queens | Heights | …
  rank: number;
  w: number;
  l: number;
  t: number;
  pct: string | null;
  gb: string | null;
  rf: number;
  ra: number;
  diff: number;
  l10: string | null; // e.g. "5-3"
  streak: string | null; // e.g. "L1"
}

type WpblGameStatus = "scheduled" | "live" | "final" | "other";

interface WpblScheduleGame {
  id: string;
  status: WpblGameStatus;
  startIso: string | null;
  whenEt: string | null;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayRuns: number | null;
  homeRuns: number | null;
  venue: string | null;
  countsInStandings: boolean;
}
```

Map upstream status strings (`Final`, `Upcoming`, live variants, etc.) into `WpblGameStatus`. Unknown → `other`.

### `GET /api/wpbl/leaders`

```ts
interface WpblLeadersResponse {
  updatedAt: string;
  seasonId: string;
  partial: boolean; // true if some player fetches failed
  qualifiers: {
    /** Floor for AVG (and any other rate batting boards). Default **10 AB**. */
    battingMinAb: number;
  };
  batting: {
    avg: WpblLeaderEntry[];
    hr: WpblLeaderEntry[];
    rbi: WpblLeaderEntry[];
    h: WpblLeaderEntry[];
  };
  pitching: {
    era: WpblLeaderEntry[];
    so: WpblLeaderEntry[];
    w: WpblLeaderEntry[];
    sv: WpblLeaderEntry[];
  };
}

interface WpblLeaderEntry {
  playerId: string;
  name: string;
  teamAbbr: string;
  value: string; // display-ready, e.g. ".312", "7", "1.93"
  sortValue: number; // for stable ranking
}
```

Leaders are built by listing each team’s roster, fetching player season stats, and ranking. AVG requires `battingMinAb` (default **10**); counting boards (HR, RBI, H, SO, W, SV) have no minimum. ERA uses pitchers with outs pitched > 0 (exclude never-thrown). Empty boards may be omitted from the UI but keys above are the contract.

### `GET /api/wpbl/games/[id]`

```ts
interface WpblGameDetailResponse {
  updatedAt: string;
  game: WpblScheduleGame & {
    /** Live/final inning label when known, e.g. "Top 5"; null otherwise. */
    inning: string | null;
  };
  boxscore: {
    available: boolean;
    lineScore: {
      maxInning: number;
      teams: Array<{
        side: "away" | "home";
        abbr: string;
        name: string;
        innings: Array<{ inning: number; runs: number | null }>;
        runs: number | null;
        hits: number | null;
        errors: number | null;
        lob: number | null;
      }>;
    } | null;
    batting: WpblBoxPlayerLine[];
    pitching: WpblBoxPlayerLine[];
  };
}

interface WpblBoxPlayerLine {
  side: "away" | "home";
  name: string;
  position: string | null;
  stats: Record<string, string | number | null>; // mapped display columns
}
```

If the game id is unknown and never cached → 404. If game known but boxscore missing → **200** with `boxscore.available: false` and empty tables (not 500).

### Cron

- New cron route `/api/cron/wpbl` protected by `CRON_SECRET`, registered in `vercel.json` at a ~5 minute cadence.
- Refreshes `wpbl:league` and `wpbl:leaders`. Does not refresh every boxscore.

## Reliability

- Soft-fail per WPBL call; preserve last-good Redis.
- Surface `updatedAt` in the UI; official feed may include delay — do not claim real-time.
- Leaders: on partial player failures set `partial: true` and still return ranked lists from successful fetches.
- Duplicate/ghost schedule rows: trust `/v1/games`; only collapse if duplicates are confirmed in fixtures.

## Testing

- Unit tests + JSON fixtures for mappers: games list, team stats → standings, player stats → leaders (incl. qualifier), boxscore → line/batting/pitching.
- API route tests: empty Redis → 503; upstream failure → last-good; game detail without boxscore → 200 + `available: false`; live refresh gating.
- No CI dependency on live WPBL network calls.

## Success criteria

- Open `/wpbl` and see current standings, full schedule, and leaders without using the official site.
- Filter by team and still understand league context (full standings).
- Open any game and see a usable line score and box batting/pitching when the official boxscore exists.
- During a live game, light auto-poll keeps the page reasonably current without WebSockets or a major live subsystem.
- Dial sports path remains unaffected.

## Implementation notes

- Follow existing patterns: `src/lib/fetchers/*`, Redis helpers, Vitest fixtures, App Router pages under `src/app/`.
- Read current Next.js docs under `node_modules/next/dist/docs/` before adding routes/components (repo uses a Next version that may differ from training data).
- Prefer small, testable mapper modules over one mega-scraper file.
