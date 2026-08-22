"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  WpblPlayerBattingSeason,
  WpblPlayerDetailResponse,
  WpblPlayerGameLogEntry,
  WpblPlayerPitchingSeason,
} from "@/lib/types/wpbl-display";
import { wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";
import { WPBL_LINK, WPBL_PANEL } from "@/lib/wpbl-board";

import { teamAccentStyle } from "./teamAccent";
import { TeamLogo } from "./TeamLogo";
import { WpblBoardError, WpblBoardLoading } from "./WpblBoardShell";

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

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[4.5rem]">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums tracking-tight text-[var(--wpbl-ink)]">
        {value}
      </div>
    </div>
  );
}

function PlayerHeadshot({
  name,
  url,
  teamAbbr,
}: {
  name: string;
  url: string | null;
  teamAbbr: string;
}) {
  const [failed, setFailed] = useState(false);
  const logoSrc = wpblTeamLogoSrc(teamAbbr);
  const showPhoto = Boolean(url) && !failed;

  return (
    <span className="relative inline-flex h-24 w-24 shrink-0 sm:h-28 sm:w-28">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote WPBL CDN URLs
        <img
          src={url!}
          alt=""
          width={112}
          height={112}
          decoding="async"
          className="h-full w-full rounded-full object-cover object-top bg-neutral-700"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-neutral-700 text-2xl font-semibold text-neutral-200"
          aria-hidden
        >
          {initials(name)}
        </span>
      )}
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- local team marks
        <img
          src={logoSrc}
          alt=""
          width={28}
          height={28}
          decoding="async"
          className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-full bg-white object-contain p-0.5 shadow-sm"
        />
      ) : null}
    </span>
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
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-2 py-2 font-medium first:pl-4 last:pr-4">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-white/10">
            {columns.map((col) => {
              const v = values[col.key];
              return (
                <td
                  key={col.key}
                  className="px-2 py-3 font-mono tabular-nums text-white first:pl-4 last:pr-4"
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
    return (
      <p className="px-4 py-6 text-sm text-neutral-500">No game log rows yet.</p>
    );
  }

  const cols =
    mode === "hitting"
      ? ["ab", "r", "h", "hr", "rbi", "bb", "so", "ops"]
      : mode === "pitching"
        ? ["ip", "h", "r", "er", "bb", "so", "whip"]
        : ["po", "a", "e"];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-2 py-2 font-medium">Opp</th>
            <th className="px-2 py-2 font-medium">Res</th>
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 text-center font-medium">
                {c.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
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
              row.side === "home" ? `vs ${row.opponentAbbr}` : `@ ${row.opponentAbbr}`;

            return (
              <tr key={row.gameId} className="whitespace-nowrap text-white">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/wpbl/games/${row.gameId}`}
                    className="text-[var(--wpbl-accent)] hover:underline"
                  >
                    {formatGameDate(row.startIso)}
                  </Link>
                </td>
                <td className="px-2 py-2.5 text-neutral-300">{vs}</td>
                <td className="px-2 py-2.5 font-mono tabular-nums text-neutral-300">
                  {row.result ? `${row.result} ${score}` : score}
                </td>
                {cols.map((c) => (
                  <td
                    key={c}
                    className="px-2 py-2.5 text-center font-mono tabular-nums"
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
            url={player.headshotUrl}
            teamAbbr={player.teamAbbr}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <TeamLogo abbr={player.teamAbbr} size="sm" />
              <span>
                {player.teamAbbr} {player.teamName}
              </span>
              {player.status ? (
                <span className="rounded bg-white/10 px-1.5 py-0.5 uppercase tracking-wide">
                  {player.status}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {player.name}
            </h1>
            {metaLine ? (
              <p className="text-sm text-neutral-400">{metaLine}</p>
            ) : null}
            {bioBits.length > 0 ? (
              <p className="text-sm text-neutral-500">{bioBits.join(" · ")}</p>
            ) : null}
          </div>
        </div>

        {(season.batting || season.pitching) && (
          <div className="space-y-4 border-t border-white/10 px-4 py-4 sm:px-6">
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
        <section className="overflow-hidden rounded-xl border border-neutral-800 bg-black text-white shadow-sm">
          <div className="flex gap-6 border-b border-white/10 px-4 pt-3">
            {availableTabs.map((id) => {
              const label =
                id === "hitting"
                  ? "Hitting"
                  : id === "pitching"
                    ? "Pitching"
                    : "Fielding";
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                    selected
                      ? "text-[var(--wpbl-accent)]"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                  {selected ? (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--wpbl-accent)]" />
                  ) : null}
                </button>
              );
            })}
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

          <div className="border-t border-white/10">
            <h2 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Game log
            </h2>
            <GameLogTable entries={gameLog} mode={activeTab} />
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-500">No season stats yet.</p>
      )}

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
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
