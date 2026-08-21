import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import { TeamLogo } from "./TeamLogo";

export type LineScoreProps = {
  lineScore: NonNullable<WpblGameDetailResponse["boxscore"]["lineScore"]>;
};

function cellRuns(runs: number | null | undefined): string {
  if (runs == null) return "—";
  return String(runs);
}

export function LineScore({ lineScore }: LineScoreProps) {
  const innings = Array.from({ length: lineScore.maxInning }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Team</th>
            {innings.map((inning) => (
              <th key={inning} className="px-2 py-2 text-center font-medium tabular-nums">
                {inning}
              </th>
            ))}
            <th className="px-2 py-2 text-center font-medium">R</th>
            <th className="px-2 py-2 text-center font-medium">H</th>
            <th className="px-2 py-2 text-center font-medium">E</th>
            <th className="px-2 py-2 text-center font-medium">LOB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {lineScore.teams.map((team) => (
            <tr key={team.side} className="whitespace-nowrap">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <TeamLogo key={team.abbr} abbr={team.abbr} size="sm" />
                  <span className="font-medium">{team.abbr}</span>
                  <span className="text-slate-500">{team.name}</span>
                </span>
              </td>
              {innings.map((inning) => {
                const cell = team.innings.find((i) => i.inning === inning);
                return (
                  <td key={inning} className="px-2 py-2 text-center font-mono tabular-nums">
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
              <td className="px-2 py-2 text-center font-mono tabular-nums">
                {cellRuns(team.lob)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
