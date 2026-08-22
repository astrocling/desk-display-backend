"use client";

import { useState } from "react";

import type { WpblLeaderEntry, WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

import { teamAccentStyle } from "./teamAccent";

export const LEADERS_DISPLAY_LIMIT = 10;

export type LeadersBoardsProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
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

function filterEntries(entries: WpblLeaderEntry[], teamFilter: string): WpblLeaderEntry[] {
  const filtered =
    teamFilter === "ALL" ? entries : entries.filter((e) => e.teamAbbr === teamFilter);
  return filtered.slice(0, LEADERS_DISPLAY_LIMIT);
}

function PlayerHeadshot({ entry }: { entry: WpblLeaderEntry }) {
  const [failed, setFailed] = useState(false);
  const logoSrc = wpblTeamLogoSrc(entry.teamAbbr);
  const showPhoto = Boolean(entry.headshotUrl) && !failed;

  return (
    <span className="relative inline-flex h-11 w-11 shrink-0">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote WPBL CDN URLs; avoid next/image domain allowlist churn
        <img
          src={entry.headshotUrl!}
          alt=""
          width={44}
          height={44}
          decoding="async"
          className="h-11 w-11 rounded-full object-cover object-top bg-neutral-700"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-700 text-sm font-semibold text-neutral-200"
          aria-hidden
        >
          {entry.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("") || "?"}
        </span>
      )}
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- local team marks
        <img
          src={logoSrc}
          alt=""
          width={16}
          height={16}
          decoding="async"
          className="absolute -left-0.5 -top-0.5 h-4 w-4 rounded-full bg-white object-contain p-px shadow-sm"
        />
      ) : null}
    </span>
  );
}

function LeaderRow({ entry, rank }: { entry: WpblLeaderEntry; rank: number }) {
  return (
    <li
      className="wpbl-team-accent flex items-center gap-3 border-b border-white/5 py-3 pl-3 pr-4 last:border-b-0"
      style={teamAccentStyle(entry.teamAbbr)}
    >
      <span className="w-5 shrink-0 text-right text-sm tabular-nums text-neutral-500">
        {rank}
      </span>
      <PlayerHeadshot entry={entry} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white">
          {entry.name}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-400">
          {[entry.position, entry.teamAbbr].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-2xl font-bold tabular-nums tracking-tight text-[#41B6E6]">
        {entry.value}
      </span>
    </li>
  );
}

export function LeadersBoards({ leaders, teamFilter }: LeadersBoardsProps) {
  const [group, setGroup] = useState<StatGroup>("hitting");
  const [categoryId, setCategoryId] = useState("hr");

  const groupCategories = CATEGORIES.filter((c) => c.group === group);
  const active =
    groupCategories.find((c) => c.id === categoryId) ?? groupCategories[0];
  const entries = filterEntries(active.getEntries(leaders), teamFilter);
  const minAb = leaders.qualifiers.battingMinAb;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-black text-white shadow-sm">
      <div className="flex gap-6 border-b border-white/10 px-4 pt-3">
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
              className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                selected ? "text-[#41B6E6]" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {label}
              {selected ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#41B6E6]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {active.showQualifier ? (
        <p className="px-4 pt-2 text-[11px] text-neutral-500">
          min {minAb} AB for AVG
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-sm text-neutral-500">No leaders yet.</p>
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

      <div className="border-t border-white/10 px-3 py-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupCategories.map((cat) => {
            const selected = cat.id === active.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                  selected
                    ? "bg-[#41B6E6] text-black"
                    : "border border-white/25 text-white hover:border-white/50"
                }`}
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
