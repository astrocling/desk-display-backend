"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  WpblLeadersResponse,
  WpblLeagueResponse,
} from "@/lib/types/wpbl-display";
import { wpblGamesNeedLivePoll } from "@/lib/fetchers/wpbl-v1/refresh";

const POLL_MS = 30_000;

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

export function formatWpblUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type UseWpblBoardDataOptions = {
  /** When true, also fetch `/api/wpbl/leaders`. */
  includeLeaders?: boolean;
};

export function useWpblBoardData(options: UseWpblBoardDataOptions = {}) {
  const includeLeaders = options.includeLeaders ?? false;
  const [league, setLeague] = useState<WpblLeagueResponse | null>(null);
  const [leaders, setLeaders] = useState<WpblLeadersResponse | null>(null);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const hasLeagueRef = useRef(false);
  const hasLeadersRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const leaguePromise = fetch("/api/wpbl");
      const leadersPromise = includeLeaders
        ? fetch("/api/wpbl/leaders")
        : null;

      const leagueRes = await leaguePromise;
      const leadersRes = leadersPromise ? await leadersPromise : null;

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

      if (leadersRes) {
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
      }

      return leagueRes.ok || Boolean(leadersRes?.ok);
    } catch {
      if (!hasLeagueRef.current) {
        setLeagueError("League fetch failed — network error.");
        setLeague(null);
      }
      if (includeLeaders && !hasLeadersRef.current) {
        setLeadersError("Leaders fetch failed — network error.");
        setLeaders(null);
      }
      return false;
    }
  }, [includeLeaders]);

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

  const needsLivePoll =
    league != null ? wpblGamesNeedLivePoll(league.games) : false;
  const hasLiveGame =
    league?.games.some((game) => game.status === "live") ?? false;

  useEffect(() => {
    if (!needsLivePoll) return;

    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [needsLivePoll, load]);

  return {
    league,
    leaders,
    leagueError,
    leadersError,
    loading,
    hasLive: hasLiveGame,
    liveRefreshKey,
    updatedAt: league?.updatedAt ?? leaders?.updatedAt,
  };
}
