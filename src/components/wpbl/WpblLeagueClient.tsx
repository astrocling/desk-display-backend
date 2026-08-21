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
import { sortWpblSchedule } from "./scheduleSort";
import { TeamFilter, type WpblTeamFilter } from "./TeamFilter";

const POLL_MS = 45_000;

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

export function WpblLeagueClient() {
  const [league, setLeague] = useState<WpblLeagueResponse | null>(null);
  const [leaders, setLeaders] = useState<WpblLeadersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<WpblTeamFilter>("ALL");
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    const [leagueRes, leadersRes] = await Promise.all([
      fetch("/api/wpbl"),
      fetch("/api/wpbl/leaders"),
    ]);

    if (!leagueRes.ok || !leadersRes.ok) {
      if (!hasDataRef.current) {
        const leagueErr =
          leagueRes.status === 503
            ? "League data not loaded — run the WPBL refresh cron first."
            : `League fetch failed (${leagueRes.status})`;
        const leadersErr =
          leadersRes.status === 503
            ? "Leaders data not loaded — run the WPBL refresh cron first."
            : `Leaders fetch failed (${leadersRes.status})`;
        setError(
          !leagueRes.ok && !leadersRes.ok
            ? "WPBL cache empty — run the WPBL refresh cron first."
            : !leagueRes.ok
              ? leagueErr
              : leadersErr,
        );
        setLeague(null);
        setLeaders(null);
      }
      return false;
    }

    setLeague((await leagueRes.json()) as WpblLeagueResponse);
    setLeaders((await leadersRes.json()) as WpblLeadersResponse);
    setError(null);
    hasDataRef.current = true;
    return true;
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

  const updatedAt = league?.updatedAt ?? leaders?.updatedAt;

  if (loading) {
    return <p className="mt-8 text-sm text-slate-500">Loading…</p>;
  }

  if (error && !league && !leaders) {
    return (
      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {error}
      </div>
    );
  }

  if (!league || !leaders) {
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
        <div className="text-xs text-slate-500">
          {updatedAt ? <>Updated {formatUpdatedAt(updatedAt)}</> : null}
          {hasLive ? (
            <span className="ml-2 text-red-600 dark:text-red-400">· Live — refreshing every 45s</span>
          ) : null}
        </div>
      </div>

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
        <LeadersBoards leaders={leaders} teamFilter={teamFilter} />
      </section>
    </div>
  );
}
