import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import { TeamLogo } from "./TeamLogo";

export type LineScoreProps = {
  lineScore: NonNullable<WpblGameDetailResponse["boxscore"]["lineScore"]>;
  /** Highlight the current inning column (live games). */
  highlightInning?: number | null;
  /** Compact table omits LOB and long team names. */
  compact?: boolean;
};

function cellRuns(runs: number | null | undefined): string {
  if (runs == null) return "—";
  return String(runs);
}

function inningCellClass(inning: number, highlightInning?: number | null): string {
  const base = "px-2 py-2 text-center font-mono tabular-nums";
  if (highlightInning != null && inning === highlightInning) {
    return `${base} bg-slate-100 dark:bg-slate-800`;
  }
  return base;
}

export function LineScore({
  lineScore,
  highlightInning = null,
  compact = false,
}: LineScoreProps) {
  const innings = Array.from({ length: lineScore.maxInning }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Team</th>
            {innings.map((inning) => (
              <th
                key={inning}
                className={`px-2 py-2 text-center font-medium tabular-nums ${
                  highlightInning != null && inning === highlightInning
                    ? "bg-slate-200/80 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                    : ""
                }`}
              >
                {inning}
              </th>
            ))}
            <th className="px-2 py-2 text-center font-medium">R</th>
            <th className="px-2 py-2 text-center font-medium">H</th>
            <th className="px-2 py-2 text-center font-medium">E</th>
            {!compact ? (
              <th className="px-2 py-2 text-center font-medium">LOB</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {lineScore.teams.map((team) => (
            <tr key={team.side} className="whitespace-nowrap">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <TeamLogo key={team.abbr} abbr={team.abbr} size="md" />
                  <span className="font-medium">{team.abbr}</span>
                  {!compact ? (
                    <span className="text-slate-500">{team.name}</span>
                  ) : null}
                </span>
              </td>
              {innings.map((inning) => {
                const cell = team.innings.find((i) => i.inning === inning);
                return (
                  <td
                    key={inning}
                    className={inningCellClass(inning, highlightInning)}
                  >
                    {cellRuns(cell?.runs)}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center font-mono tabular-nums font-medium">
                {cellRuns(team.runs)}
              </td>
              <td className="px-2 py-2 text-center font-mono tabular-nums">
                {cellRuns(team.hits)}
              </td>
              <td className="px-2 py-2 text-center font-mono tabular-nums">
                {cellRuns(team.errors)}
              </td>
              {!compact ? (
                <td className="px-2 py-2 text-center font-mono tabular-nums">
                  {cellRuns(team.lob)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
