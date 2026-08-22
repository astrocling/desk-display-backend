import type { WpblStandingRow } from "@/lib/types/wpbl-display";
import { getWpblTeamBrand } from "@/lib/wpbl-team-brand";

import { TeamLogo } from "./TeamLogo";

export type StandingsTableProps = {
  rows: WpblStandingRow[];
};

const stickyHead =
  "sticky z-20 bg-slate-50 dark:bg-slate-900";
const stickyBody =
  "sticky z-10 bg-white dark:bg-[var(--background)]";
const stickyEdge =
  "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)] dark:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.45)]";
const rowBorder = "border-t border-slate-200 dark:border-slate-700";

export function StandingsTable({ rows }: StandingsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No standings available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className={`${stickyHead} left-0 w-9 min-w-9 px-2 py-2 font-medium`}>
              #
            </th>
            <th
              className={`${stickyHead} ${stickyEdge} left-9 min-w-[8.5rem] px-2 py-2 font-medium`}
            >
              Team
            </th>
            <th className="px-3 py-2 font-medium">W</th>
            <th className="px-3 py-2 font-medium">L</th>
            <th className="px-3 py-2 font-medium">T</th>
            <th className="px-3 py-2 font-medium">Pct</th>
            <th className="px-3 py-2 font-medium">GB</th>
            <th className="px-3 py-2 font-medium">RF</th>
            <th className="px-3 py-2 font-medium">RA</th>
            <th className="px-3 py-2 font-medium">Diff</th>
            <th className="px-3 py-2 font-medium">L10</th>
            <th className="px-3 py-2 font-medium">Strk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const nickname =
              getWpblTeamBrand(row.abbr)?.name ?? row.name;
            return (
              <tr key={row.teamId} className="whitespace-nowrap">
                <td
                  className={`${stickyBody} ${rowBorder} left-0 w-9 min-w-9 px-2 py-2 tabular-nums text-slate-500`}
                >
                  {row.rank}
                </td>
                <td
                  className={`${stickyBody} ${stickyEdge} ${rowBorder} left-9 min-w-[8.5rem] px-2 py-2`}
                >
                  <span className="flex items-center gap-2.5">
                    <TeamLogo key={row.abbr} abbr={row.abbr} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">
                        {nickname}
                      </span>
                      <span className="block text-[11px] leading-tight text-slate-500">
                        {row.abbr}
                      </span>
                    </span>
                  </span>
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.w}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.l}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.t}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.pct ?? "—"}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.gb ?? "—"}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.rf}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.ra}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.diff}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.l10 ?? "—"}
                </td>
                <td className={`${rowBorder} px-3 py-2 tabular-nums`}>
                  {row.streak ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
