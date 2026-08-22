"use client";

import { useState } from "react";

import type { WpblLeaderEntry, WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";

import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { teamAccentStyle } from "./teamAccent";

export const LEADERS_DISPLAY_LIMIT = 10;

export type LeadersBoardsProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
  limit?: number;
  initialCategoryId?: string;
};

type StatGroup = "hitting" | "pitching";

type CategoryDef = {
  id: string;
  label: string;
  group: StatGroup;
  showQualifier?: boolean;
  getEntries: (leaders: WpblLeadersResponse) => WpblLeaderEntry[];
};

const CATEGORIES: CategoryDef[] = [
  {
    id: "avg",
    label: "AVG",
    group: "hitting",
    showQualifier: true,
    getEntries: (l) => l.batting.avg,
  },
  {
    id: "hr",
    label: "HR",
    group: "hitting",
    getEntries: (l) => l.batting.hr,
  },
  {
    id: "rbi",
    label: "RBI",
    group: "hitting",
    getEntries: (l) => l.batting.rbi,
  },
  {
    id: "h",
    label: "H",
    group: "hitting",
    getEntries: (l) => l.batting.h,
  },
  {
    id: "era",
    label: "ERA",
    group: "pitching",
    getEntries: (l) => l.pitching.era,
  },
  {
    id: "so",
    label: "SO",
    group: "pitching",
    getEntries: (l) => l.pitching.so,
  },
  {
    id: "w",
    label: "W",
    group: "pitching",
    getEntries: (l) => l.pitching.w,
  },
  {
    id: "sv",
    label: "SV",
    group: "pitching",
    getEntries: (l) => l.pitching.sv,
  },
];

function filterEntries(
  entries: WpblLeaderEntry[],
  teamFilter: string,
  limit: number,
): WpblLeaderEntry[] {
  const filtered =
    teamFilter === "ALL" ? entries : entries.filter((e) => e.teamAbbr === teamFilter);
  return filtered.slice(0, limit);
}

function LeaderRow({ entry, rank }: { entry: WpblLeaderEntry; rank: number }) {
  return (
    <li
      className="wpbl-team-accent flex items-center gap-3 border-b border-[var(--wpbl-rule)] py-3 pl-3 pr-4 last:border-b-0"
      style={teamAccentStyle(entry.teamAbbr)}
    >
      <span className="w-5 shrink-0 text-right text-sm tabular-nums wpbl-muted">
        {rank}
      </span>
      <PlayerHeadshot
        name={entry.name}
        headshotUrl={entry.headshotUrl}
        teamAbbr={entry.teamAbbr}
        size={44}
      />
      <span className="min-w-0 flex-1">
        <PlayerNameLink
          playerId={entry.playerId}
          name={entry.name}
          className="block truncate text-[15px] font-semibold text-[var(--wpbl-ink)]"
        />
        <span className="mt-0.5 block text-xs wpbl-muted">
          {[formatWpblPosition(entry.position), entry.teamAbbr]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="wpbl-stat-value shrink-0">{entry.value}</span>
    </li>
  );
}

export function LeadersBoards({
  leaders,
  teamFilter,
  limit = LEADERS_DISPLAY_LIMIT,
  initialCategoryId = "hr",
}: LeadersBoardsProps) {
  const [group, setGroup] = useState<StatGroup>("hitting");
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  const groupCategories = CATEGORIES.filter((c) => c.group === group);
  const active =
    groupCategories.find((c) => c.id === categoryId) ?? groupCategories[0];
  const entries = filterEntries(active.getEntries(leaders), teamFilter, limit);
  const minAb = leaders.qualifiers.battingMinAb;

  return (
    <div className="wpbl-panel">
      <div className="flex gap-6 border-b border-[var(--wpbl-rule)] px-4 pt-3">
        {(
          [
            ["hitting", "Hitting"],
            ["pitching", "Pitching"],
          ] as const
        ).map(([id, label]) => {
          const selected = group === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setGroup(id);
                const first = CATEGORIES.find((c) => c.group === id);
                if (first) setCategoryId(first.id);
              }}
              className={selected ? "wpbl-tab wpbl-tab--active" : "wpbl-tab"}
            >
              {label}
            </button>
          );
        })}
      </div>

      {active.showQualifier ? (
        <p className="px-4 pt-2 text-[11px] wpbl-muted">
          min {minAb} AB for AVG
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-sm wpbl-muted">No leaders yet.</p>
      ) : (
        <ol className="px-1 pt-1">
          {entries.map((entry, i) => (
            <LeaderRow
              key={`${active.id}-${entry.playerId}-${i}`}
              entry={entry}
              rank={i + 1}
            />
          ))}
        </ol>
      )}

      <div className="wpbl-panel-inset px-3 py-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupCategories.map((cat) => {
            const selected = cat.id === active.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={selected ? "wpbl-chip wpbl-chip--active" : "wpbl-chip"}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
