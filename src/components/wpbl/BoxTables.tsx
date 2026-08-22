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
    <div className="wpbl-panel">
      <div className="wpbl-panel-inset px-3 py-2">
        <h3 className="wpbl-section-label">{title}</h3>
      </div>
      {players.length === 0 ? (
        <p className="px-3 py-3 text-sm wpbl-muted">No {title.toLowerCase()} stats.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead className="bg-[var(--wpbl-bg-elevated)] text-xs uppercase tracking-wide wpbl-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-2 py-2 text-left font-medium">Pos</th>
                {columns.map((col) => (
                  <th key={col} className="px-2 py-2 text-center font-medium">
                    {col.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr
                  key={`${player.playerId ?? player.name}-${player.position ?? ""}`}
                  className="border-t border-[var(--wpbl-rule)] whitespace-nowrap hover:bg-[var(--wpbl-bg-hover)]"
                >
                  <td className="px-3 py-2">
                    <PlayerNameLink
                      playerId={player.playerId}
                      name={player.name}
                      className="text-[var(--wpbl-ink)]"
                    />
                  </td>
                  <td className="px-2 py-2 wpbl-muted">
                    {formatWpblPosition(player.position) ?? "—"}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-2 py-2 text-center font-mono tabular-nums text-[var(--wpbl-ink-secondary)]"
                    >
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

  const tabs: { id: Side; label: string; abbr: string }[] = [
    { id: "away", label: awayLabel, abbr: awayAbbr },
    { id: "home", label: homeLabel, abbr: homeAbbr },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-[var(--wpbl-rule)]">
        {tabs.map((tab) => {
          const active = side === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex items-center gap-1.5 pb-2 ${
                active ? "wpbl-tab wpbl-tab--active" : "wpbl-tab"
              } ${active ? "wpbl-team-accent-border-b" : ""}`}
              style={active ? wpblTeamAccent(tab.abbr) : undefined}
              onClick={() => setSide(tab.id)}
            >
              <TeamLogo key={tab.abbr} abbr={tab.abbr} size="sm" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <PlayerStatsTable title="Batting" players={sideBatting} columns={BATTING_COLUMNS} />
      <PlayerStatsTable title="Pitching" players={sidePitching} columns={PITCHING_COLUMNS} />
    </div>
  );
}
