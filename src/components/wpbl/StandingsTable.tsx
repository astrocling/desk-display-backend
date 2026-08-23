import type { WpblStandingRow } from "@/lib/types/wpbl-display";
import { getWpblTeamBrand } from "@/lib/wpbl-team-brand";

import { TeamLogo } from "./TeamLogo";

export type StandingsTableProps = {
  rows: WpblStandingRow[];
  variant?: "full" | "compact";
};

const stickyHead =
  "sticky z-20 bg-[var(--wpbl-bg-elevated)]";
const stickyBody =
  "sticky z-10 bg-[var(--wpbl-bg-panel)]";
const stickyEdge =
  "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.45)]";
const rowBorder = "border-t border-[var(--wpbl-rule)]";

export function StandingsTable({
  rows,
  variant = "full",
}: StandingsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm wpbl-muted">No standings available.</p>;
  }

  if (variant === "compact") {
    return (
      <div className="wpbl-table-wrap">
        <table>
          <thead>
            <tr>
              <th className="w-9">#</th>
              <th className="w-10" aria-label="Logo" />
              <th>Team</th>
              <th>W‑L</th>
              <th>Pct</th>
              <th>GB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td className="tabular-nums wpbl-muted">{row.rank}</td>
                <td>
                  <TeamLogo key={row.abbr} abbr={row.abbr} size="md" />
                </td>
                <td className="font-medium">{row.abbr}</td>
                <td className="tabular-nums">
                  {row.w}‑{row.l}
                  {row.t > 0 ? `‑${row.t}` : ""}
                </td>
                <td className="tabular-nums">{row.pct ?? "—"}</td>
                <td className="tabular-nums">{row.gb ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="wpbl-table-wrap">
      <table className="w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={`${stickyHead} left-0 w-9 min-w-9`}>#</th>
            <th
              className={`${stickyHead} ${stickyEdge} left-9 min-w-[10rem]`}
            >
              Team
            </th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>Pct</th>
            <th>GB</th>
            <th>RF</th>
            <th>RA</th>
            <th>Diff</th>
            <th>L10</th>
            <th>Strk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const nickname =
              getWpblTeamBrand(row.abbr)?.name ?? row.name;
            return (
              <tr key={row.teamId} className="whitespace-nowrap">
                <td
                  className={`${stickyBody} ${rowBorder} left-0 w-9 min-w-9 tabular-nums wpbl-muted`}
                >
                  {row.rank}
                </td>
                <td
                  className={`${stickyBody} ${stickyEdge} ${rowBorder} left-9 min-w-[10rem]`}
                >
                  <span className="flex items-center gap-2.5">
                    <TeamLogo key={row.abbr} abbr={row.abbr} size="md" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">
                        {nickname}
                      </span>
                      <span className="block text-[11px] leading-tight wpbl-muted">
                        {row.abbr}
                      </span>
                    </span>
                  </span>
                </td>
                <td className={`${rowBorder} tabular-nums`}>{row.w}</td>
                <td className={`${rowBorder} tabular-nums`}>{row.l}</td>
                <td className={`${rowBorder} tabular-nums`}>{row.t}</td>
                <td className={`${rowBorder} tabular-nums`}>
                  {row.pct ?? "—"}
                </td>
                <td className={`${rowBorder} tabular-nums`}>
                  {row.gb ?? "—"}
                </td>
                <td className={`${rowBorder} tabular-nums`}>{row.rf}</td>
                <td className={`${rowBorder} tabular-nums`}>{row.ra}</td>
                <td className={`${rowBorder} tabular-nums`}>{row.diff}</td>
                <td className={`${rowBorder} tabular-nums`}>
                  {row.l10 ?? "—"}
                </td>
                <td className={`${rowBorder} tabular-nums`}>
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
