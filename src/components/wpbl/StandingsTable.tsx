import type { WpblStandingRow } from "@/lib/types/wpbl-display";

import { TeamLogo } from "./TeamLogo";

export type StandingsTableProps = {
  rows: WpblStandingRow[];
};

export function StandingsTable({ rows }: StandingsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No standings available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
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
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((row) => (
            <tr key={row.teamId} className="whitespace-nowrap">
              <td className="px-3 py-2 tabular-nums text-slate-500">{row.rank}</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <TeamLogo key={row.abbr} abbr={row.abbr} size="sm" />
                  <span className="font-medium">{row.abbr}</span>
                  <span className="text-slate-500">{row.name}</span>
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums">{row.w}</td>
              <td className="px-3 py-2 tabular-nums">{row.l}</td>
              <td className="px-3 py-2 tabular-nums">{row.t}</td>
              <td className="px-3 py-2 tabular-nums">{row.pct ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{row.gb ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{row.rf}</td>
              <td className="px-3 py-2 tabular-nums">{row.ra}</td>
              <td className="px-3 py-2 tabular-nums">{row.diff}</td>
              <td className="px-3 py-2 tabular-nums">{row.l10 ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{row.streak ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
