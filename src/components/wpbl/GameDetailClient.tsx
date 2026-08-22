"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  WpblBoxPlayerLine,
  WpblGameDetailResponse,
  WpblGameStatus,
  WpblTrackingEvent,
} from "@/lib/types/wpbl-display";
import { WPBL_LINK } from "@/lib/wpbl-board";
import type { WpblLiveConnection } from "@/lib/wpbl-live-ws";
import { latestWpblPlay } from "@/lib/wpbl-plays";
import { chipsForPlay } from "@/lib/wpbl-tracking";

import { BoxTables } from "./BoxTables";
import { GamedayScoreboard } from "./GamedayScoreboard";
import { LineScore } from "./LineScore";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PitchLog } from "./PitchLog";
import { PlayByPlayPanel } from "./PlayByPlayPanel";
import { TrackingPanel } from "./TrackingPanel";
import { useWpblLiveGame } from "./useWpblLiveGame";
import { WpblBoardError, WpblBoardLoading } from "./WpblBoardShell";

type DetailView = "gameday" | "box" | "trackman";

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
    scheduled: "bg-[var(--wpbl-bg-hover)] text-[var(--wpbl-ink-secondary)]",
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
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--wpbl-accent)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--wpbl-accent)]" />
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

function viewFromSearchParam(value: string | null): DetailView {
  if (value === "box") return "box";
  if (value === "trackman") return "trackman";
  return "gameday";
}

function ViewTabs({
  view,
  onChange,
  playCount,
  trackingCount,
}: {
  view: DetailView;
  onChange: (next: DetailView) => void;
  playCount: number;
  trackingCount: number;
}) {
  const tabClass = (active: boolean) =>
    active ? "wpbl-chip wpbl-chip--active" : "wpbl-chip";

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--wpbl-rule)] p-1 text-sm"
      role="tablist"
      aria-label="Game detail view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "gameday"}
        onClick={() => onChange("gameday")}
        className={tabClass(view === "gameday")}
      >
        Gameday
        {playCount > 0 ? (
          <span className="ml-1.5 text-xs opacity-70">{playCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "trackman"}
        onClick={() => onChange("trackman")}
        className={tabClass(view === "trackman")}
      >
        TrackMan
        {trackingCount > 0 ? (
          <span className="ml-1.5 text-xs opacity-70">{trackingCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "box"}
        onClick={() => onChange("box")}
        className={tabClass(view === "box")}
      >
        Box score
      </button>
    </div>
  );
}

function LatestPlayBanner({
  play,
  tracking,
  batting,
  pitching,
}: {
  play: NonNullable<ReturnType<typeof latestWpblPlay>>;
  tracking: WpblTrackingEvent[];
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
}) {
  const chips = chipsForPlay(play, tracking);
  const roster = rosterFromBoxLines(batting, pitching);

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        play.isScoringPlay
          ? "border-[color-mix(in_srgb,var(--wpbl-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--wpbl-accent)_8%,var(--wpbl-bg-panel))]"
          : "border-[var(--wpbl-rule)] bg-[var(--wpbl-bg-elevated)]"
      }`}
    >
      <p className="wpbl-section-label mb-0.5">
        Latest play ·{" "}
        {play.half === "top"
          ? `Top ${play.inning}`
          : play.half === "bottom"
            ? `Bot ${play.inning}`
            : `Inn ${play.inning}`}
        {play.isScoringPlay ? " · Scoring" : ""}
      </p>
      <p className="text-sm leading-snug text-[var(--wpbl-ink-secondary)]">
        {linkifyPlayerNames(play.narrative, roster)}
      </p>
      {chips.length > 0 ? (
        <div className="mt-2">
          <PitchLog chips={chips} compact />
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
  const initialView: DetailView = viewFromSearchParam(
    searchParams.get("view"),
  );

  const [view, setView] = useState<DetailView>(initialView);
  const { data, loading, notFound, error, connection } = useWpblLiveGame(
    gameId,
    { initialData },
  );

  useEffect(() => {
    // replaceState does not update useSearchParams; keep tab in sync with the URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL ↔ tab sync
    setView(viewFromSearchParam(searchParams.get("view")));
  }, [searchParams]);

  const isLive = data?.game.status === "live";

  const lastPlay = useMemo(
    () => (data ? latestWpblPlay(data.boxscore.plays) : null),
    [data],
  );

  const setViewAndUrl = useCallback((next: DetailView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "box" || next === "trackman") {
      url.searchParams.set("view", next);
    } else {
      url.searchParams.delete("view");
    }
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  if (loading) {
    return <WpblBoardLoading />;
  }

  if (notFound) {
    return (
      <div className="mt-8 space-y-4">
        <Link href="/wpbl" className={`text-sm ${WPBL_LINK}`}>
          ← Back to WPBL
        </Link>
        <p className="text-sm wpbl-muted">Game not found.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mt-8 space-y-4">
        <Link href="/wpbl" className={`text-sm ${WPBL_LINK}`}>
          ← Back to WPBL
        </Link>
        <WpblBoardError message={error} />
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
      <Link href="/wpbl" className={`inline-block text-sm ${WPBL_LINK}`}>
        ← Back to WPBL
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={game.status} />
        <FeedBadge connection={connection} isLive={Boolean(isLive)} />
        <span className="text-xs wpbl-muted">
          {updatedAt ? <>Updated {formatUpdatedAt(updatedAt)}</> : null}
        </span>
        {game.venue ? (
          <span className="text-xs wpbl-muted">· {game.venue}</span>
        ) : null}
        {game.whenEt && game.status !== "live" ? (
          <span className="text-xs wpbl-muted">· {game.whenEt}</span>
        ) : null}
      </div>

      <GamedayScoreboard detail={data} />

      {lastPlay ? (
        <LatestPlayBanner
          play={lastPlay}
          tracking={boxscore.tracking ?? []}
          batting={boxscore.batting}
          pitching={boxscore.pitching}
        />
      ) : null}

      {boxscore.available && boxscore.lineScore ? (
        <section>
          <h2 className="wpbl-section-label mb-3">Line score</h2>
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
          trackingCount={boxscore.tracking?.length ?? 0}
        />

        {view === "gameday" ? (
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Play-by-play
            </h2>
            <PlayByPlayPanel
              plays={boxscore.plays}
              tracking={boxscore.tracking ?? []}
              batting={boxscore.batting}
              pitching={boxscore.pitching}
            />
          </div>
        ) : view === "trackman" ? (
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              TrackMan
            </h2>
            <TrackingPanel
              tracking={boxscore.tracking ?? []}
              batting={boxscore.batting}
              pitching={boxscore.pitching}
              isLive={Boolean(isLive)}
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
