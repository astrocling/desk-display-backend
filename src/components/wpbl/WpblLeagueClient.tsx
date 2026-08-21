"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  WpblLeadersResponse,
  WpblLeagueResponse,
  WpblScheduleGame,
} from "@/lib/types/wpbl-display";

import { LeadersBoards } from "./LeadersBoards";
import { ScheduleList } from "./ScheduleList";
import { StandingsTable } from "./StandingsTable";
import { TodaysGamesSection } from "./LiveGamesSection";
import { sortWpblSchedule } from "./scheduleSort";
import { todaysSlateGames } from "./scheduleWeek";
import { TeamFilter, type WpblTeamFilter } from "./TeamFilter";

const POLL_MS = 30_000;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function gameInvolvesTeam(game: WpblScheduleGame, abbr: WpblTeamFilter): boolean {
  return game.awayAbbr === abbr || game.homeAbbr === abbr;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

async function readApiError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error.trim()
      ? body.error.trim()
      : null;
  } catch {
    return null;
  }
}

function fetchErrorMessage(
  label: string,
  status: number | null,
  fallback: string,
  detail?: string | null,
): string {
  if (detail) return detail;
  if (status === 503) {
    return `${label} data not loaded — run the WPBL refresh cron first.`;
  }
  if (status != null) {
    return `${label} fetch failed (${status})`;
  }
  return fallback;
}

export function WpblLeagueClient() {
  const [league, setLeague] = useState<WpblLeagueResponse | null>(null);
  const [leaders, setLeaders] = useState<WpblLeadersResponse | null>(null);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<WpblTeamFilter>("ALL");
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const hasLeagueRef = useRef(false);
  const hasLeadersRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [leagueRes, leadersRes] = await Promise.all([
        fetch("/api/wpbl"),
        fetch("/api/wpbl/leaders"),
      ]);

      if (leagueRes.ok) {
        setLeague((await leagueRes.json()) as WpblLeagueResponse);
        setLeagueError(null);
        hasLeagueRef.current = true;
        setLiveRefreshKey((k) => k + 1);
      } else if (!hasLeagueRef.current) {
        const detail = await readApiError(leagueRes);
        setLeagueError(
          fetchErrorMessage(
            "League",
            leagueRes.status,
            "League fetch failed",
            detail,
          ),
        );
        setLeague(null);
      }

      if (leadersRes.ok) {
        setLeaders((await leadersRes.json()) as WpblLeadersResponse);
        setLeadersError(null);
        hasLeadersRef.current = true;
      } else if (!hasLeadersRef.current) {
        const detail = await readApiError(leadersRes);
        setLeadersError(
          fetchErrorMessage(
            "Leaders",
            leadersRes.status,
            "Leaders fetch failed",
            detail,
          ),
        );
        setLeaders(null);
      }

      return leagueRes.ok || leadersRes.ok;
    } catch {
      if (!hasLeagueRef.current) {
        setLeagueError("League fetch failed — network error.");
        setLeague(null);
      }
      if (!hasLeadersRef.current) {
        setLeadersError("Leaders fetch failed — network error.");
        setLeaders(null);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const hasLive = league?.games.some((g) => g.status === "live") ?? false;

  useEffect(() => {
    if (!hasLive) return;

    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [hasLive, load]);

  const filteredSchedule = useMemo(() => {
    if (!league) return [];
    const games =
      teamFilter === "ALL"
        ? league.games
        : league.games.filter((g) => gameInvolvesTeam(g, teamFilter));
    return sortWpblSchedule(games);
  }, [league, teamFilter]);

  const todayGames = useMemo(
    () => todaysSlateGames(filteredSchedule),
    [filteredSchedule],
  );

  const updatedAt = league?.updatedAt ?? leaders?.updatedAt;

  if (loading) {
    return <p className="mt-8 text-sm text-slate-500">Loading…</p>;
  }

  if (!league && leagueError) {
    return (
      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {leagueError}
      </div>
    );
  }

  if (!league) {
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
        <div className="text-xs text-slate-500">
          {updatedAt ? <>Updated {formatUpdatedAt(updatedAt)}</> : null}
          {hasLive ? (
            <span className="ml-2 text-red-600 dark:text-red-400">· Live</span>
          ) : null}
        </div>
      </div>

      <TodaysGamesSection
        games={todayGames}
        standings={league.standings}
        refreshKey={liveRefreshKey}
      />

      <section>
        <SectionTitle>Standings</SectionTitle>
        <StandingsTable rows={league.standings} />
      </section>

      <section>
        <SectionTitle>Schedule</SectionTitle>
        <ScheduleList games={filteredSchedule} />
      </section>

      <section>
        <SectionTitle>Leaders</SectionTitle>
        {leaders ? (
          <LeadersBoards leaders={leaders} teamFilter={teamFilter} />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {leadersError ?? "Leaders unavailable."}
          </div>
        )}
      </section>
    </div>
  );
}
