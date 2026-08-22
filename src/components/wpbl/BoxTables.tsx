"use client";

import { useMemo, useState } from "react";

import type { WpblBoxPlayerLine } from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";
import { wpblTeamAccent } from "@/lib/wpbl-team-brand";

import { PlayerNameLink } from "./PlayerNameLink";
import { TeamLogo } from "./TeamLogo";

const BATTING_COLUMNS = ["ab", "r", "h", "rbi", "bb", "so", "avg", "obp", "slg"] as const;
const PITCHING_COLUMNS = ["ip", "h", "r", "er", "bb", "so", "era"] as const;

export type BoxTablesProps = {
  batting: WpblBoxPlayerLine[];
  pitching: WpblBoxPlayerLine[];
  awayLabel: string;
  homeLabel: string;
  awayAbbr: string;
  homeAbbr: string;
};

type Side = "away" | "home";

function formatStat(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function PlayerStatsTable({
  title,
  players,
  columns,
}: {
  title: string;
  players: WpblBoxPlayerLine[];
  columns: readonly string[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      {players.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">No {title.toLowerCase()} stats.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-2 py-2 font-medium">Pos</th>
                {columns.map((col) => (
                  <th key={col} className="px-2 py-2 text-center font-medium">
                    {col.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {players.map((player) => (
                <tr key={`${player.playerId ?? player.name}-${player.position ?? ""}`} className="whitespace-nowrap">
                  <td className="px-3 py-2">
                    <PlayerNameLink
                      playerId={player.playerId}
                      name={player.name}
                      className="text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
                    />
                  </td>
                  <td className="px-2 py-2 text-slate-500">
                    {formatWpblPosition(player.position) ?? "—"}
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-2 text-center font-mono tabular-nums">
                      {formatStat(player.stats[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function BoxTables({
  batting,
  pitching,
  awayLabel,
  homeLabel,
  awayAbbr,
  homeAbbr,
}: BoxTablesProps) {
  const [side, setSide] = useState<Side>("away");

  const sideBatting = useMemo(
    () => batting.filter((p) => p.side === side),
    [batting, side],
  );
  const sidePitching = useMemo(
    () => pitching.filter((p) => p.side === side),
    [pitching, side],
  );

  const tabClass = (active: boolean) =>
    active
      ? "border-b-2 font-medium text-slate-900 dark:text-slate-100"
      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 px-1 pb-2 text-sm ${side === "away" ? "wpbl-team-accent-border-b" : ""} ${tabClass(side === "away")}`}
          style={side === "away" ? wpblTeamAccent(awayAbbr) : undefined}
          onClick={() => setSide("away")}
        >
          <TeamLogo key={awayAbbr} abbr={awayAbbr} size="md" />
          {awayLabel}
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 px-1 pb-2 text-sm ${side === "home" ? "wpbl-team-accent-border-b" : ""} ${tabClass(side === "home")}`}
          style={side === "home" ? wpblTeamAccent(homeAbbr) : undefined}
          onClick={() => setSide("home")}
        >
          <TeamLogo key={homeAbbr} abbr={homeAbbr} size="md" />
          {homeLabel}
        </button>
      </div>

      <PlayerStatsTable title="Batting" players={sideBatting} columns={BATTING_COLUMNS} />
      <PlayerStatsTable title="Pitching" players={sidePitching} columns={PITCHING_COLUMNS} />
    </div>
  );
}
