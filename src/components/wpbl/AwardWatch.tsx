"use client";

import { useMemo } from "react";

import type { WpblLeadersResponse } from "@/lib/types/wpbl-display";
import {
  buildCyWatch,
  buildMvpWatch,
  type AwardCandidate,
} from "@/lib/wpbl-stats-enrichment";
import { formatWpblPosition } from "@/lib/wpbl-position";

import { PlayerHeadshot } from "./PlayerHeadshot";
import { PlayerNameLink } from "./PlayerNameLink";
import { teamAccentStyle } from "./teamAccent";

function AwardList({
  title,
  subtitle,
  formula,
  candidates,
}: {
  title: string;
  subtitle: string;
  formula: string;
  candidates: AwardCandidate[];
}) {
  return (
    <div className="wpbl-panel">
      <div className="border-b border-[var(--wpbl-rule)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--wpbl-ink)]">{title}</p>
        <p className="mt-0.5 text-[11px] wpbl-muted">{subtitle}</p>
      </div>
      {candidates.length === 0 ? (
        <p className="px-4 py-8 text-sm wpbl-muted">Not enough data yet.</p>
      ) : (
        <ol>
          {candidates.map((c, i) => (
            <li
              key={c.playerId}
              className="wpbl-team-accent flex items-center gap-3 border-b border-[var(--wpbl-rule)] px-4 py-3 last:border-b-0"
              style={teamAccentStyle(c.teamAbbr)}
            >
              <span className="w-5 shrink-0 text-right text-sm tabular-nums wpbl-muted">
                {i + 1}
              </span>
              <PlayerHeadshot
                name={c.name}
                headshotUrl={c.headshotUrl}
                teamAbbr={c.teamAbbr}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <PlayerNameLink
                  playerId={c.playerId}
                  name={c.name}
                  className="block truncate text-sm font-semibold text-[var(--wpbl-ink)]"
                />
                <span className="mt-0.5 block truncate text-[11px] wpbl-muted">
                  {[formatWpblPosition(c.position), c.teamAbbr]
                    .filter(Boolean)
                    .join(" · ")}
                  {c.highlights.length
                    ? ` · ${c.highlights.join(" · ")}`
                    : ""}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-bold tabular-nums text-[var(--wpbl-ink)]">
                  {c.scoreLabel}
                </span>
                <span className="text-[10px] uppercase tracking-wide wpbl-muted">
                  idx
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="border-t border-[var(--wpbl-rule)] px-4 py-2 text-[10px] leading-relaxed wpbl-muted">
        {formula}
      </p>
    </div>
  );
}

export function AwardWatch({ leaders }: { leaders: WpblLeadersResponse }) {
  const mvp = useMemo(() => buildMvpWatch(leaders), [leaders]);
  const cy = useMemo(() => buildCyWatch(leaders), [leaders]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AwardList
        title="Board MVP watch"
        subtitle="Proxy index from season leaders — not an official award"
        formula="OPS×100 + HR×4 + RBI×1.5 + R×1 + SB×0.5 + H×0.15"
        candidates={mvp}
      />
      <AwardList
        title="Board Cy watch"
        subtitle="Proxy index from pitching leaders — not an official award"
        formula="SO + W×5 − ERA×8 − WHIP×6 + IP×0.4"
        candidates={cy}
      />
    </div>
  );
}
