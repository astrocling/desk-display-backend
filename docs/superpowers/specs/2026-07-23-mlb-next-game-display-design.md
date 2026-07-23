# MLB next-game display strings

**Date:** 2026-07-23  
**Status:** Approved for implementation  
**Repo:** `desk-display-backend`  
**Scope:** Enrich `GET /api/scores` → `mlb` with human-readable next-game + standings fields when the configured team is **not live**. Firmware/sim rendering is a separate follow-up in `desktop-display-firmware`.

## Goals

- When `mlb.live === false` and a next game is known, expose dial-ready strings:
  - Matchup (baseball style, nicknames)
  - Eastern-time start (`Fri 7/24 7:40 PM`)
  - Team record
  - Division place + GB / GU
- Keep existing fields (`live`, `score`, `inning`, `nextGame`) so current clients keep working.
- All formatting and ESPN standings logic stay on the backend (no TZ math on the dial).

## Non-goals

- Changing live-game score/inning presentation (leave as today)
- Firmware / LVGL / sim UI changes (document expected consumer layout only)
- New HTTP routes or Redis keys
- Wild-card standings, streak, or opponent record
- Multi-team config (still single `MLB_TEAM`)

## Intended dial layout (consumer contract)

Firmware will eventually render not-live MLB roughly as:

```text
Next Game
Astros @ Mariners
Fri 7/24 7:40 PM
50-54
3rd AL West · 2 GB
```

Backend responsibility ends at producing the strings; labels like `Next Game` may be hard-coded on device.

## API contract

Extend `MlbScores` in `src/lib/types/scores.ts`. Cron and `GET /api/scores` unchanged — they already persist/return the blob.

```ts
export interface MlbScores {
  live: boolean;
  score: string | null;
  inning: string | null;
  /** ISO start of next/upcoming game when not live; null when live. */
  nextGame: string | null;

  /**
   * Baseball-style matchup using nicknames for MLB_TEAM vs opponent.
   * Home: "Astros vs. Rangers"
   * Away: "Astros @ Rangers"
   * Null when no upcoming/current non-live game context.
   */
  matchup: string | null;

  /**
   * Next/upcoming tip-off in America/New_York.
   * Format: "Fri 7/24 7:40 PM" (abbrev weekday, no leading zero on month/day/hour).
   * Null when no nextGame.
   */
  whenEt: string | null;

  /** Overall W-L for MLB_TEAM, e.g. "50-54". Null if standings unavailable. */
  record: string | null;

  /**
   * Division line for MLB_TEAM, e.g. "3rd AL West · 2 GB" or "1st AL West · 1.5 GU".
   * Null if standings unavailable.
   */
  standingLine: string | null;
}
```

### Field population rules

| State | `live` | `matchup` / `whenEt` | `record` / `standingLine` | `nextGame` |
|-------|--------|----------------------|---------------------------|------------|
| In progress | `true` | `null` | still populate if cheap (optional; prefer always populate when standings fetch succeeds) | `null` |
| Scheduled today / upcoming | `false` | from that game | from standings | ISO of that game |
| Final today, next found | `false` | from **next** scheduled game | from standings | ISO of next |
| No game found | `false` | `null` | still populate if standings ok | `null` |

**Recommendation:** Always attach `record` / `standingLine` whenever the standings fetch succeeds, including live games — costs one extra ESPN call and keeps the blob useful. Matchup/`whenEt` only when there is a non-live game to describe (scheduled or next).

### Example (not live)

```json
{
  "mlb": {
    "live": false,
    "score": null,
    "inning": null,
    "nextGame": "2026-07-24T23:40:00Z",
    "matchup": "Astros @ Mariners",
    "whenEt": "Fri 7/24 7:40 PM",
    "record": "50-54",
    "standingLine": "3rd AL West · 2 GB"
  },
  "flagstand": { "...": "..." },
  "updatedAt": "2026-07-23T19:00:00.000Z"
}
```

Update `docs/BACKEND_PLAN.md` `GET /api/scores` section to match.

## ESPN data plan

Reuse existing scoreboard flow in `src/lib/fetchers/mlb.ts`. Add:

1. **Matchup** from the competition used for `nextGame` (or today’s `pre` game):
   - Competitors already expose `homeAway` and `team.shortDisplayName` (nickname, e.g. `Astros`).
   - Let `us` = configured team competitor, `opp` = other.
   - If `us.homeAway === "home"` → `{usNick} vs. {oppNick}`
   - Else → `{usNick} @ {oppNick}`
   - Prefer `shortDisplayName`; fall back to `name` then `abbreviation`.

2. **`whenEt`** from that competition’s `date` (ISO):
   - `Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })`
   - Normalize to exactly `Fri 7/24 7:40 PM` (drop comma if present; ensure single spaces; `AM`/`PM` uppercase).
   - Unit-test the formatter with fixed ISO inputs (do not depend on machine local TZ).

3. **Record + standing line** via division standings:
   - `GET https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{abbr}` → `team.groups.id` (e.g. Astros → `"3"` for AL West) and optional nickname sanity check.
   - `GET https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?group={id}` → ordered division entries.
   - For configured team entry:
     - `record` = overall summary (`stats` name `overall` display, or `wins`/`losses` → `"50-54"`).
     - Rank = 1-based index in the returned entry order (ESPN returns division order; verify sort is standings order — currently TEX, SEA, HOU, …).
     - Ordinal: `1st`, `2nd`, `3rd`, `4th`, `5th` (standard English rules).
     - Division short name from standings payload (`shortName` e.g. `AL West`).
     - Games behind: use `divisionGamesBehind` display/value.
       - If team is **1st** (rank 1) **or** `divisionGamesBehind` display is `"-"` / value `0`: compute **games up** vs 2nd place as `second.divisionGamesBehind` value (e.g. `0.5` → `0.5 GU`, `2` → `2 GU`). If only one team or cannot compute, use `0 GU`.
       - Else: `{gb} GB` using ESPN’s display when sensible (strip trailing `.0` only if you already normalize; prefer ESPN display for half-games: `2`, `0.5`, `2.5`).
     - `standingLine` = `{ordinal} {divShort} · {gbOrGu}` e.g. `3rd AL West · 2 GB`, `1st AL West · 0.5 GU`.

### Failure / partial behavior

- Scoreboard succeeds, standings/team fails → still return live/score/inning/nextGame/matchup/whenEt; set `record` and `standingLine` to `null` (do not fail the whole cron).
- No next game → `matchup`/`whenEt`/`nextGame` null; standings fields may still be present.
- Missing nickname on a competitor → fall back as above; never throw for display formatting alone.

## Implementation sketch (`mlb.ts`)

Keep public API: `fetchMlb(teamAbbr: string): Promise<MlbScores>`.

Suggested internal helpers (names flexible):

- `formatMatchup(teamAbbr, competition) → string | null`
- `formatWhenEt(iso: string) → string`
- `formatOrdinal(n: number) → string`
- `fetchTeamDivisionGroupId(teamAbbr) → string`
- `fetchDivisionStanding(teamAbbr) → { record, standingLine } | null`
- Change `findNextScheduledGame` to return `{ iso, competition }` (or equivalent) so matchup can be built without a second lookup.

Parallelism: after today’s scoreboard path knows whether it needs a lookahead, fetch standings **in parallel** with lookahead scoreboard days when possible (standings do not depend on next-game date).

## Tests (`mlb.test.ts`)

Extend Vitest mocks:

1. **Live game** — existing assertions; add new fields (`matchup`/`whenEt` null or per population rules; record/standing if standings mocked).
2. **Not live + next game** — mock scoreboard(s) with `shortDisplayName` + home/away; mock team + standings; assert exact `matchup`, `whenEt`, `record`, `standingLine`.
3. **Away matchup** — `Astros @ Rangers`.
4. **Home matchup** — `Astros vs. Rangers`.
5. **Division leader GU** — team rank 1, second has `divisionGamesBehind` `1.5` → `… · 1.5 GU`.
6. **Standings fetch fails** — scoreboard still returns nextGame/matchup/whenEt; record/standingLine null; no throw.
7. **`formatWhenEt`** — pure tests for a couple of UTC ISOs → Eastern strings (cover EDT vs EST if easy with known dates).

## Docs

- Update `docs/BACKEND_PLAN.md` scores example + field table.
- This spec is the source of truth for the new fields until the plan doc is updated.

## Firmware follow-up (out of scope here)

In `desktop-display-firmware`:

- Extend `MlbScores` / `parseScores` / `SportsMlbView` / sim Sports UI to show the five-line not-live layout.
- Refresh `fixtures/scores.json` from live `/api/scores` after backend deploys.

## Acceptance checklist

- [ ] `MlbScores` includes `matchup`, `whenEt`, `record`, `standingLine`
- [ ] Not-live next game produces baseball-style nickname matchup + `Fri 7/24 7:40 PM`-style ET time
- [ ] Standing line uses ordinal + division short name + `GB` or `GU`
- [ ] Partial failure does not break scores cron / scoreboard fields
- [ ] Unit tests cover home/away, GU, and standings failure
- [ ] `BACKEND_PLAN.md` documents the new fields
- [ ] Manual: `curl` local or deployed `/api/scores` shows populated strings for `MLB_TEAM=HOU`
