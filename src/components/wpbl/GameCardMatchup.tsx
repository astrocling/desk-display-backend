"use client";

import type { ReactNode } from "react";

import { getWpblTeamBrand } from "@/lib/wpbl-team-brand";

import { TeamLogo } from "./TeamLogo";

export type GameCardTeam = {
  abbr: string;
  name: string;
  record?: string | null;
  runs?: number | null;
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
              ? "font-bold text-[var(--wpbl-ink)]"
              : "font-semibold text-[var(--wpbl-ink-secondary)]"
          }`}
        >
          {nickname}
        </p>
        <p className="truncate text-[11px] leading-snug wpbl-muted">{meta}</p>
      </div>
      {showScore ? (
        <p
          className={`w-9 shrink-0 text-right text-2xl tabular-nums tracking-tight ${
            team.emphasize
              ? "font-bold text-[var(--wpbl-ink)]"
              : "font-semibold text-[var(--wpbl-muted)]"
          }`}
        >
          {team.runs == null ? "—" : team.runs}
        </p>
      ) : null}
    </div>
  );
}

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
