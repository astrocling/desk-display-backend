"use client";

import { useMemo, useState } from "react";

import type { WpblLeaderEntry, WpblLeadersResponse } from "@/lib/types/wpbl-display";
import { LEADER_CATEGORIES } from "./leadersCategories";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { teamAccentStyle } from "./teamAccent";

function collectPlayers(leaders: WpblLeadersResponse): WpblLeaderEntry[] {
  const map = new Map<string, WpblLeaderEntry>();
  for (const cat of LEADER_CATEGORIES) {
    for (const e of cat.getEntries(leaders).slice(0, 20)) {
      if (!map.has(e.playerId)) map.set(e.playerId, e);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function lookupAcrossBoards(
  leaders: WpblLeadersResponse,
  playerId: string,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const cat of LEADER_CATEGORIES) {
    const entry = cat.getEntries(leaders).find((e) => e.playerId === playerId);
    if (entry) rows.push({ label: cat.label, value: entry.value });
  }
  return rows;
}

function PlayerPick({
  label,
  value,
  players,
  onChange,
  excludeId,
}: {
  label: string;
  value: string;
  players: WpblLeaderEntry[];
  onChange: (id: string) => void;
  excludeId?: string;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide wpbl-muted">
        {label}
      </span>
      <select
        className="wpbl-compare-select w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select player…</option>
        {players
          .filter((p) => p.playerId !== excludeId)
          .map((p) => (
            <option key={p.playerId} value={p.playerId}>
              {p.name} ({p.teamAbbr})
            </option>
          ))}
      </select>
    </label>
  );
}

function CompareColumn({
  entry,
  stats,
}: {
  entry: WpblLeaderEntry;
  stats: { label: string; value: string }[];
}) {
  return (
    <div
      className="wpbl-team-accent min-w-0 flex-1 rounded-lg border border-[var(--wpbl-rule)] bg-[var(--wpbl-bg-elevated)] p-3"
      style={teamAccentStyle(entry.teamAbbr)}
    >
      <div className="flex items-center gap-3">
        <PlayerHeadshot
          name={entry.name}
          headshotUrl={entry.headshotUrl}
          teamAbbr={entry.teamAbbr}
          size={48}
        />
        <div className="min-w-0">
          <PlayerNameLink
            playerId={entry.playerId}
            name={entry.name}
            className="block truncate text-sm font-semibold text-[var(--wpbl-ink)]"
          />
          <p className="text-xs wpbl-muted">{entry.teamAbbr}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <dt className="text-[10px] font-medium uppercase tracking-wide wpbl-muted">
              {s.label}
            </dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--wpbl-ink)]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PlayerCompare({ leaders }: { leaders: WpblLeadersResponse }) {
  const players = useMemo(() => collectPlayers(leaders), [leaders]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  const left = players.find((p) => p.playerId === leftId);
  const right = players.find((p) => p.playerId === rightId);
  const leftStats = leftId ? lookupAcrossBoards(leaders, leftId) : [];
  const rightStats = rightId ? lookupAcrossBoards(leaders, rightId) : [];

  return (
    <div className="wpbl-panel px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <PlayerPick
          label="Player A"
          value={leftId}
          players={players}
          onChange={setLeftId}
          excludeId={rightId}
        />
        <PlayerPick
          label="Player B"
          value={rightId}
          players={players}
          onChange={setRightId}
          excludeId={leftId}
        />
      </div>

      {left && right ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <CompareColumn entry={left} stats={leftStats} />
          <CompareColumn entry={right} stats={rightStats} />
        </div>
      ) : (
        <p className="mt-4 text-sm wpbl-muted">
          Pick two players to compare season leader-board lines side by side.
        </p>
      )}
    </div>
  );
}
