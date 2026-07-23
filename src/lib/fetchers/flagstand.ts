import { neon } from "@neondatabase/serverless";

import type {
  FlagstandNextRace,
  FlagstandRaceSummary,
  FlagstandScores,
} from "@/lib/types/scores";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;

function getSql(): SqlClient | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}

interface RaceRow {
  id: string;
  name: string;
  scheduledAt: string | Date;
  status?: string;
  track_name: string | null;
  season_name: string;
  league_name: string;
}

function mapRaceSummary(row: RaceRow): FlagstandRaceSummary {
  return {
    id: row.id,
    name: row.name,
    scheduledAt: new Date(row.scheduledAt).toISOString(),
    trackName: row.track_name,
    leagueName: row.league_name,
    seasonName: row.season_name,
  };
}

function mapNextRace(row: RaceRow): FlagstandNextRace {
  return {
    ...mapRaceSummary(row),
    status: row.status ?? "SCHEDULED",
  };
}

async function resolveInternalOrgId(sql: SqlClient): Promise<string | null> {
  const rows = (await sql`
    SELECT id
    FROM "Organization"
    WHERE "isInternal" = true
    LIMIT 1
  `) as { id: string }[];

  return rows[0]?.id ?? null;
}

async function fetchNextRace(
  sql: SqlClient,
  orgId: string,
  leagueIds?: string[],
): Promise<FlagstandNextRace | null> {
  const rows = leagueIds?.length
    ? ((await sql`
        SELECT
          rn.id,
          rn.name,
          rn."scheduledAt",
          rn.status,
          t.name AS track_name,
          s.name AS season_name,
          l.name AS league_name
        FROM "RaceNight" rn
        JOIN "Season" s ON s.id = rn."seasonId"
        JOIN "League" l ON l.id = s."leagueId"
        LEFT JOIN "Track" t ON t.id = rn."trackId"
        WHERE l."organizationId" = ${orgId}
          AND rn.status IN ('SCHEDULED', 'ACTIVE')
          AND rn."scheduledAt" > NOW()
          AND s."isActive" = true
          AND l.id = ANY(${leagueIds})
        ORDER BY rn."scheduledAt" ASC
        LIMIT 1
      `) as RaceRow[])
    : ((await sql`
        SELECT
          rn.id,
          rn.name,
          rn."scheduledAt",
          rn.status,
          t.name AS track_name,
          s.name AS season_name,
          l.name AS league_name
        FROM "RaceNight" rn
        JOIN "Season" s ON s.id = rn."seasonId"
        JOIN "League" l ON l.id = s."leagueId"
        LEFT JOIN "Track" t ON t.id = rn."trackId"
        WHERE l."organizationId" = ${orgId}
          AND rn.status IN ('SCHEDULED', 'ACTIVE')
          AND rn."scheduledAt" > NOW()
          AND s."isActive" = true
        ORDER BY rn."scheduledAt" ASC
        LIMIT 1
      `) as RaceRow[]);

  const row = rows[0];
  return row ? mapNextRace(row) : null;
}

async function fetchLastResult(
  sql: SqlClient,
  orgId: string,
  leagueIds?: string[],
): Promise<FlagstandRaceSummary | null> {
  const rows = leagueIds?.length
    ? ((await sql`
        SELECT
          rn.id,
          rn.name,
          rn."scheduledAt",
          t.name AS track_name,
          s.name AS season_name,
          l.name AS league_name
        FROM "RaceNight" rn
        JOIN "Season" s ON s.id = rn."seasonId"
        JOIN "League" l ON l.id = s."leagueId"
        LEFT JOIN "Track" t ON t.id = rn."trackId"
        WHERE l."organizationId" = ${orgId}
          AND rn.status = 'COMPLETE'
          AND s."isActive" = true
          AND l.id = ANY(${leagueIds})
        ORDER BY rn."scheduledAt" DESC
        LIMIT 1
      `) as RaceRow[])
    : ((await sql`
        SELECT
          rn.id,
          rn.name,
          rn."scheduledAt",
          t.name AS track_name,
          s.name AS season_name,
          l.name AS league_name
        FROM "RaceNight" rn
        JOIN "Season" s ON s.id = rn."seasonId"
        JOIN "League" l ON l.id = s."leagueId"
        LEFT JOIN "Track" t ON t.id = rn."trackId"
        WHERE l."organizationId" = ${orgId}
          AND rn.status = 'COMPLETE'
          AND s."isActive" = true
        ORDER BY rn."scheduledAt" DESC
        LIMIT 1
      `) as RaceRow[]);

  const row = rows[0];
  return row ? mapRaceSummary(row) : null;
}

export type FlagstandFetchResult = FlagstandScores & { error?: string };

export async function fetchFlagstand(
  leagueIds?: string[],
): Promise<FlagstandFetchResult> {
  const sql = getSql();
  if (!sql) {
    return {
      lastResult: null,
      nextRace: null,
      error: "DATABASE_URL not configured",
    };
  }

  try {
    const orgId = await resolveInternalOrgId(sql);
    if (!orgId) {
      return {
        lastResult: null,
        nextRace: null,
        error: "No internal organization found",
      };
    }

    const [lastResult, nextRace] = await Promise.all([
      fetchLastResult(sql, orgId, leagueIds),
      fetchNextRace(sql, orgId, leagueIds),
    ]);

    return { lastResult, nextRace };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Flagstand fetch failed";
    return {
      lastResult: null,
      nextRace: null,
      error: message,
    };
  }
}
