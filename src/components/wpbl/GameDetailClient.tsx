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
import { BoxTables } from "./BoxTables";
import { GamedayScoreboard } from "./GamedayScoreboard";
import { LineScore } from "./LineScore";
import {
  linkifyPlayerNames,
  rosterFromBoxLines,
} from "./linkifyPlayerNames";
import { PlayByPlayPanel } from "./PlayByPlayPanel";
import { TrackingPanel } from "./TrackingPanel";
import { WpblBoardError, WpblBoardLoading } from "./WpblBoardShell";
import { WpblDetailTabs } from "./WpblDetailTabs";
import { useWpblLiveGame } from "./useWpblLiveGame";

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
    live: "bg-[var(--wpbl-live)] text-[var(--wpbl-bg)]",
    final: "bg-[var(--wpbl-bg-hover)] text-[var(--wpbl-ink-secondary)]",
    scheduled: "bg-[var(--wpbl-bg-hover)] text-[var(--wpbl-ink-secondary)]",
    other: "bg-[var(--wpbl-warning)] text-[var(--wpbl-bg)]",
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
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--wpbl-warning)" }}
      >
        {connection === "connecting" ? "Connecting feed…" : "Reconnecting…"}
      </span>
    );
  }

  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide wpbl-muted">
      Polling
    </span>
  );
}

function viewFromSearchParam(value: string | null): DetailView {
  if (value === "box") return "box";
  if (value === "trackman") return "trackman";
  return "gameday";
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
  const roster = rosterFromBoxLines(batting, pitching);

  return (
    <div
      className={`border-l-2 px-3 py-2 ${
        play.isScoringPlay
          ? "border-[var(--wpbl-accent)]"
          : "border-[var(--wpbl-rule)]"
      }`}
    >
      <p className="wpbl-feed-meta mb-1">
        <span>Latest play</span>
        <span>
          {play.half === "top"
            ? `Top ${play.inning}`
            : play.half === "bottom"
              ? `Bot ${play.inning}`
              : `Inn ${play.inning}`}
        </span>
        {play.isScoringPlay ? <span>Scoring</span> : null}
      </p>
      <p className="wpbl-feed-body">
        {linkifyPlayerNames(play.narrative, roster)}
      </p>
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
        <WpblDetailTabs
          ariaLabel="Game detail view"
          active={view}
          onChange={setViewAndUrl}
          tabs={[
            { id: "gameday" as const, label: "Gameday", count: boxscore.plays.length },
            {
              id: "trackman" as const,
              label: "TrackMan",
              count: boxscore.tracking?.length ?? 0,
            },
            { id: "box" as const, label: "Box score" },
          ]}
        />

        {view === "gameday" ? (
          <PlayByPlayPanel
            plays={boxscore.plays}
            batting={boxscore.batting}
            pitching={boxscore.pitching}
            awayAbbr={game.awayAbbr}
            homeAbbr={game.homeAbbr}
          />
        ) : view === "trackman" ? (
          <TrackingPanel
            tracking={boxscore.tracking ?? []}
            batting={boxscore.batting}
            pitching={boxscore.pitching}
            isLive={Boolean(isLive)}
          />
        ) : boxscore.available ? (
          <BoxTables
            batting={boxscore.batting}
            pitching={boxscore.pitching}
            awayLabel={`${game.awayAbbr} ${game.awayName}`}
            homeLabel={`${game.homeAbbr} ${game.homeName}`}
            awayAbbr={game.awayAbbr}
            homeAbbr={game.homeAbbr}
          />
        ) : (
          <p className="text-sm wpbl-muted">Box score not available yet.</p>
        )}
      </section>
    </div>
  );
}
