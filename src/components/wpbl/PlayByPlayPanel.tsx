"use client";

import { useMemo, useState } from "react";

import type { WpblPlay } from "@/lib/types/wpbl-display";
import {
  filterWpblPlays,
  formatPlayInning,
} from "@/lib/wpbl-plays";

export type PlayByPlayPanelProps = {
  plays: WpblPlay[];
};

function PlayRow({ play }: { play: WpblPlay }) {
  return (
    <li
      className={`border-b border-slate-100 px-3 py-2.5 last:border-b-0 dark:border-slate-800 ${
        play.isScoringPlay
          ? "bg-emerald-50/70 dark:bg-emerald-950/30"
          : ""
      }`}
    >
      <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <span>{formatPlayInning(play)}</span>
        {play.outs != null ? <span>{play.outs} out</span> : null}
        {play.isScoringPlay ? (
          <span className="rounded bg-emerald-600 px-1 py-px text-[9px] font-semibold text-white">
            {play.runsScored > 0
              ? `${play.runsScored} run${play.runsScored === 1 ? "" : "s"}`
              : "Scoring"}
          </span>
        ) : null}
        {play.pitchSequence ? (
          <span className="font-mono normal-case tracking-normal text-slate-400">
            {play.pitchSequence}
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-snug text-slate-800 dark:text-slate-100">
        {play.narrative}
      </p>
    </li>
  );
}

export function PlayByPlayPanel({ plays }: PlayByPlayPanelProps) {
  const [mode, setMode] = useState<"all" | "scoring">("all");
  const visible = useMemo(() => filterWpblPlays(plays, mode), [plays, mode]);

  if (!plays.length) {
    return (
      <p className="text-sm text-slate-500">
        Play-by-play will appear when the official feed publishes plays.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {visible.length} {mode === "scoring" ? "scoring " : ""}
          play{visible.length === 1 ? "" : "s"}
          {mode === "scoring" ? ` · ${plays.length} total` : ""}
        </p>
        <div
          className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700"
          role="group"
          aria-label="Play filter"
        >
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === "all"
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setMode("scoring")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === "scoring"
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            Scoring
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No scoring plays yet.</p>
      ) : (
        <ul className="max-h-[min(28rem,60vh)] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {visible.map((play) => (
            <PlayRow key={play.sequence} play={play} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function LatestPlayBanner({ play }: { play: WpblPlay | null }) {
  if (!play) return null;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        play.isScoringPlay
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
      }`}
    >
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Latest play · {formatPlayInning(play)}
        {play.isScoringPlay ? " · Scoring" : ""}
      </p>
      <p className="text-sm leading-snug text-slate-800 dark:text-slate-100">
        {play.narrative}
      </p>
    </div>
  );
}
