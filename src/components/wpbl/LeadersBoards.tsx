import type { WpblLeaderEntry, WpblLeadersResponse } from "@/lib/types/wpbl-display";

export type LeadersBoardsProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
};

type BoardDef = { title: string; entries: WpblLeaderEntry[]; showQualifier?: boolean };

function LeaderTable({ title, entries, showQualifier, minAb }: BoardDef & { minAb: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        {showQualifier ? (
          <p className="mt-0.5 text-[11px] text-slate-400">
            min {minAb} AB for AVG
          </p>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">—</p>
      ) : (
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((entry, i) => (
            <li
              key={`${entry.playerId}-${i}`}
              className="flex items-baseline gap-2 px-3 py-1.5 text-sm"
            >
              <span className="w-4 tabular-nums text-slate-400">{i + 1}</span>
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="text-xs text-slate-500">{entry.teamAbbr}</span>
              <span className="font-mono tabular-nums">{entry.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function filterEntries(entries: WpblLeaderEntry[], teamFilter: string): WpblLeaderEntry[] {
  if (teamFilter === "ALL") return entries;
  return entries.filter((e) => e.teamAbbr === teamFilter);
}

export function LeadersBoards({ leaders, teamFilter }: LeadersBoardsProps) {
  const minAb = leaders.qualifiers.battingMinAb;
  const boards: BoardDef[] = [
    {
      title: "AVG",
      entries: filterEntries(leaders.batting.avg, teamFilter),
      showQualifier: true,
    },
    { title: "HR", entries: filterEntries(leaders.batting.hr, teamFilter) },
    { title: "RBI", entries: filterEntries(leaders.batting.rbi, teamFilter) },
    { title: "H", entries: filterEntries(leaders.batting.h, teamFilter) },
    { title: "ERA", entries: filterEntries(leaders.pitching.era, teamFilter) },
    { title: "SO", entries: filterEntries(leaders.pitching.so, teamFilter) },
    { title: "W", entries: filterEntries(leaders.pitching.w, teamFilter) },
    { title: "SV", entries: filterEntries(leaders.pitching.sv, teamFilter) },
  ];

  return (
    <div>
      {leaders.partial ? (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
          Leaders partially loaded — some player stats unavailable.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {boards.map((board) => (
          <LeaderTable key={board.title} {...board} minAb={minAb} />
        ))}
      </div>
    </div>
  );
}
