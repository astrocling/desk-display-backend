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
  qualifierNote?: (qualifiers: WpblLeadersResponse["qualifiers"]) => string;
  getEntries: (leaders: WpblLeadersResponse) => WpblLeaderEntry[];
};

function ipQualifierNote(q: WpblLeadersResponse["qualifiers"]): string {
  return `min ${(q.pitchingMinOuts / 3).toFixed(1).replace(/\.0$/, "")} IP`;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "avg",
    label: "AVG",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.avg ?? [],
  },
  {
    id: "obp",
    label: "OBP",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.obp ?? [],
  },
  {
    id: "slg",
    label: "SLG",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.slg ?? [],
  },
  {
    id: "ops",
    label: "OPS",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.ops ?? [],
  },
  {
    id: "hr",
    label: "HR",
    group: "hitting",
    getEntries: (l) => l.batting.hr ?? [],
  },
  {
    id: "rbi",
    label: "RBI",
    group: "hitting",
    getEntries: (l) => l.batting.rbi ?? [],
  },
  {
    id: "h",
    label: "H",
    group: "hitting",
    getEntries: (l) => l.batting.h ?? [],
  },
  {
    id: "r",
    label: "R",
    group: "hitting",
    getEntries: (l) => l.batting.r ?? [],
  },
  {
    id: "doubles",
    label: "2B",
    group: "hitting",
    getEntries: (l) => l.batting.doubles ?? [],
  },
  {
    id: "sb",
    label: "SB",
    group: "hitting",
    getEntries: (l) => l.batting.sb ?? [],
  },
  {
    id: "era",
    label: "ERA",
    group: "pitching",
    qualifierNote: ipQualifierNote,
    getEntries: (l) => l.pitching.era ?? [],
  },
  {
    id: "whip",
    label: "WHIP",
    group: "pitching",
    qualifierNote: ipQualifierNote,
    getEntries: (l) => l.pitching.whip ?? [],
  },
  {
    id: "ip",
    label: "IP",
    group: "pitching",
    qualifierNote: ipQualifierNote,
    getEntries: (l) => l.pitching.ip ?? [],
  },
  {
    id: "so",
    label: "SO",
    group: "pitching",
    getEntries: (l) => l.pitching.so ?? [],
  },
  {
    id: "w",
    label: "W",
    group: "pitching",
    getEntries: (l) => l.pitching.w ?? [],
  },
  {
    id: "l",
    label: "L",
    group: "pitching",
    getEntries: (l) => l.pitching.l ?? [],
  },
  {
    id: "sv",
    label: "SV",
    group: "pitching",
    getEntries: (l) => l.pitching.sv ?? [],
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
      className="wpbl-team-accent flex items-center gap-3.5 border-b border-[var(--wpbl-rule)] py-3.5 pl-3 pr-4 last:border-b-0"
      style={teamAccentStyle(entry.teamAbbr)}
    >
      <span className="w-5 shrink-0 text-right text-sm tabular-nums wpbl-muted">
        {rank}
      </span>
      <PlayerHeadshot
        name={entry.name}
        headshotUrl={entry.headshotUrl}
        teamAbbr={entry.teamAbbr}
        size={52}
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
  const qualifierNote = active.qualifierNote?.(leaders.qualifiers);

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

      {qualifierNote ? (
        <p className="px-4 pt-2 text-[11px] wpbl-muted">{qualifierNote}</p>
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
