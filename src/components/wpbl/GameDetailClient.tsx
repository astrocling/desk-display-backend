"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  WpblBoxPlayerLine,
  WpblGameStatus,
} from "@/lib/types/wpbl-display";
import type { WpblLiveConnection } from "@/lib/wpbl-live-ws";
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
import { useWpblLiveGame } from "./useWpblLiveGame";

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

function FeedBadge({
  connection,
  isLive,
}: {
  connection: WpblLiveConnection;
  isLive: boolean;
}) {
  if (!isLive) return null;

  if (connection === "live") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live feed
      </span>
    );
  }

  if (connection === "connecting" || connection === "reconnecting") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        {connection === "connecting" ? "Connecting feed…" : "Reconnecting…"}
      </span>
    );
  }

  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      Polling
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
};

export function GameDetailClient({ gameId }: GameDetailClientProps) {
  const searchParams = useSearchParams();
  const initialView: DetailView =
    searchParams.get("view") === "box" ? "box" : "gameday";

  const [view, setView] = useState<DetailView>(initialView);
  const { data, loading, notFound, error, connection } = useWpblLiveGame(gameId);

  useEffect(() => {
    setView(searchParams.get("view") === "box" ? "box" : "gameday");
  }, [searchParams]);

  const isLive = data?.game.status === "live";

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
        <FeedBadge connection={connection} isLive={Boolean(isLive)} />
        <span className="text-xs text-slate-500">
          {updatedAt ? <>Updated {formatUpdatedAt(updatedAt)}</> : null}
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
