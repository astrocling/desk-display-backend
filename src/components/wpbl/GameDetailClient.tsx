"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblLiveSituation,
} from "@/lib/types/wpbl-display";
import { latestWpblPlay, shortRunnerLabel } from "@/lib/wpbl-plays";

import { BoxTables } from "./BoxTables";
import { LineScore } from "./LineScore";
import { LatestPlayBanner, PlayByPlayPanel } from "./PlayByPlayPanel";
import { TeamLogo } from "./TeamLogo";
import { keyPlayersFromDetail } from "./liveGameCard";

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

function scoreLine(game: WpblGameDetailResponse["game"]): string {
  if (game.status === "scheduled" || game.awayRuns == null || game.homeRuns == null) {
    return "—";
  }
  return `${game.awayRuns}–${game.homeRuns}`;
}

function SituationBoard({ situation }: { situation: WpblLiveSituation }) {
  const baseClass = (on: boolean) =>
    `absolute h-4 w-4 rotate-45 border border-slate-400 ${
      on
        ? "bg-amber-400 border-amber-500 dark:bg-amber-300 dark:border-amber-200"
        : "bg-transparent"
    }`;

  const first = shortRunnerLabel(situation.runnerFirst);
  const second = shortRunnerLabel(situation.runnerSecond);
  const third = shortRunnerLabel(situation.runnerThird);
  const outs = situation.outs == null ? 0 : Math.min(3, Math.max(0, situation.outs));

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="relative h-12 w-12"
          aria-label={[
            situation.runnerFirst
              ? `${situation.runnerFirst} on first`
              : situation.onFirst
                ? "runner on first"
                : null,
            situation.runnerSecond
              ? `${situation.runnerSecond} on second`
              : situation.onSecond
                ? "runner on second"
                : null,
            situation.runnerThird
              ? `${situation.runnerThird} on third`
              : situation.onThird
                ? "runner on third"
                : null,
          ]
            .filter(Boolean)
            .join(", ") || "bases empty"}
        >
          <span className={`${baseClass(situation.onSecond)} left-1/2 top-0 -translate-x-1/2`} />
          <span className={`${baseClass(situation.onThird)} left-0 top-1/2 -translate-y-1/2`} />
          <span className={`${baseClass(situation.onFirst)} right-0 top-1/2 -translate-y-1/2`} />
        </div>
        {(first || second || third) && (
          <p className="max-w-[10rem] text-center text-[11px] leading-tight text-slate-500">
            {[
              third ? `3B ${third}` : null,
              second ? `2B ${second}` : null,
              first ? `1B ${first}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
        {situation.balls != null || situation.strikes != null ? (
          <p className="font-mono tabular-nums">
            Count {situation.balls ?? "—"}-{situation.strikes ?? "—"}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5" aria-label={`${outs} out`}>
          <span>Outs</span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < outs
                  ? "bg-red-600 dark:bg-red-500"
                  : "border border-slate-400 bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
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

export type GameDetailClientProps = {
  gameId: string;
};

export function GameDetailClient({ gameId }: GameDetailClientProps) {
  const searchParams = useSearchParams();
  const initialView: DetailView =
    searchParams.get("view") === "box" ? "box" : "gameday";

  const [view, setView] = useState<DetailView>(initialView);
  const [data, setData] = useState<WpblGameDetailResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  useEffect(() => {
    setView(searchParams.get("view") === "box" ? "box" : "gameday");
  }, [searchParams]);

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

  const lastPlay = useMemo(
    () => (data ? latestWpblPlay(data.boxscore.plays) : null),
    [data],
  );

  const setViewAndUrl = useCallback(
    (next: DetailView) => {
      setView(next);
      const url = new URL(window.location.href);
      if (next === "box") {
        url.searchParams.set("view", "box");
      } else {
        url.searchParams.delete("view");
      }
      window.history.replaceState(null, "", url.pathname + url.search);
    },
    [],
  );

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
              <span className="ml-2 text-red-600 dark:text-red-400">· Live</span>
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
          <div className="space-y-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
            <SituationBoard situation={situation} />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
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
          </div>
        ) : null}

        {lastPlay ? <LatestPlayBanner play={lastPlay} /> : null}
      </header>

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
            <PlayByPlayPanel plays={boxscore.plays} />
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
