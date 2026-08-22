"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblGameStatus,
} from "@/lib/types/wpbl-display";
import { latestWpblPlay, pitchesFromPlay } from "@/lib/wpbl-plays";

import { BoxTables } from "./BoxTables";
import { GamedayScoreboard } from "./GamedayScoreboard";
import { LineScore } from "./LineScore";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PitchLog } from "./PitchLog";
import { PlayByPlayPanel } from "./PlayByPlayPanel";

const POLL_MS = 30_000;

type DetailView = "gameday" | "box";

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

function ViewTabs({
  view,
  onChange,
  playCount,
}: {
  view: DetailView;
  onChange: (next: DetailView) => void;
  playCount: number;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-700"
      role="tablist"
      aria-label="Game detail view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "gameday"}
        onClick={() => onChange("gameday")}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          view === "gameday"
            ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        }`}
      >
        Gameday
        {playCount > 0 ? (
          <span className="ml-1.5 text-xs opacity-70">{playCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "box"}
        onClick={() => onChange("box")}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          view === "box"
            ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        }`}
      >
        Box score
      </button>
    </div>
  );
}

function LatestPlayBanner({
  play,
  batting,
  pitching,
}: {
  play: NonNullable<ReturnType<typeof latestWpblPlay>>;
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
}) {
  const pitches = pitchesFromPlay(play);
  const roster = rosterFromBoxLines(batting, pitching);

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        play.isScoringPlay
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
      }`}
    >
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Latest play ·{" "}
        {play.half === "top"
          ? `Top ${play.inning}`
          : play.half === "bottom"
            ? `Bot ${play.inning}`
            : `Inn ${play.inning}`}
        {play.isScoringPlay ? " · Scoring" : ""}
      </p>
      <p className="text-sm leading-snug text-slate-800 dark:text-slate-100">
        {linkifyPlayerNames(play.narrative, roster)}
      </p>
      {pitches.length > 0 ? (
        <div className="mt-2">
          <PitchLog pitches={pitches} compact />
        </div>
      ) : null}
    </div>
  );
}

export type GameDetailClientProps = {
  gameId: string;
  /** Redis-hot blob from the server so the page paints without a client round-trip. */
  initialData?: WpblGameDetailResponse | null;
};

export function GameDetailClient({
  gameId,
  initialData = null,
}: GameDetailClientProps) {
  const searchParams = useSearchParams();
  const initialView: DetailView =
    searchParams.get("view") === "box" ? "box" : "gameday";

  const [view, setView] = useState<DetailView>(initialView);
  const [data, setData] = useState<WpblGameDetailResponse | null>(initialData);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const hasDataRef = useRef(Boolean(initialData));

  useEffect(() => {
    // replaceState does not update useSearchParams; keep tab in sync with the URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL ↔ tab sync
    setView(searchParams.get("view") === "box" ? "box" : "gameday");
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/wpbl/games/${gameId}`, {
        cache: "no-store",
      });

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

    void (async () => {
      if (!initialData) {
        setLoading(true);
      }
      await load();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData, load]);

  const isLive = data?.game.status === "live";

  useEffect(() => {
    if (!isLive) return;

    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [isLive, load]);

  const lastPlay = useMemo(
    () => (data ? latestWpblPlay(data.boxscore.plays) : null),
    [data],
  );

  const setViewAndUrl = useCallback((next: DetailView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "box") {
      url.searchParams.set("view", "box");
    } else {
      url.searchParams.delete("view");
    }
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  if (loading) {
    return <p className="mt-8 text-sm text-slate-500">Loading…</p>;
  }

  if (notFound) {
    return (
      <div className="mt-8 space-y-4">
        <Link
          href="/wpbl"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Back to WPBL
        </Link>
        <p className="text-sm text-slate-500">Game not found.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mt-8 space-y-4">
        <Link
          href="/wpbl"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
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

  return (
    <div className="mt-8 space-y-6">
      <Link
        href="/wpbl"
        className="inline-block text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        ← Back to WPBL
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={game.status} />
        <span className="text-xs text-slate-500">
          {updatedAt ? <>Updated {formatUpdatedAt(updatedAt)}</> : null}
          {isLive ? (
            <span className="ml-2 text-red-600 dark:text-red-400">· Live</span>
          ) : null}
        </span>
        {game.venue ? (
          <span className="text-xs text-slate-500">· {game.venue}</span>
        ) : null}
        {game.whenEt && game.status !== "live" ? (
          <span className="text-xs text-slate-500">· {game.whenEt}</span>
        ) : null}
      </div>

      <GamedayScoreboard detail={data} />

      {lastPlay ? (
        <LatestPlayBanner
          play={lastPlay}
          batting={boxscore.batting}
          pitching={boxscore.pitching}
        />
      ) : null}

      {boxscore.available && boxscore.lineScore ? (
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Line score
          </h2>
          <LineScore
            lineScore={boxscore.lineScore}
            highlightInning={situation?.inningNumber}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <ViewTabs
          view={view}
          onChange={setViewAndUrl}
          playCount={boxscore.plays.length}
        />

        {view === "gameday" ? (
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Play-by-play
            </h2>
            <PlayByPlayPanel
              plays={boxscore.plays}
              batting={boxscore.batting}
              pitching={boxscore.pitching}
            />
          </div>
        ) : boxscore.available ? (
          <div>
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
          </div>
        ) : (
          <p className="text-sm text-slate-500">Box score not available yet.</p>
        )}
      </section>
    </div>
  );
}
