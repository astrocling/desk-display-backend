import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

import { TeamLogo } from "./TeamLogo";

export type LineScoreProps = {
  lineScore: NonNullable<WpblGameDetailResponse["boxscore"]["lineScore"]>;
  /** Highlight the current inning column (live games). */
  highlightInning?: number | null;
  /** Tighter cells; omits LOB. Use inside live/final cards. */
  compact?: boolean;
};

function cellRuns(runs: number | null | undefined): string {
  if (runs == null) return "—";
  return String(runs);
}

function cellClass(
  inning: number | "total",
  highlightInning?: number | null,
): string {
  const base = "text-center font-mono tabular-nums";
  if (
    inning !== "total" &&
    highlightInning != null &&
    inning === highlightInning
  ) {
    return `${base} wpbl-line-score__cell--active`;
  }
  if (inning === "total") {
    return `${base} wpbl-line-score__total`;
  }
  return base;
}

function headerClass(inning: number, highlightInning?: number | null): string {
  const base = "text-center font-medium tabular-nums";
  if (highlightInning != null && inning === highlightInning) {
    return `${base} wpbl-line-score__cell--active`;
  }
  return base;
}

export function LineScore({
  lineScore,
  highlightInning = null,
  compact = false,
}: LineScoreProps) {
  const innings = Array.from({ length: lineScore.maxInning }, (_, i) => i + 1);
  const rootClass = [
    "wpbl-line-score",
    compact ? "wpbl-line-score--compact wpbl-line-score--embedded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <table>
        <thead>
          <tr>
            <th className="text-left font-medium">{compact ? "" : "Team"}</th>
            {innings.map((inning) => (
              <th
                key={inning}
                className={headerClass(inning, highlightInning)}
              >
                {inning}
              </th>
            ))}
            <th className="text-center font-medium">R</th>
            <th className="text-center font-medium">H</th>
            <th className="text-center font-medium">E</th>
            {!compact ? <th className="text-center font-medium">LOB</th> : null}
          </tr>
        </thead>
        <tbody>
          {lineScore.teams.map((team) => (
            <tr key={team.side}>
              <td>
                <span className="wpbl-line-score__team">
                  <TeamLogo key={team.abbr} abbr={team.abbr} size={compact ? "sm" : "md"} />
                  <span>{team.abbr}</span>
                  {!compact ? (
                    <span className="wpbl-line-score__team-meta">{team.name}</span>
                  ) : null}
                </span>
              </td>
              {innings.map((inning) => {
                const cell = team.innings.find((i) => i.inning === inning);
                return (
                  <td
                    key={inning}
                    className={cellClass(inning, highlightInning)}
                  >
                    {cellRuns(cell?.runs)}
                  </td>
                );
              })}
              <td className={cellClass("total")}>{cellRuns(team.runs)}</td>
              <td className="text-center font-mono tabular-nums">
                {cellRuns(team.hits)}
              </td>
              <td className="text-center font-mono tabular-nums">
                {cellRuns(team.errors)}
              </td>
              {!compact ? (
                <td className="text-center font-mono tabular-nums">
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
