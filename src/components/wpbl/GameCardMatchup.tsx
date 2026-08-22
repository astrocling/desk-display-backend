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

function teamNickname(team: GameCardTeam): string {
  return getWpblTeamBrand(team.abbr)?.name ?? team.name;
}

function TeamLine({
  team,
  showScore,
}: {
  team: GameCardTeam;
  showScore: boolean;
}) {
  const nickname = teamNickname(team);
  const meta = team.record
    ? `${team.abbr} · ${team.record}`
    : team.abbr;

  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5">
      <TeamLogo abbr={team.abbr} size="md" />
      <div className="min-w-0 overflow-hidden">
        <p
          className={`truncate text-sm tracking-tight ${
            team.emphasize
              ? "font-bold text-slate-900 dark:text-slate-50"
              : "font-semibold text-slate-800 dark:text-slate-100"
          }`}
        >
          {nickname}
        </p>
        <p className="truncate text-[11px] leading-snug text-slate-500">
          {meta}
        </p>
      </div>
      {showScore ? (
        <p
          className={`w-9 shrink-0 text-right text-2xl tabular-nums tracking-tight ${
            team.emphasize
              ? "font-bold text-slate-900 dark:text-slate-50"
              : "font-semibold text-slate-600 dark:text-slate-300"
          }`}
        >
          {team.runs == null ? "—" : team.runs}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shared matchup for today/live/final cards.
 * Stacks teams vertically (logo + nickname + score) with status on the right
 * so lettermark logos never collide with abbreviations on narrow viewports.
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4">
      <div className="min-w-0 space-y-2.5">
        <TeamLine team={away} showScore={showScores} />
        <TeamLine team={home} showScore={showScores} />
      </div>
      <div className="flex w-[5.25rem] shrink-0 flex-col items-center justify-center gap-0.5 text-center sm:w-[6rem]">
        {center}
      </div>
    </div>
  );
}
