"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { WpblGameDetailResponse, WpblGameStatus } from "@/lib/types/wpbl-display";

import { BoxTables } from "./BoxTables";
import { LineScore } from "./LineScore";
import { TeamLogo } from "./TeamLogo";
import { keyPlayersFromDetail } from "./liveGameCard";

const POLL_MS = 45_000;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: WpblGameStatus }) {
  const styles: Record<WpblGameStatus, string> = {
    live: "bg-red-600 text-white",
    final: "bg-slate-500 text-white dark:bg-slate-600",
    scheduled: "bg-emerald-600 text-white",
    other: "bg-amber-500 text-white",
  };
  const labels: Record<WpblGameStatus, string> = {
    live: "Live",
    final: "Final",
    scheduled: "Scheduled",
    other: "Other",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function scoreLine(game: WpblGameDetailResponse["game"]): string {
  if (game.status === "scheduled" || game.awayRuns == null || game.homeRuns == null) {
    return "—";
  }
  return `${game.awayRuns}–${game.homeRuns}`;
}

export type GameDetailClientProps = {
  gameId: string;
};

export function GameDetailClient({ gameId }: GameDetailClientProps) {
  const [data, setData] = useState<WpblGameDetailResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/wpbl/games/${gameId}`);

      if (res.status === 404) {
        if (!hasDataRef.current) {
          setNotFound(true);
          setData(null);
          setError(null);
        }
        return false;
      }

      if (!res.ok) {
        if (!hasDataRef.current) {
          let detail: string | null = null;
          try {
            const body = (await res.json()) as { error?: unknown };
            detail =
              typeof body.error === "string" && body.error.trim()
                ? body.error.trim()
                : null;
          } catch {
            detail = null;
          }
          setError(detail ?? `Game fetch failed (${res.status})`);
          setData(null);
        }
        return false;
      }

      const json = (await res.json()) as WpblGameDetailResponse;
      setData(json);
      setNotFound(false);
      setError(null);
      hasDataRef.current = true;
      return true;
    } catch {
      if (!hasDataRef.current) {
        setError("Game fetch failed — network error.");
        setData(null);
      }
      return false;
    }
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    hasDataRef.current = false;
    setData(null);
    setNotFound(false);
    setError(null);

    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const isLive = data?.game.status === "live";

  useEffect(() => {
    if (!isLive) return;

    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [isLive, load]);

  if (loading) {
    return <p className="mt-8 text-sm text-slate-500">Loading…</p>;
  }

  if (notFound) {
    return (
      <div className="mt-8 space-y-4">
        <Link href="/wpbl" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ← Back to WPBL
        </Link>
        <p className="text-sm text-slate-500">Game not found.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mt-8 space-y-4">
        <Link href="/wpbl" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ← Back to WPBL
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { game, boxscore, updatedAt } = data;
  const situation = game.situation;
  const keys = keyPlayersFromDetail(data);

  return (
    <div className="mt-8 space-y-6">
      <Link href="/wpbl" className="inline-block text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        ← Back to WPBL
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={game.status} />
          {game.inning ? (
            <span className="text-sm font-medium text-red-600 dark:text-red-400">{game.inning}</span>
          ) : null}
          <span className="text-xs text-slate-500">
            {updatedAt ? <>Updated {formatUpdatedAt(updatedAt)}</> : null}
            {isLive ? (
              <span className="ml-2 text-red-600 dark:text-red-400">· Live — refreshing every 45s</span>
            ) : null}
          </span>
        </div>

        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-flex items-center gap-2">
            <TeamLogo abbr={game.awayAbbr} size="lg" />
            {game.awayAbbr}
          </span>
          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
            {scoreLine(game)}
          </span>
          <span className="inline-flex items-center gap-2">
            <TeamLogo abbr={game.homeAbbr} size="lg" />
            {game.homeAbbr}
          </span>
        </h1>

        <p className="text-sm text-slate-500">
          {game.awayName} at {game.homeName}
          {game.whenEt ? <span className="ml-2">· {game.whenEt}</span> : null}
          {game.venue ? <span className="ml-2">· {game.venue}</span> : null}
        </p>

        {situation && isLive ? (
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            {situation.balls != null || situation.strikes != null ? (
              <span className="font-mono tabular-nums">
                Count {situation.balls ?? "—"}-{situation.strikes ?? "—"}
              </span>
            ) : null}
            {situation.outs != null ? (
              <span>{situation.outs} out</span>
            ) : null}
            <span>
              Bases{" "}
              {[
                situation.onFirst ? "1B" : null,
                situation.onSecond ? "2B" : null,
                situation.onThird ? "3B" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "empty"}
            </span>
            {keys.pitcherName ? (
              <span>
                P {keys.pitcherName}
                {keys.pitcherStats ? ` (${keys.pitcherStats})` : ""}
              </span>
            ) : null}
            {keys.batterName ? (
              <span>
                AB {keys.batterName}
                {keys.batterStats ? ` (${keys.batterStats})` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {boxscore.available && boxscore.lineScore ? (
        <>
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Line score
            </h2>
            <LineScore
              lineScore={boxscore.lineScore}
              highlightInning={situation?.inningNumber}
            />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Box score
            </h2>
            <BoxTables
              batting={boxscore.batting}
              pitching={boxscore.pitching}
              awayLabel={`${game.awayAbbr} ${game.awayName}`}
              homeLabel={`${game.homeAbbr} ${game.homeName}`}
              awayAbbr={game.awayAbbr}
              homeAbbr={game.homeAbbr}
            />
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-500">Box score not available yet.</p>
      )}
    </div>
  );
}
