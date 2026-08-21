# WPBL Stats Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/wpbl` personal league board (standings, full schedule, leaders, game box scores) backed by WPBL `/v1` JSON, Redis, and new `/api/wpbl/*` routes — without changing the dial HTML WPBL path on `/api/scores`.

**Architecture:** Server-only fetchers in `src/lib/fetchers/wpbl-v1/` map official JSON into display types; cron refreshes league + leaders blobs in Redis; game boxscores refresh on read (faster while live); App Router pages at `/wpbl` and `/wpbl/games/[id]` read our APIs with light client poll only when a game is live.

**Tech Stack:** Next.js 16 App Router, TypeScript, Upstash Redis, Vitest, Tailwind 4.

## Global Constraints

- Do **not** modify `src/lib/fetchers/wpbl.ts`, `ScoresBlob.wpbl`, or dial `/api/scores` WPBL behavior.
- Soft-fail upstream: never overwrite a good Redis blob with empty on failure.
- Empty Redis → HTTP **503** on public WPBL APIs (same pattern as weather/scores).
- Season id: resolve from live `/v1` payloads first; fallback `c9sgab9f9yx00z75`.
- AVG leaderboard qualifier: **`battingMinAb: 10`**.
- Team abbrs: LA / NY / SF / BOS matching dial nicknames (Queens, Heights, Firebells, Hunters).
- Read `node_modules/next/dist/docs/` before adding App Router pages if unsure of this Next version’s conventions.
- TDD for mappers and refresh gating; JSON fixtures only (no live WPBL in CI).

**Spec:** `docs/superpowers/specs/2026-08-21-wpbl-stats-display-design.md`

---

## File map

| File | Role |
|------|------|
| `src/lib/types/wpbl-display.ts` | Public API response types from the spec |
| `src/lib/fetchers/wpbl-v1/teams.ts` | Team id/name → abbr/nickname map |
| `src/lib/fetchers/wpbl-v1/status.ts` | Upstream status string → `WpblGameStatus` |
| `src/lib/fetchers/wpbl-v1/client.ts` | Base URL, `fetchWpblJson`, season id helper |
| `src/lib/fetchers/wpbl-v1/games.ts` | Map `/v1/games` → `WpblScheduleGame[]` |
| `src/lib/fetchers/wpbl-v1/standings.ts` | Map team season stats → `WpblStandingRow[]` |
| `src/lib/fetchers/wpbl-v1/leaders.ts` | Build batting/pitching leaderboards |
| `src/lib/fetchers/wpbl-v1/boxscore.ts` | Map boxscore → line score + player lines |
| `src/lib/fetchers/wpbl-v1/refresh.ts` | Build/write league, leaders, game blobs; live TTL |
| `src/lib/fetchers/wpbl-v1/fixtures/*.json` | Trimmed API fixtures |
| `src/lib/fetchers/wpbl-v1/*.test.ts` | Unit tests colocated |
| `src/lib/config.ts` | Add `wpblLeague`, `wpblLeaders`, `wpblGame` key helpers |
| `src/app/api/cron/wpbl/route.ts` | Cron: refresh league + leaders |
| `src/app/api/wpbl/route.ts` | `GET` league snapshot |
| `src/app/api/wpbl/leaders/route.ts` | `GET` leaders |
| `src/app/api/wpbl/games/[id]/route.ts` | `GET` game detail + on-demand boxscore refresh |
| `vercel.json` | Register `*/5 * * * *` cron for `/api/cron/wpbl` |
| `src/components/wpbl/*` | Presentational UI pieces |
| `src/app/wpbl/page.tsx` | League home |
| `src/app/wpbl/games/[id]/page.tsx` | Game detail |
| `src/app/page.tsx` | Link to WPBL |
| `docs/BACKEND_PLAN.md` | Document new routes |

---

### Task 1: Types, team map, status mapper

**Files:**
- Create: `src/lib/types/wpbl-display.ts`
- Create: `src/lib/fetchers/wpbl-v1/teams.ts`
- Create: `src/lib/fetchers/wpbl-v1/status.ts`
- Create: `src/lib/fetchers/wpbl-v1/status.test.ts`

**Interfaces:**
- Produces: all types from the design spec (`WpblLeagueResponse`, `WpblStandingRow`, `WpblScheduleGame`, `WpblGameStatus`, `WpblLeadersResponse`, `WpblLeaderEntry`, `WpblGameDetailResponse`, `WpblBoxPlayerLine`)
- Produces: `WPBL_TEAMS`, `teamFromId(id)`, `teamFromFullName(name)`, `FALLBACK_SEASON_ID`
- Produces: `mapWpblStatus(raw: string): WpblGameStatus`

- [ ] **Step 1: Write failing status tests**

```ts
import { describe, expect, it } from "vitest";
import { mapWpblStatus } from "./status";

describe("mapWpblStatus", () => {
  it("maps finals including suffix variants", () => {
    expect(mapWpblStatus("Final")).toBe("final");
    expect(mapWpblStatus("Final - 8 innings")).toBe("final");
    expect(mapWpblStatus("Final - 6 innings - Weather Delay")).toBe("final");
  });

  it("maps not-started / upcoming to scheduled", () => {
    expect(mapWpblStatus("Not Started")).toBe("scheduled");
    expect(mapWpblStatus("Upcoming")).toBe("scheduled");
    expect(mapWpblStatus("Scheduled")).toBe("scheduled");
  });

  it("maps live variants", () => {
    expect(mapWpblStatus("Live")).toBe("live");
    expect(mapWpblStatus("In Progress")).toBe("live");
  });

  it("maps unknown to other", () => {
    expect(mapWpblStatus("Postponed")).toBe("other");
    expect(mapWpblStatus("")).toBe("other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/fetchers/wpbl-v1/status.test.ts`

Expected: FAIL (module / export missing)

- [ ] **Step 3: Implement types, teams, status**

Create `src/lib/types/wpbl-display.ts` with the exact interfaces from the design spec (copy from `docs/superpowers/specs/2026-08-21-wpbl-stats-display-design.md` API contract section), including `WpblGameDetailResponse.game` extended with `inning: string | null`.

Create `src/lib/fetchers/wpbl-v1/teams.ts`:

```ts
export const FALLBACK_SEASON_ID = "c9sgab9f9yx00z75";

export const WPBL_TEAMS = {
  "9f08or2mffx81409": { abbr: "BOS", name: "Hunters", fullName: "Boston Hunters" },
  v4gisr4rbgmn67b0: { abbr: "LA", name: "Queens", fullName: "Los Angeles Queens" },
  fttth861nft1j2s7: { abbr: "NY", name: "Heights", fullName: "New York Heights" },
  vhubhz8li07tmgq8: { abbr: "SF", name: "Firebells", fullName: "San Francisco Firebells" },
} as const;

export type WpblTeamAbbr = (typeof WPBL_TEAMS)[keyof typeof WPBL_TEAMS]["abbr"];

export function teamFromId(id: string) {
  return WPBL_TEAMS[id as keyof typeof WPBL_TEAMS] ?? null;
}

export function teamFromFullName(fullName: string) {
  const entry = Object.values(WPBL_TEAMS).find((t) => t.fullName === fullName);
  return entry ?? null;
}
```

Create `src/lib/fetchers/wpbl-v1/status.ts`:

```ts
import type { WpblGameStatus } from "@/lib/types/wpbl-display";

export function mapWpblStatus(raw: string): WpblGameStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "other";
  if (s.startsWith("final")) return "final";
  if (s === "live" || s.includes("in progress")) return "live";
  if (
    s === "not started" ||
    s === "upcoming" ||
    s === "scheduled" ||
    s.includes("not started")
  ) {
    return "scheduled";
  }
  return "other";
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/fetchers/wpbl-v1/status.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/wpbl-display.ts src/lib/fetchers/wpbl-v1/teams.ts src/lib/fetchers/wpbl-v1/status.ts src/lib/fetchers/wpbl-v1/status.test.ts
git commit -m "feat(wpbl): add display types, team map, and status mapper"
```

---

### Task 2: Games list mapper + client fetch helper

**Files:**
- Create: `src/lib/fetchers/wpbl-v1/client.ts`
- Create: `src/lib/fetchers/wpbl-v1/games.ts`
- Create: `src/lib/fetchers/wpbl-v1/games.test.ts`
- Create: `src/lib/fetchers/wpbl-v1/fixtures/games-sample.json` (3–5 trimmed games from `/v1/games`)

**Interfaces:**
- Consumes: `mapWpblStatus`, `teamFromId`, `teamFromFullName`, `formatWhenEt` from `@/lib/fetchers/mlb`
- Produces: `WPBL_API_BASE`, `fetchWpblJson<T>(path)`, `resolveSeasonId(games)`, `mapWpblGames(payload)`, `fetchWpblGames()`

- [ ] **Step 1: Write fixture + failing mapper tests**

Save a trimmed fixture `fixtures/games-sample.json` shaped like:

```json
{
  "count": 2,
  "games": [
    {
      "game_id": "8alsgvzc90ypwphl",
      "season_id": "c9sgab9f9yx00z75",
      "home_team_id": "fttth861nft1j2s7",
      "away_team_id": "v4gisr4rbgmn67b0",
      "home_team_name": "New York Heights",
      "away_team_name": "Los Angeles Queens",
      "status": "Final",
      "scheduled_start": "2026-08-01T21:00:00Z",
      "venue": "",
      "counts_in_standings": true,
      "presto_data": { "score": { "away": "10", "home": "8" } }
    },
    {
      "game_id": "futuregame000001",
      "season_id": "c9sgab9f9yx00z75",
      "home_team_id": "9f08or2mffx81409",
      "away_team_id": "vhubhz8li07tmgq8",
      "home_team_name": "Boston Hunters",
      "away_team_name": "San Francisco Firebells",
      "status": "Not Started",
      "scheduled_start": "2026-08-22T17:00:00Z",
      "venue": "Fenway",
      "counts_in_standings": true,
      "presto_data": { "score": { "away": "0", "home": "0" } }
    }
  ]
}
```

(Pull real rows from live `/v1/games` and trim fields; keep `presto_data.score` when present.)

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapWpblGames, resolveSeasonId } from "./games";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/games-sample.json"), "utf8"),
);

describe("mapWpblGames", () => {
  it("maps ids, status, abbrs, scores, and whenEt for scheduled", () => {
    const games = mapWpblGames(fixture);
    expect(games[0]).toMatchObject({
      id: "8alsgvzc90ypwphl",
      status: "final",
      awayAbbr: "LA",
      homeAbbr: "NY",
      awayName: "Queens",
      homeName: "Heights",
      awayRuns: 10,
      homeRuns: 8,
      whenEt: null,
      countsInStandings: true,
    });
    expect(games[1]).toMatchObject({
      status: "scheduled",
      awayAbbr: "SF",
      homeAbbr: "BOS",
      awayRuns: null,
      homeRuns: null,
    });
    expect(games[1].whenEt).toMatch(/PM$/);
    expect(games[1].startIso).toBe("2026-08-22T17:00:00Z");
  });
});

describe("resolveSeasonId", () => {
  it("reads season_id from first game", () => {
    expect(resolveSeasonId(fixture)).toBe("c9sgab9f9yx00z75");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/lib/fetchers/wpbl-v1/games.test.ts`

- [ ] **Step 3: Implement client + games mapper**

`client.ts`:

```ts
export const WPBL_API_BASE = "https://stats.womensprobaseballleague.com";

export async function fetchWpblJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${WPBL_API_BASE}${path}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`WPBL ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

`games.ts` — map each game:

- `id` ← `game_id`
- `status` ← `mapWpblStatus(status)`
- teams via `teamFromId` (fallback `teamFromFullName`)
- runs: for `scheduled`, always `null`; else parse `presto_data.score.away/home` as numbers when finite
- `startIso` ← `scheduled_start` or null
- `whenEt` ← `formatWhenEt(startIso)` only when status is `scheduled` and startIso present; else null
- `venue` ← empty string → null
- skip / soft-skip games whose teams cannot be resolved (do not throw the whole list)

Also export `fetchWpblGames()` wrapping `fetchWpblJson("/v1/games")` + `mapWpblGames`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/wpbl-v1/client.ts src/lib/fetchers/wpbl-v1/games.ts src/lib/fetchers/wpbl-v1/games.test.ts src/lib/fetchers/wpbl-v1/fixtures/games-sample.json
git commit -m "feat(wpbl): map and fetch full schedule from /v1/games"
```

---

### Task 3: Standings from team season stats

**Files:**
- Create: `src/lib/fetchers/wpbl-v1/standings.ts`
- Create: `src/lib/fetchers/wpbl-v1/standings.test.ts`
- Create: `src/lib/fetchers/wpbl-v1/fixtures/team-stats-sf.json` (real `/v1/teams/{id}/stats?season_id=` payload for Firebells; trim if huge)

**Interfaces:**
- Consumes: `teamFromId`, `fetchWpblJson`, `FALLBACK_SEASON_ID`, `WPBL_TEAMS`
- Produces: `mapTeamStatsToStanding(stats)`, `formatGb(gamesBehind)`, `fetchWpblStandings(seasonId)`, `BATTING_MIN_AB` constant export not needed here

- [ ] **Step 1: Write failing tests**

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatGb, mapTeamStatsToStanding } from "./standings";

const sf = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/team-stats-sf.json"), "utf8"),
);

describe("mapTeamStatsToStanding", () => {
  it("maps standing block to display row", () => {
    expect(mapTeamStatsToStanding(sf)).toEqual({
      teamId: "vhubhz8li07tmgq8",
      abbr: "SF",
      name: "Firebells",
      rank: 1,
      w: 5,
      l: 3,
      t: 0,
      pct: ".625",
      gb: "—",
      rf: 76,
      ra: 53,
      diff: 23,
      l10: "5-3",
      streak: "L1",
    });
  });
});

describe("formatGb", () => {
  it("uses em dash for zero", () => {
    expect(formatGb(0)).toBe("—");
    expect(formatGb(0.5)).toBe("0.5");
    expect(formatGb(2)).toBe("2");
  });
});
```

Adjust expected W/L/RF to whatever the saved fixture contains (freeze the fixture file; do not assert against live API).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// standings.ts sketch
export function formatGb(gamesBehind: number): string {
  if (!Number.isFinite(gamesBehind) || gamesBehind === 0) return "—";
  return String(gamesBehind);
}

export function formatPct(winningPercentage: number): string | null {
  if (!Number.isFinite(winningPercentage)) return null;
  return winningPercentage.toFixed(3).replace(/^0/, "");
}

// map standing.rank, wins, losses, ties, winning_percentage, games_behind,
// runs_for, runs_against, run_differential, last_ten wins-losses, streak type+length
// fetchWpblStandings: for each WPBL_TEAMS id, GET /v1/teams/{id}/stats?season_id=
// Promise.allSettled → map successes → sort by rank → soft partial OK
```

PCT display: prefer fixture’s `.625` style — `winning_percentage` 0.625 → `".625"` via `toFixed(3).replace(/^0/, "")`.

Streak: `${standing.streak.type}${standing.streak.length}` → `"L1"`.

L10: `${last_ten.wins}-${last_ten.losses}`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/wpbl-v1/standings.ts src/lib/fetchers/wpbl-v1/standings.test.ts src/lib/fetchers/wpbl-v1/fixtures/team-stats-sf.json
git commit -m "feat(wpbl): map team season stats into standings rows"
```

---

### Task 4: Leaders builder

**Files:**
- Create: `src/lib/fetchers/wpbl-v1/leaders.ts`
- Create: `src/lib/fetchers/wpbl-v1/leaders.test.ts`
- Create: `src/lib/fetchers/wpbl-v1/fixtures/player-stats-sample.json` (array of 4–6 synthetic or trimmed player season stats objects including batting + pitching)

**Interfaces:**
- Consumes: `teamFromId`
- Produces: `BATTING_MIN_AB = 10`, `buildWpblLeaders(players)`, `fetchWpblLeaders(seasonId)`  
  where each player input is `{ playerId, name, teamId, batting, pitching }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { BATTING_MIN_AB, buildWpblLeaders } from "./leaders";

const players = [
  {
    playerId: "p1",
    name: "High Avg",
    teamId: "vhubhz8li07tmgq8",
    batting: { at_bats: 20, hits: 8, home_runs: 1, rbi: 5 },
    pitching: { outs_pitched: 0, era: 0, strikeouts: 0, wins: 0, saves: 0 },
  },
  {
    playerId: "p2",
    name: "Tiny Sample",
    teamId: "v4gisr4rbgmn67b0",
    batting: { at_bats: 4, hits: 3, home_runs: 2, rbi: 4 },
    pitching: { outs_pitched: 0, era: 0, strikeouts: 0, wins: 0, saves: 0 },
  },
  {
    playerId: "p3",
    name: "Ace",
    teamId: "fttth861nft1j2s7",
    batting: { at_bats: 0, hits: 0, home_runs: 0, rbi: 0 },
    pitching: { outs_pitched: 30, era: 1.8, strikeouts: 10, wins: 2, saves: 0 },
  },
];

describe("buildWpblLeaders", () => {
  it("excludes sub-qualifier AVG but still ranks HR", () => {
    const leaders = buildWpblLeaders(players);
    expect(BATTING_MIN_AB).toBe(10);
    expect(leaders.batting.avg.map((e) => e.playerId)).toEqual(["p1"]);
    expect(leaders.batting.avg[0].value).toBe(".400");
    expect(leaders.batting.hr[0].playerId).toBe("p2");
    expect(leaders.pitching.era[0]).toMatchObject({
      playerId: "p3",
      value: "1.80",
      teamAbbr: "NY",
    });
    expect(leaders.qualifiers.battingMinAb).toBe(10);
    expect(leaders.partial).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `buildWpblLeaders` + `fetchWpblLeaders`**

Logic:

- AVG: `hits / at_bats` when `at_bats >= BATTING_MIN_AB`; display `value` as `".XXX"` (three decimals, leading zero dropped); sort desc
- HR, RBI, H: sort desc by raw counts; no min
- ERA: only `outs_pitched > 0`; sort **asc**; display one or two decimals consistently (`era.toFixed(2)`)
- SO, W, SV: sort desc
- Top 10 each board
- `fetchWpblLeaders`: for each team id, `GET /v1/teams/{id}/players`, then for each player `GET /v1/players/{id}/stats?season_id=`; use `Promise.allSettled`; set `partial: true` if any fail; map `player_name` / first+last; attach `team_id`

Note: season batting block uses `batting.at_bats` / `hits` (not AVG field). Pitching uses `era`, `strikeouts`, `wins`, `saves`, `outs_pitched`.

Return shape matching `WpblLeadersResponse` without `updatedAt`/`seasonId` (caller adds those) **or** include `seasonId` and let refresh add `updatedAt` — pick one and stay consistent: **builder returns boards + qualifiers + partial; refresh adds `updatedAt` + `seasonId`.**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/wpbl-v1/leaders.ts src/lib/fetchers/wpbl-v1/leaders.test.ts src/lib/fetchers/wpbl-v1/fixtures/player-stats-sample.json
git commit -m "feat(wpbl): build batting and pitching leaderboards"
```

---

### Task 5: Boxscore mapper

**Files:**
- Create: `src/lib/fetchers/wpbl-v1/boxscore.ts`
- Create: `src/lib/fetchers/wpbl-v1/boxscore.test.ts`
- Create: `src/lib/fetchers/wpbl-v1/fixtures/boxscore-trimmed.json` (**must** be trimmed — full boxscores are ~250KB; keep one game header + 2 teams × ~3 hitters + ~2 pitchers + line arrays)

**Interfaces:**
- Consumes: `teamFromId`, `mapWpblStatus`
- Produces: `mapWpblBoxscore(raw, gameMeta) → WpblGameDetailResponse['boxscore'] & inning label helper`, `fetchWpblGameDetail(id)`, `formatInningLabel(status)`

**Important:** Boxscore player offense map key is **`hitting`**, not `batting` (Game Center `STAT_GROUPS.batting.map === "hitting"`). Season leaders use `batting`; boxscore uses `hitting`.

- [ ] **Step 1: Write trimmed fixture + failing tests**

Assert:

- `available: true`
- `lineScore.teams[0].side === "away"`, innings length, runs/hits/errors/lob from `totals`
- At least one batting line with `stats.ab` / `stats.h` from `hitting`
- Pitching lines from `pitching` map when present
- Players without `hitting`/`pitching` objects omitted from that table

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement mapper**

Display batting columns (minimum): AB, R, H, RBI, BB, SO, AVG/OBP/SLG if present in map.  
Pitching columns (minimum): IP, H, R, ER, BB, SO, ERA if present.

`stats` is `Record<string, string | number | null>` with stable lowercase keys: `ab`, `r`, `h`, `rbi`, `bb`, `so`, `ip`, `er`, etc.

`inning` label for game header: if live, derive from boxscore `status.inning` + `status.half` (e.g. `Top 5` / `Bot 5`); else null.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchers/wpbl-v1/boxscore.ts src/lib/fetchers/wpbl-v1/boxscore.test.ts src/lib/fetchers/wpbl-v1/fixtures/boxscore-trimmed.json
git commit -m "feat(wpbl): map boxscore line score and player lines"
```

---

### Task 6: Redis keys + refresh orchestration + cron

**Files:**
- Modify: `src/lib/config.ts` — add keys
- Create: `src/lib/fetchers/wpbl-v1/refresh.ts`
- Create: `src/lib/fetchers/wpbl-v1/refresh.test.ts`
- Create: `src/app/api/cron/wpbl/route.ts`
- Modify: `vercel.json` — add cron `*/5 * * * *` → `/api/cron/wpbl`

**Interfaces:**
- Produces:
  - `REDIS_KEYS.wpblLeague = "wpbl:league"`
  - `REDIS_KEYS.wpblLeaders = "wpbl:leaders"`
  - `wpblGameKey(id: string) => \`wpbl:game:${id}\`` (function next to keys or on `REDIS_KEYS` as helper in refresh module)
  - `WPBL_LIVE_TTL_MS = 45_000`
  - `shouldRefreshWpblGame(blob, now): boolean`
  - `refreshWpblLeague(): Promise<WpblLeagueResponse>`
  - `refreshWpblLeaders(seasonId): Promise<WpblLeadersResponse>`
  - `refreshWpblGame(id): Promise<WpblGameDetailResponse>`
  - Soft-write helpers that only `redis.set` when build succeeded

- [ ] **Step 1: Write failing TTL / soft-write tests**

```ts
import { describe, expect, it } from "vitest";
import { WPBL_LIVE_TTL_MS, shouldRefreshWpblGame } from "./refresh";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

function detail(partial: Partial<WpblGameDetailResponse> & { status: string }): WpblGameDetailResponse {
  return {
    updatedAt: partial.updatedAt ?? "2026-08-21T12:00:00.000Z",
    game: {
      id: "g1",
      status: partial.status as "live",
      startIso: null,
      whenEt: null,
      awayAbbr: "LA",
      homeAbbr: "NY",
      awayName: "Queens",
      homeName: "Heights",
      awayRuns: 1,
      homeRuns: 2,
      venue: null,
      countsInStandings: true,
      inning: null,
      ...(partial.game ?? {}),
    },
    boxscore: partial.boxscore ?? { available: false, lineScore: null, batting: [], pitching: [] },
  };
}

describe("shouldRefreshWpblGame", () => {
  const now = new Date("2026-08-21T18:00:00Z");

  it("refreshes live blobs older than TTL", () => {
    const d = detail({
      status: "live",
      updatedAt: new Date(now.getTime() - WPBL_LIVE_TTL_MS - 1000).toISOString(),
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });

  it("skips live blobs inside TTL", () => {
    const d = detail({
      status: "live",
      updatedAt: new Date(now.getTime() - 1000).toISOString(),
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });

  it("refreshes when boxscore unavailable", () => {
    const d = detail({
      status: "final",
      updatedAt: now.toISOString(),
      boxscore: { available: false, lineScore: null, batting: [], pitching: [] },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(true);
  });

  it("skips fresh final with boxscore", () => {
    const d = detail({
      status: "final",
      updatedAt: now.toISOString(),
      boxscore: { available: true, lineScore: null, batting: [], pitching: [] },
    });
    expect(shouldRefreshWpblGame(d, now)).toBe(false);
  });
});
```

Fix the helper typing so `game.status` is set properly (use full `WpblGameStatus`).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement refresh + cron**

`refreshWpblLeague`:

1. `fetchWpblGames()`
2. `seasonId = resolveSeasonId(...) ?? FALLBACK_SEASON_ID`
3. `fetchWpblStandings(seasonId)`
4. Build `WpblLeagueResponse` with `updatedAt: new Date().toISOString()`
5. `redis.set(REDIS_KEYS.wpblLeague, blob)` only if games or standings non-empty **or** always set when fetch didn’t throw — prefer: if both fetches soft-failed empty and prior redis exists, keep prior (read-modify). Minimal acceptable: try/catch around whole build; on throw leave redis untouched; on success always set.

`refreshWpblLeaders(seasonId)`: build + set `wpblLeaders`.

`refreshWpblGame(id)`: fetch `/v1/games/{id}` + boxscore; map; set `wpbl:game:{id}`.

Cron route mirrors scores cron:

```ts
import { authorizeCron } from "@/lib/cron-auth";
import { refreshWpblLeague, refreshWpblLeaders } from "@/lib/fetchers/wpbl-v1/refresh";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;
  try {
    const league = await refreshWpblLeague();
    const leaders = await refreshWpblLeaders(league.seasonId);
    return Response.json({ ok: true, games: league.games.length, leadersPartial: leaders.partial });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WPBL cron failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
```

`vercel.json` add:

```json
{ "path": "/api/cron/wpbl", "schedule": "*/5 * * * *" }
```

- [ ] **Step 4: Run refresh tests — PASS; typecheck cron compiles**

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/fetchers/wpbl-v1/refresh.ts src/lib/fetchers/wpbl-v1/refresh.test.ts src/app/api/cron/wpbl/route.ts vercel.json
git commit -m "feat(wpbl): add Redis refresh helpers and 5-minute cron"
```

---

### Task 7: Public API routes

**Files:**
- Create: `src/app/api/wpbl/route.ts`
- Create: `src/app/api/wpbl/leaders/route.ts`
- Create: `src/app/api/wpbl/games/[id]/route.ts`

**Interfaces:**
- Consumes: `getRedis`, `REDIS_KEYS`, `wpblGameKey`, `shouldRefreshWpblGame`, `refreshWpblGame`
- Produces: HTTP handlers per spec (503 empty, 404 unknown game, 200 soft boxscore)

- [ ] **Step 1: Implement `GET /api/wpbl`**

```ts
import { REDIS_KEYS } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { WpblLeagueResponse } from "@/lib/types/wpbl-display";

export async function GET() {
  const blob = await getRedis().get<WpblLeagueResponse>(REDIS_KEYS.wpblLeague);
  if (!blob) {
    return Response.json({ error: "WPBL league cache empty" }, { status: 503 });
  }
  return Response.json(blob);
}
```

- [ ] **Step 2: Implement `GET /api/wpbl/leaders`** — same pattern on `wpblLeaders`.

- [ ] **Step 3: Implement `GET /api/wpbl/games/[id]`**

```ts
// pseudocode
const key = wpblGameKey(id);
let blob = await redis.get(key);
const now = new Date();
if (!blob || shouldRefreshWpblGame(blob, now)) {
  try {
    blob = await refreshWpblGame(id);
  } catch {
    if (!blob) {
      // optional: try map from league schedule only
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    // serve last-good
  }
}
return Response.json(blob);
```

If refresh fails with 404 from upstream and no cache → 404. If refresh fails and cache exists → return cache.

- [ ] **Step 4: Smoke via unit-level optional — or manual `curl` after cron in dev. At minimum run `npx tsc --noEmit` / `npm run build` if feasible.**

No Redis in CI: keep route files thin; logic tested in `refresh.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/wpbl/route.ts src/app/api/wpbl/leaders/route.ts src/app/api/wpbl/games/\[id\]/route.ts
git commit -m "feat(wpbl): add public league, leaders, and game APIs"
```

---

### Task 8: League home UI (`/wpbl`)

**Files:**
- Create: `src/components/wpbl/TeamFilter.tsx`
- Create: `src/components/wpbl/StandingsTable.tsx`
- Create: `src/components/wpbl/ScheduleList.tsx`
- Create: `src/components/wpbl/LeadersBoards.tsx`
- Create: `src/components/wpbl/WpblLeagueClient.tsx` (client: filter state + live poll)
- Create: `src/app/wpbl/page.tsx`
- Create: `src/app/wpbl/layout.tsx` (optional simple title metadata)

**Interfaces:**
- Consumes: `/api/wpbl`, `/api/wpbl/leaders`
- Produces: usable page with All|LA|NY|SF|BOS filter; standings always full; schedule/leaders filtered; poll every 45s if any `games.status === "live"`

- [ ] **Step 1: Server page loads initial data**

`page.tsx` can be a server component that `fetch`es absolute URLs via env, **or** simpler: make `WpblLeagueClient` fetch on mount from `/api/wpbl` and `/api/wpbl/leaders` (relative). Prefer client fetch for poll simplicity (same as radar patterns that hit APIs from the browser).

```tsx
// src/app/wpbl/page.tsx
import { WpblLeagueClient } from "@/components/wpbl/WpblLeagueClient";

export default function WpblPage() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl tracking-tight">WPBL</h1>
      <p className="mt-1 text-sm text-neutral-600">Standings, schedule, and leaders</p>
      <WpblLeagueClient />
    </main>
  );
}
```

- [ ] **Step 2: Implement client**

- `useEffect` load both endpoints; show error if 503
- `teamFilter` state: `"ALL" | "LA" | "NY" | "SF" | "BOS"`
- Filter schedule: game involves selected abbr
- Filter leaders: entries where `teamAbbr` matches
- If any game live: `setInterval` 45_000 reload
- Show `updatedAt` as text
- Schedule rows: `Link` to `/wpbl/games/${id}`
- Leaders: show qualifier note `min ${qualifiers.battingMinAb} AB for AVG`
- Sort schedule: live first, then upcoming by start, then recent finals, then older finals (implement a clear comparator in a small `src/components/wpbl/scheduleSort.ts` + unit test if non-trivial)

- [ ] **Step 3: Style tables** — readable, horizontal scroll on standings OK; status badges for live/final/scheduled. Useful board, not marketing landing page.

- [ ] **Step 4: Manual check** — `npm run dev`, hit `/wpbl` after running cron once (or temporarily call refresh from a script). If Redis empty, page should show a clear empty/503 message.

- [ ] **Step 5: Commit**

```bash
git add src/app/wpbl src/components/wpbl
git commit -m "feat(wpbl): add league home UI with team filter and live poll"
```

---

### Task 9: Game detail UI

**Files:**
- Create: `src/components/wpbl/GameDetailClient.tsx`
- Create: `src/components/wpbl/LineScore.tsx`
- Create: `src/components/wpbl/BoxTables.tsx`
- Create: `src/app/wpbl/games/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/wpbl/games/[id]`
- Produces: header, line score, batting/pitching tables, back link, 45s poll when `game.status === "live"`

- [ ] **Step 1: Page shell**

```tsx
export default async function WpblGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GameDetailClient gameId={id} />;
}
```

(Confirm `params` Promise vs object against this repo’s Next version docs.)

- [ ] **Step 2: Client loads `/api/wpbl/games/${id}`**

- 404 → “Game not found”
- `boxscore.available === false` → empty-state message, still show header if game present
- Render line score + batting/pitching (group by side or tabs Away/Home)
- Poll when live

- [ ] **Step 3: Manual verify** with a known final `game_id` from `/v1/games`

- [ ] **Step 4: Commit**

```bash
git add src/app/wpbl/games src/components/wpbl/GameDetailClient.tsx src/components/wpbl/LineScore.tsx src/components/wpbl/BoxTables.tsx
git commit -m "feat(wpbl): add game detail box score UI"
```

---

### Task 10: Home link + backend docs

**Files:**
- Modify: `src/app/page.tsx` — add link next to Radar
- Modify: `docs/BACKEND_PLAN.md` — document `/api/wpbl`, `/api/wpbl/leaders`, `/api/wpbl/games/[id]`, cron `/api/cron/wpbl`, Redis keys; note dial WPBL HTML path unchanged

- [ ] **Step 1: Update home page**

```tsx
<Link href="/wpbl" className="...">
  Open WPBL
</Link>
```

- [ ] **Step 2: Document APIs in BACKEND_PLAN.md** (mirror existing scores section style; keep concise)

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: all pass (existing WPBL HTML tests unchanged)

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx docs/BACKEND_PLAN.md
git commit -m "docs: link WPBL board and document /api/wpbl routes"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Standings table | 3, 8 |
| Full schedule | 2, 8 |
| Leaders AVG/HR/RBI/H + ERA/SO/W/SV | 4, 8 |
| Game detail line + batting/pitching | 5, 9 |
| Team filter, neutral standings | 8 |
| Public `/wpbl`, no auth | 8–10 |
| Light live poll ~45–60s | 6–9 |
| JSON API + Redis, dial HTML untouched | 1–7, Global Constraints |
| Cron ~5 min | 6 |
| Soft-fail / 503 / last-good | 6–7 |
| `battingMinAb: 10` | 4 |
| Tests with fixtures | 1–6 |
| Home link + docs | 10 |

No intentional placeholders left; boxscore key `hitting` called out explicitly.
