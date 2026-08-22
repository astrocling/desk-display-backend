# WPBL player detail pages (MLB-style)

**Date:** 2026-08-22  
**Status:** Draft — investigation / proposed for approval  
**Repo:** `desk-display-backend`  
**Scope:** Add `/wpbl/players/[id]` detail pages and supporting API/cache, modeled on [MLB.com player pages](https://www.mlb.com/player/), wired from leaders and (optionally) box scores. Extends the WPBL stats board that deliberately deferred profiles in the 2026-08-21 design.

## Goals

- Give each WPBL player a **dedicated detail page** that feels like a slimmed MLB.com player page: identity header, season summary, batting/pitching(/fielding) tables, and a recent game log.
- Reuse existing WPBL `/v1` JSON + WordPress headshot plumbing already used by leaders.
- Make players **reachable** from the league UI (leaders first; boxscore names when IDs are available).
- Keep dial / `/api/scores` HTML WPBL path unchanged.

## Non-goals

- Career / multi-season history (league is first season; API is season-scoped)
- News, awards, video, fantasy, Statcast/TrackMan
- Full MLB bio essays, school history, or social feeds (WP `bio` / social ACF fields are mostly empty today)
- Splits beyond what we can derive cheaply from the game log (home/away, last N games can be a later slice)
- Team roster index page (can follow; not required for v1 player pages)
- Auth / SEO marketing polish

## Why now

The original WPBL stats design listed **player profile pages** as a non-goal. Since then we have:

- MLB-style leaders UI with headshots + team marks
- Stable `playerId` on every leader row
- Confirmed upstream endpoints for profile, season stats, and **per-game logs**

Official marketing pages at `womensprobaseballleague.com/players/{slug}` already show Season Statistics + Game Log + About. Our page should be the **personal-board equivalent**: denser, linked from our leaders/box, same Redis/API patterns as game detail — not a clone of the marketing site.

## MLB.com reference (what to emulate)

MLB player pages are organized as:

| MLB section | Emulate? | WPBL reality |
|-------------|----------|--------------|
| Hero: name, #, pos, team, headshot | **Yes** | Stats API + WP headshot map |
| Season summary chips (key batting / pitching) | **Yes** | Derive from season stats |
| Season / career tables | **Season only** | `/v1/players/{id}/stats` |
| Bio (born, bats/throws, height, etc.) | **Light bio strip** | Stats `presto_data` + WP ACF when present |
| Splits (last 7/15/30, last 3 games) | **Phase 2** | Derivable from `/games` log |
| Game log / last games | **Yes** | `/v1/players/{id}/games` |
| News / awards / video | **No** | No usable feed |

Tone: dark board already used on `/wpbl` (leaders card language), team accent + logo, not a new visual system.

## Upstream inventory (verified 2026-08-22)

Base: `https://stats.womensprobaseballleague.com`

### `GET /v1/players/{id}`

Identity blob. Useful fields:

- `player_id`, `team_id`, `first_name`, `last_name`, `position`, `uniform`
- `player_status` / `is_active`
- `profile_url` (official marketing page)
- `presto_data.data`: `bats`, `throws`, `hometown` (height/weight/dob often empty)
- `headshot_url` still empty league-wide → keep using WP headshot map

### `GET /v1/players/{id}/stats?season_id=`

Season aggregation (`calculation_version: baseball-v3`):

- `batting` — counting stats (AB, H, HR, RBI, BB, SO, SB, …). **No AVG/OBP/SLG/OPS** — we must compute.
- `pitching` — IP/outs, ERA, W/L/SV, SO, BB, H, ER, pitch_count, …
- `fielding` — PO/A/E, fielding_percentage, …
- `team_splits[]` — same groups per team (useful if anyone moves mid-season)

Also includes `profile_url`, `source_through`, `player_name`.

### `GET /v1/players/{id}/games?season_id=`

Game log (`count` + `games[]`). Each row:

- Matchup: `game_id`, `scheduled_start`, `side`, `result`, `team_runs` / `opponent_runs`, `opponent_team_id` / `opponent_team_name`, `is_final`
- Optional `batting` / `pitching` / `fielding` blocks (null when DNP that side)
- Per-game `source_stats` often carries display rates (`obp`, `slg`, `ops`, `whip`, `ip`, …) even when top-level counting fields are null

### WordPress `wpbl_player` CPT

Already fetched for headshots (`src/lib/fetchers/wpbl-v1/headshots.ts`). Extra ACF useful for bio strip:

- `birthdate`, `city` / `state` / `country`, `jersey_number`, `bats` / `throws`, `draft_selection_rank`, `stats_player_id`
- `bio` / `scouting_report` / socials — usually empty; soft-include only when non-empty

### Boxscore linkage gap

Upstream boxscore players include `id` (stats player id) and `profile_url`, but our mapper currently drops them — `WpblBoxPlayerLine` is name/position/stats only. Linking box rows requires a small schema extension.

## Approach

Mirror **game detail**: on-demand fetch + Redis per player, soft-fail to last-good; leaders remain the discovery surface.

```text
WPBL /v1/players/{id}
     /v1/players/{id}/stats
     /v1/players/{id}/games
WP  headshot map (existing)
        │
        ▼
 GET /api/wpbl/players/[id]  →  refresh if missing/stale
        │
        ▼
 Redis wpbl:player:{id}
        │
        ▼
 /wpbl/players/[id]  (client page, same shell as game detail)
```

**Cron:** do **not** pre-warm all ~69 player blobs on the 5-minute cron (that would multiply upstream fan-out). Keep cron on league + leaders only. Player pages refresh on read (and optionally a short TTL). Leaders cron already hits every player’s season stats — we can later consider writing a slim season snapshot into player keys as an optimization, but v1 should not require it.

## Architecture

### New modules

| Piece | Role |
|-------|------|
| `src/lib/fetchers/wpbl-v1/player.ts` | Fetch + map profile/stats/games → display DTO; compute rate stats |
| `src/app/api/wpbl/players/[id]/route.ts` | GET with Redis + on-demand refresh |
| `src/app/wpbl/players/[id]/page.tsx` | Route shell |
| `src/components/wpbl/PlayerDetailClient.tsx` | UI (header, season tables, game log) |
| Types on `wpbl-display.ts` | `WpblPlayerDetailResponse`, game-log row, bio |

### Redis

| Key | Contents |
|-----|----------|
| `wpbl:player:{id}` via `wpblPlayerKey(id)` | Full player detail response + `updatedAt` |

Refresh policy (align with games):

| Condition | Action |
|-----------|--------|
| Missing blob | Fetch upstream, write Redis |
| `updatedAt` older than ~5 minutes | Refresh on read |
| Upstream failure with last-good | Return last-good |
| Unknown id (404) | 404 — do not cache empty |

### Rate-stat helpers

Season batting rates are **not** in the API. Compute display strings consistently with leaders:

- `AVG` = H / AB (leaders already format `.xxx`)
- `OBP` = (H + BB + HBP) / (AB + BB + HBP + SF) when denominator > 0  
  (confirm SF available; else document fallback without SF)
- `SLG` = TB / AB — prefer API `total_bases` when non-zero; else `1B + 2*2B + 3*3B + 4*HR` with `1B = H - 2B - 3B - HR`
- `OPS` = OBP + SLG
- Pitching: use API `era`; `WHIP` = (H + BB) / IP when IP > 0 (IP from `innings_pitched` or `outs_pitched / 3`)

Unit-test these with the existing trimmed fixtures.

## Pages & UI

### Route

- `/wpbl/players/[id]` — player detail (`id` = stats `player_id`)

### Layout (MLB-inspired, one scroll)

1. **Back link** → `/wpbl` (and optional crumb: Leaders)
2. **Hero**
   - Headshot (WP map / roster URL; initials fallback like leaders)
   - Name as primary text; team logo + abbr; `#uniform` · position
   - Light bio line: B/T · hometown · birth year if known
   - Team left-accent / primary color consistent with branding
3. **Season summary chips** (pick by role)
   - If batting AB > 0: AVG, HR, RBI, SB (and OPS if computed)
   - If pitching outs > 0: W-L, ERA, SO, IP (and WHIP if computed)
   - Two-way players show both rows (MLB does this for Ohtani-style pages)
4. **Season statistics** — tables, Hitting | Pitching | Fielding tabs (hide empty groups)
5. **Game log** — newest first; columns depend on tab or a combined row with batting line + pitching line when both present; each `game_id` links to `/wpbl/games/{id}`
6. **Footer meta** — `updatedAt` / `source_through`; optional external link to official `profile_url`

No cards-for-decoration; tables and the existing dark leaders aesthetic.

### Entry points

| Surface | Change |
|---------|--------|
| `LeadersBoards` rows | Wrap name (or whole row) in `Link` → `/wpbl/players/{playerId}` |
| Box score player names | After adding `playerId` to `WpblBoxPlayerLine`, link when id present |
| Live key-player names | Optional follow-up (situation is name-only today) |

## API contract

### `GET /api/wpbl/players/[id]`

```ts
interface WpblPlayerDetailResponse {
  updatedAt: string;
  seasonId: string;
  player: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    teamId: string;
    teamAbbr: string; // LA | NY | SF | BOS
    teamName: string;
    position: string | null;
    uniform: string | null;
    bats: string | null;
    throws: string | null;
    hometown: string | null;
    birthdate: string | null; // ISO date when known
    status: string | null; // ACTIVE, etc.
    headshotUrl: string | null;
    profileUrl: string | null; // official WPBL page
  };
  season: {
    sourceThrough: string | null;
    batting: WpblPlayerBattingSeason | null; // null if no batting activity
    pitching: WpblPlayerPitchingSeason | null;
    fielding: WpblPlayerFieldingSeason | null;
  };
  gameLog: WpblPlayerGameLogEntry[];
}

interface WpblPlayerGameLogEntry {
  gameId: string;
  startIso: string | null;
  side: "away" | "home";
  result: "W" | "L" | "T" | null;
  teamRuns: number | null;
  opponentRuns: number | null;
  opponentAbbr: string;
  opponentName: string;
  isFinal: boolean;
  batting: Record<string, string | number | null> | null;
  pitching: Record<string, string | number | null> | null;
  fielding: Record<string, string | number | null> | null;
}
```

Season objects should expose both **raw counts** (for tables) and **display-ready rates** (`avg`, `obp`, `slg`, `ops`, `era`, `whip`, `ip`, `w`, `l`, …).

Errors:

- Unknown player → **404**
- Empty cache and upstream failure → **502/503** with message (same spirit as game detail)
- Empty cache never written → no silent empty 200

### Boxscore type tweak (companion)

```ts
interface WpblBoxPlayerLine {
  side: "away" | "home";
  playerId: string | null; // NEW — upstream box player id when present
  name: string;
  position: string | null;
  stats: Record<string, string | number | null>;
}
```

## Reliability

- Soft-fail individual upstream legs: prefer returning a page with season + empty log (or log + empty fielding) over failing entirely when one call 404s/500s; set a `partial: boolean` if useful (leaders already use this pattern).
- Preserve last-good Redis on refresh failure.
- Headshots: reuse `fetchWpblHeadshotMap` / `resolvePlayerHeadshot`; never block the page on WP failure.
- Do not hammer WPBL: in-process TTL on `fetchWpblJson` already helps; player route should not fan out beyond the three player endpoints + shared headshot map.

## Testing

- Fixtures: trimmed `/v1/players/{id}`, `/stats`, `/games` samples (Albayati two-way is a good fixture).
- Unit tests: rate-stat math; game-log mapping (null pitching vs appearance); team abbr from `team_id` / opponent id.
- API tests: 404 unknown id; Redis hit skips upstream; stale refresh; last-good on upstream error.
- UI: leaders row navigates to player route (lightweight component test or manual check).

## Success criteria

- From `/wpbl` leaders, open a player and see identity + season batting and/or pitching that match the official stats API.
- Game log lists recent games and deep-links into existing game detail.
- Two-way players show both batting and pitching without a separate “mode” URL.
- Dial sports path and existing league/game APIs remain unaffected.

## Implementation notes

- Read current Next.js docs under `node_modules/next/dist/docs/` before adding the route.
- Follow game-detail patterns (`refreshWpblGame` / `shouldRefreshWpblGame`) rather than inventing a new cache style.
- Prefer computing rates in the mapper once; UI should mostly render strings.
- Phase 2 (optional): last-7 / last-15 chips from game log; roster page `/wpbl/teams/[abbr]`; link live situation names once batter/pitcher ids exist upstream.

## Open questions (resolve before / during implementation)

1. **TTL:** 5 minutes on-read vs only refresh when leaders cron just ran — 5 minutes is simpler and matches “personal board” freshness.
2. **Fielding tab in v1:** Official site shows it; data exists. Recommend **include** if non-empty, else hide.
3. **Slug URLs:** MLB uses `/player/name-id`. We should keep **id-only** routes (`/wpbl/players/{id}`) for stability; names can change, ids do not.
4. **Bio enrichment:** Fetch WP ACF on each player request vs extend headshot map to carry birthdate/hometown. Recommend **extend headshot map into a small “player media/bio” map** keyed by `stats_player_id` to avoid a second WP pagination scheme — or one-off WP fetch by `stats_player_id` if the API supports a meta query; otherwise keep bio minimal from stats `presto_data` only for v1.
