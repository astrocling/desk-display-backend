"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  WpblPlayerBattingSeason,
  WpblPlayerDetailResponse,
  WpblPlayerGameLogEntry,
  WpblPlayerPitchingSeason,
} from "@/lib/types/wpbl-display";
import { WPBL_LINK, WPBL_PANEL } from "@/lib/wpbl-board";

import { PlayerHeadshot } from "./PlayerHeadshot";
import { teamAccentStyle } from "./teamAccent";
import { TeamLogo } from "./TeamLogo";
import { WpblBoardError, WpblBoardLoading } from "./WpblBoardShell";
import { WpblDetailTabs } from "./WpblDetailTabs";

type SeasonTab = "hitting" | "pitching" | "fielding";

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatGameDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[4.5rem]">
      <div className="wpbl-section-label text-[10px]">{label}</div>
      <div className="text-xl font-bold tabular-nums tracking-tight text-[var(--wpbl-ink)]">
        {value}
      </div>
    </div>
  );
}

function SeasonTable({
  columns,
  values,
}: {
  columns: Array<{ key: string; label: string }>;
  values: Record<string, string | number | null | undefined>;
}) {
  return (
    <div className="wpbl-table-wrap border-0 rounded-none">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="first:pl-4 last:pr-4">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((col) => {
              const v = values[col.key];
              return (
                <td
                  key={col.key}
                  className="font-mono tabular-nums text-[var(--wpbl-ink)] first:pl-4 last:pr-4"
                >
                  {v == null || v === "" ? "—" : String(v)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function battingColumns(): Array<{ key: string; label: string }> {
  return [
    { key: "g", label: "G" },
    { key: "ab", label: "AB" },
    { key: "r", label: "R" },
    { key: "h", label: "H" },
    { key: "doubles", label: "2B" },
    { key: "triples", label: "3B" },
    { key: "hr", label: "HR" },
    { key: "rbi", label: "RBI" },
    { key: "bb", label: "BB" },
    { key: "so", label: "SO" },
    { key: "sb", label: "SB" },
    { key: "avg", label: "AVG" },
    { key: "obp", label: "OBP" },
    { key: "slg", label: "SLG" },
    { key: "ops", label: "OPS" },
  ];
}

function pitchingColumns(): Array<{ key: string; label: string }> {
  return [
    { key: "g", label: "G" },
    { key: "gs", label: "GS" },
    { key: "w", label: "W" },
    { key: "l", label: "L" },
    { key: "sv", label: "SV" },
    { key: "ip", label: "IP" },
    { key: "h", label: "H" },
    { key: "r", label: "R" },
    { key: "er", label: "ER" },
    { key: "bb", label: "BB" },
    { key: "so", label: "SO" },
    { key: "era", label: "ERA" },
    { key: "whip", label: "WHIP" },
  ];
}

function fieldingColumns(): Array<{ key: string; label: string }> {
  return [
    { key: "g", label: "G" },
    { key: "po", label: "PO" },
    { key: "a", label: "A" },
    { key: "e", label: "E" },
    { key: "tc", label: "TC" },
    { key: "dp", label: "DP" },
    { key: "fpct", label: "FLD%" },
  ];
}

function GameLogTable({
  entries,
  mode,
}: {
  entries: WpblPlayerGameLogEntry[];
  mode: SeasonTab;
}) {
  const filtered =
    mode === "hitting"
      ? entries.filter((e) => e.batting)
      : mode === "pitching"
        ? entries.filter((e) => e.pitching)
        : entries.filter((e) => e.fielding);

  if (filtered.length === 0) {
    return <p className="px-4 py-6 text-sm wpbl-muted">No game log rows yet.</p>;
  }

  const cols =
    mode === "hitting"
      ? ["ab", "r", "h", "hr", "rbi", "bb", "so", "ops"]
      : mode === "pitching"
        ? ["ip", "h", "r", "er", "bb", "so", "whip"]
        : ["po", "a", "e"];

  return (
    <div className="wpbl-table-wrap border-0 rounded-none">
      <table>
        <thead>
          <tr>
            <th className="pl-4">Date</th>
            <th>Opp</th>
            <th>Res</th>
            {cols.map((c) => (
              <th key={c} className="text-center last:pr-4">
                {c.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const stats =
              mode === "hitting"
                ? row.batting
                : mode === "pitching"
                  ? row.pitching
                  : row.fielding;
            const score =
              row.teamRuns != null && row.opponentRuns != null
                ? `${row.teamRuns}–${row.opponentRuns}`
                : "—";
            const vs =
              row.side === "home"
                ? `vs ${row.opponentAbbr}`
                : `@ ${row.opponentAbbr}`;

            return (
              <tr key={row.gameId} className="whitespace-nowrap">
                <td className="pl-4">
                  <Link
                    href={`/wpbl/games/${row.gameId}`}
                    className={WPBL_LINK}
                  >
                    {formatGameDate(row.startIso)}
                  </Link>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <TeamLogo abbr={row.opponentAbbr} size="sm" />
                    <span className="wpbl-muted">{vs}</span>
                  </span>
                </td>
                <td className="font-mono tabular-nums wpbl-muted">
                  {row.result ? `${row.result} ${score}` : score}
                </td>
                {cols.map((c) => (
                  <td
                    key={c}
                    className="text-center font-mono tabular-nums text-[var(--wpbl-ink)] last:pr-4"
                  >
                    {stats?.[c] == null || stats[c] === ""
                      ? "—"
                      : String(stats[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function battingChips(b: WpblPlayerBattingSeason) {
  return (
    <>
      <StatChip label="AVG" value={b.avg ?? "—"} />
      <StatChip label="HR" value={String(b.hr)} />
      <StatChip label="RBI" value={String(b.rbi)} />
      <StatChip label="SB" value={String(b.sb)} />
      <StatChip label="OPS" value={b.ops ?? "—"} />
    </>
  );
}

function pitchingChips(p: WpblPlayerPitchingSeason) {
  return (
    <>
      <StatChip label="W-L" value={`${p.w}-${p.l}`} />
      <StatChip label="ERA" value={p.era ?? "—"} />
      <StatChip label="SO" value={String(p.so)} />
      <StatChip label="IP" value={p.ip} />
      <StatChip label="WHIP" value={p.whip ?? "—"} />
    </>
  );
}

export type PlayerDetailClientProps = {
  playerId: string;
  /** Redis-hot blob from the server so the page paints without a client round-trip. */
  initialData?: WpblPlayerDetailResponse | null;
};

function preferredTab(data: WpblPlayerDetailResponse): SeasonTab {
  if (data.season.batting) return "hitting";
  if (data.season.pitching) return "pitching";
  if (data.season.fielding) return "fielding";
  return "hitting";
}

export function PlayerDetailClient({
  playerId,
  initialData = null,
}: PlayerDetailClientProps) {
  const [data, setData] = useState<WpblPlayerDetailResponse | null>(initialData);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [tab, setTab] = useState<SeasonTab>(
    initialData ? preferredTab(initialData) : "hitting",
  );
  const hasDataRef = useRef(Boolean(initialData));

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/wpbl/players/${encodeURIComponent(playerId)}`, {
        cache: "no-store",
      });

      if (res.status === 404) {
        if (!hasDataRef.current) {
          setNotFound(true);
          setData(null);
          setError(null);
        }
        return;
      }

      if (!res.ok) {
        if (!hasDataRef.current) {
          let detail: string | null = null;
          try {
            const body = (await res.json()) as { error?: unknown };
            detail =
              typeof body.error === "string" && body.error.trim()
                ? body.error.trim()
                : null;
          } catch {
            detail = null;
          }
          setError(detail ?? `Player fetch failed (${res.status})`);
          setData(null);
        }
        return;
      }

      const json = (await res.json()) as WpblPlayerDetailResponse;
      setData(json);
      setNotFound(false);
      setError(null);
      setTab(preferredTab(json));
      hasDataRef.current = true;
    } catch {
      if (!hasDataRef.current) {
        setError("Player fetch failed");
        setData(null);
      }
    }
  }, [playerId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // When we already painted from Redis, revalidate quietly in the background.
      if (!initialData) {
        setLoading(true);
      }
      await load();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData, load]);

  if (loading) {
    return <WpblBoardLoading />;
  }

  if (notFound) {
    return (
      <div className="mt-8 space-y-4">
        <Link href="/wpbl" className={`text-sm ${WPBL_LINK}`}>
          ← Back to WPBL
        </Link>
        <p className="text-sm wpbl-muted">Player not found.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mt-8 space-y-4">
        <Link href="/wpbl" className={`text-sm ${WPBL_LINK}`}>
          ← Back to WPBL
        </Link>
        <WpblBoardError message={error} />
      </div>
    );
  }

  if (!data) return null;

  const { player, season, gameLog, updatedAt, partial } = data;
  const availableTabs: SeasonTab[] = [];
  if (season.batting) availableTabs.push("hitting");
  if (season.pitching) availableTabs.push("pitching");
  if (season.fielding) availableTabs.push("fielding");
  const activeTab = availableTabs.includes(tab)
    ? tab
    : (availableTabs[0] ?? "hitting");

  const bioBits = [
    player.bats && player.throws ? `B/T: ${player.bats}/${player.throws}` : null,
    player.hometown,
    player.birthdate
      ? `Born ${player.birthdate.slice(0, 4)}`
      : null,
  ].filter(Boolean);

  const metaLine = [
    player.uniform ? `#${player.uniform}` : null,
    player.position,
    player.teamAbbr,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-8 space-y-6">
      <Link href="/wpbl" className={`inline-block text-sm ${WPBL_LINK}`}>
        ← Back to WPBL
      </Link>

      <section
        className={`wpbl-team-accent ${WPBL_PANEL}`}
        style={teamAccentStyle(player.teamAbbr)}
      >
        <div className="flex flex-col gap-5 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
          <PlayerHeadshot
            name={player.name}
            headshotUrl={player.headshotUrl}
            teamAbbr={player.teamAbbr}
            size={112}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs wpbl-muted">
              <span>
                {player.teamAbbr} {player.teamName}
              </span>
              {player.status ? (
                <span className="rounded bg-[var(--wpbl-bg-hover)] px-1.5 py-0.5 uppercase tracking-wide text-[var(--wpbl-ink-secondary)]">
                  {player.status}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--wpbl-ink)] sm:text-4xl">
              {player.name}
            </h1>
            {metaLine ? (
              <p className="text-sm text-[var(--wpbl-ink-secondary)]">{metaLine}</p>
            ) : null}
            {bioBits.length > 0 ? (
              <p className="text-sm wpbl-muted">{bioBits.join(" · ")}</p>
            ) : null}
          </div>
        </div>

        {(season.batting || season.pitching) && (
          <div className="space-y-4 border-t border-[var(--wpbl-rule)] px-4 py-4 sm:px-6">
            {season.batting ? (
              <div className="flex flex-wrap gap-6">{battingChips(season.batting)}</div>
            ) : null}
            {season.pitching ? (
              <div className="flex flex-wrap gap-6">
                {pitchingChips(season.pitching)}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {availableTabs.length > 0 ? (
        <section className={WPBL_PANEL}>
          <div className="px-4 pt-3">
            <WpblDetailTabs
              ariaLabel="Season stats"
              active={activeTab}
              onChange={setTab}
              tabs={availableTabs.map((id) => ({
                id,
                label:
                  id === "hitting"
                    ? "Hitting"
                    : id === "pitching"
                      ? "Pitching"
                      : "Fielding",
              }))}
            />
          </div>

          <div className="py-1">
            {activeTab === "hitting" && season.batting ? (
              <SeasonTable
                columns={battingColumns()}
                values={season.batting as unknown as Record<string, string | number | null>}
              />
            ) : null}
            {activeTab === "pitching" && season.pitching ? (
              <SeasonTable
                columns={pitchingColumns()}
                values={
                  season.pitching as unknown as Record<string, string | number | null>
                }
              />
            ) : null}
            {activeTab === "fielding" && season.fielding ? (
              <SeasonTable
                columns={fieldingColumns()}
                values={
                  season.fielding as unknown as Record<
                    string,
                    string | number | null
                  >
                }
              />
            ) : null}
          </div>

          <div className="border-t border-[var(--wpbl-rule)]">
            <h2 className="wpbl-section-label px-4 pt-4">Game log</h2>
            <GameLogTable entries={gameLog} mode={activeTab} />
          </div>
        </section>
      ) : (
        <p className="text-sm wpbl-muted">No season stats yet.</p>
      )}

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs wpbl-muted">
        <span>Updated {formatUpdatedAt(updatedAt)}</span>
        {season.sourceThrough ? (
          <span>· Through {formatUpdatedAt(season.sourceThrough)}</span>
        ) : null}
        {partial ? <span>· Partial data</span> : null}
        {player.profileUrl ? (
          <a
            href={player.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--wpbl-accent)] hover:underline"
          >
            Official profile
          </a>
        ) : null}
      </footer>
    </div>
  );
}
