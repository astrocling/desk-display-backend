"use client";

import type { ReactNode } from "react";

import { getWpblTeamBrand } from "@/lib/wpbl-team-brand";

import { TeamLogo } from "./TeamLogo";

export type GameCardTeam = {
  abbr: string;
  /** Full or short team name; brand nickname is preferred when available. */
  name: string;
  record?: string | null;
  runs?: number | null;
  /** Visually emphasize the winner on final cards. */
  emphasize?: boolean;
};

function teamSubtitle(team: GameCardTeam): string {
  const nickname = getWpblTeamBrand(team.abbr)?.name ?? team.name;
  return team.record ? `${nickname} · ${team.record}` : nickname;
}

function TeamIdentity({
  team,
  align,
}: {
  team: GameCardTeam;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamLogo abbr={team.abbr} size="md" />
      <div className="min-w-0 overflow-hidden">
        <p
          className={`truncate text-base tracking-tight ${
            team.emphasize
              ? "font-bold text-slate-900 dark:text-slate-50"
              : "font-semibold text-slate-800 dark:text-slate-100"
          }`}
        >
          {team.abbr}
        </p>
        <p className="truncate text-[11px] leading-snug text-slate-500">
          {teamSubtitle(team)}
        </p>
      </div>
    </div>
  );
}

function Score({
  runs,
  emphasize,
}: {
  runs: number | null | undefined;
  emphasize?: boolean;
}) {
  return (
    <p
      className={`w-8 shrink-0 text-center text-2xl tabular-nums tracking-tight sm:w-9 sm:text-3xl ${
        emphasize
          ? "font-bold text-slate-900 dark:text-slate-50"
          : "font-semibold text-slate-600 dark:text-slate-300"
      }`}
    >
      {runs == null ? "—" : runs}
    </p>
  );
}

/**
 * Shared away | status | home row for today/live/final cards.
 * Scores sit beside the center status so logos and abbreviations never overlap.
 */
export function GameCardMatchup({
  away,
  home,
  center,
  showScores,
}: {
  away: GameCardTeam;
  home: GameCardTeam;
  center: ReactNode;
  showScores: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3">
      <TeamIdentity team={away} align="left" />

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {showScores ? (
          <Score runs={away.runs} emphasize={away.emphasize} />
        ) : null}
        <div className="flex min-w-[4.75rem] max-w-[7rem] flex-col items-center gap-0.5 text-center sm:min-w-[5.5rem]">
          {center}
        </div>
        {showScores ? (
          <Score runs={home.runs} emphasize={home.emphasize} />
        ) : null}
      </div>

      <TeamIdentity team={home} align="right" />
    </div>
  );
}
