"use client";

import { useEffect, useMemo, useState } from "react";

import type { WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { formatWpblPosition } from "@/lib/wpbl-position";

import {
  categoriesWithData,
  findCategory,
  rankAndFilterEntries,
  type StatGroup,
} from "./leadersCategories";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { teamAccentStyle } from "./teamAccent";

export const LEADERS_DISPLAY_LIMIT = 10;

export type LeadersBoardsProps = {
  leaders: WpblLeadersResponse;
  teamFilter: string;
  limit?: number;
  initialCategoryId?: string;
  /** Controlled group (URL sync on stats page). */
  group?: StatGroup;
  onGroupChange?: (group: StatGroup) => void;
  /** Controlled category id. */
  categoryId?: string;
  onCategoryChange?: (categoryId: string) => void;
  /** Show gap-to-leader bar under counting-stat values. */
  showGapBars?: boolean;
  /** Compact density for home teaser. */
  compact?: boolean;
};

function LeaderRow({
  entry,
  rank,
  leagueRank,
  showLeagueRank,
  gapPct,
  showGap,
}: {
  entry: {
    playerId: string;
    name: string;
    teamAbbr: string;
    value: string;
    position: string | null;
    headshotUrl: string | null;
  };
  rank: number;
  leagueRank: number;
  showLeagueRank: boolean;
  gapPct: number | null;
  showGap: boolean;
}) {
  return (
    <li
      className="wpbl-team-accent border-b border-[var(--wpbl-rule)] last:border-b-0"
      style={teamAccentStyle(entry.teamAbbr)}
    >
      <div className="flex items-center gap-3.5 py-3.5 pl-3 pr-4">
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
            {showLeagueRank && leagueRank !== rank ? (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide">
                · #{leagueRank} lg
              </span>
            ) : null}
          </span>
        </span>
        <span className="wpbl-stat-value shrink-0">{entry.value}</span>
      </div>
      {showGap && gapPct != null ? (
        <div className="wpbl-race-gap px-4 pb-3">
          <div
            className="wpbl-race-gap__fill"
            style={{ width: `${gapPct}%` }}
          />
        </div>
      ) : null}
    </li>
  );
}

export function LeadersBoards({
  leaders,
  teamFilter,
  limit = LEADERS_DISPLAY_LIMIT,
  initialCategoryId = "hr",
  group: controlledGroup,
  onGroupChange,
  categoryId: controlledCategoryId,
  onCategoryChange,
  showGapBars = false,
  compact = false,
}: LeadersBoardsProps) {
  const [internalGroup, setInternalGroup] = useState<StatGroup>("hitting");
  const [internalCategoryId, setInternalCategoryId] = useState(initialCategoryId);

  const group = controlledGroup ?? internalGroup;
  const categoryId = controlledCategoryId ?? internalCategoryId;

  const setGroup = (next: StatGroup) => {
    onGroupChange?.(next);
    if (controlledGroup === undefined) setInternalGroup(next);
  };

  const setCategoryId = (next: string) => {
    onCategoryChange?.(next);
    if (controlledCategoryId === undefined) setInternalCategoryId(next);
  };

  const hittingCategories = useMemo(
    () => categoriesWithData(leaders, "hitting"),
    [leaders],
  );
  const pitchingCategories = useMemo(
    () => categoriesWithData(leaders, "pitching"),
    [leaders],
  );
  const groupCategories =
    group === "hitting" ? hittingCategories : pitchingCategories;

  useEffect(() => {
    if (groupCategories.length === 0) return;
    if (!groupCategories.some((c) => c.id === categoryId)) {
      setCategoryId(groupCategories[0]!.id);
    }
    // Intentionally sync invalid category when group/data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setCategoryId identity not stable
  }, [groupCategories, categoryId]);

  const active =
    groupCategories.find((c) => c.id === categoryId) ?? groupCategories[0];
  const ranked = active
    ? rankAndFilterEntries(active.getEntries(leaders), teamFilter, limit)
    : [];
  const qualifierNote = active?.qualifierNote?.(leaders.qualifiers);
  const showLeagueRank = teamFilter !== "ALL";
  const leaderSort =
    active && ranked.length > 0
      ? active.getEntries(leaders)[0]?.sortValue
      : undefined;

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
                const first =
                  id === "hitting" ? hittingCategories[0] : pitchingCategories[0];
                // Prefer keeping a same-label category if it exists in the other group.
                const keep = findCategory(categoryId);
                const parallel = (
                  id === "hitting" ? hittingCategories : pitchingCategories
                ).find((c) => keep && c.label === keep.label);
                if (parallel) setCategoryId(parallel.id);
                else if (first) setCategoryId(first.id);
              }}
              className={selected ? "wpbl-tab wpbl-tab--active" : "wpbl-tab"}
            >
              {label}
            </button>
          );
        })}
      </div>

      {groupCategories.length > 0 ? (
        <div className="border-b border-[var(--wpbl-rule)] px-3 py-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groupCategories.map((cat) => {
              const selected = cat.id === active?.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={
                    selected ? "wpbl-chip wpbl-chip--active" : "wpbl-chip"
                  }
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {qualifierNote ? (
        <p className="px-4 pt-2 text-[11px] wpbl-muted">{qualifierNote}</p>
      ) : null}

      {ranked.length === 0 ? (
        <p className={`px-4 text-sm wpbl-muted ${compact ? "py-6" : "py-8"}`}>
          {teamFilter === "ALL"
            ? "No leaders yet."
            : `No ${active?.label ?? "stat"} leaders for this team.`}
        </p>
      ) : (
        <ol className="px-1 pt-1">
          {ranked.map((entry, i) => {
            const gapPct =
              showGapBars &&
              active?.counting &&
              leaderSort != null &&
              leaderSort > 0
                ? Math.max(
                    0,
                    Math.min(100, (entry.sortValue / leaderSort) * 100),
                  )
                : null;
            return (
              <LeaderRow
                key={`${active!.id}-${entry.playerId}-${i}`}
                entry={entry}
                rank={i + 1}
                leagueRank={entry.leagueRank}
                showLeagueRank={showLeagueRank}
                gapPct={gapPct}
                showGap={Boolean(showGapBars && active?.counting)}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}
