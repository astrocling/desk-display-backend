"use client";

import { useEffect } from "react";
import { feedsForIcao, isCatalogIcao } from "@/lib/atc/feeds";
import type { AtcRadio } from "./useAtcRadio";
import type { CommsPresets } from "./useCommsPresets";

/** Rail indicator label: drop the leading "K" so it fits the narrow strip. */
function railLabel(icao: string): string {
  return icao.length > 3 ? icao.slice(1) : icao;
}

export function CommsPanel({
  focusedIcao,
  radio,
  presets,
  onSelectAirport,
}: {
  focusedIcao: string | null;
  radio: AtcRadio;
  presets: CommsPresets;
  onSelectAirport: (icao: string) => void;
}) {
  const { entries, expanded, setExpanded, togglePin } = presets;

  // Idle auto-select: only when the focused airport is already on the rack.
  // Map focus alone must never grow the rack, expand the panel, or start audio.
  useEffect(() => {
    if (radio.status === "playing" || radio.status === "loading") return;

    const focused = focusedIcao?.trim().toUpperCase() ?? null;
    if (!focused || !isCatalogIcao(focused)) return;
    if (!entries.some((entry) => entry.icao === focused)) return;
    if (radio.activeIcao === focused && radio.activeFeedId != null) return;

    radio.selectAirport(focused);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- track primitive radio fields, not the object identity
  }, [
    focusedIcao,
    entries,
    radio.activeIcao,
    radio.activeFeedId,
    radio.status,
    radio.selectAirport,
  ]);

  const isPlaying = radio.status === "playing" || radio.status === "loading";

  const handleTogglePlay = () => {
    if (!radio.activeFeedId && entries.length > 0) {
      const focused = focusedIcao?.trim().toUpperCase() ?? null;
      const preferred =
        focused && entries.some((entry) => entry.icao === focused)
          ? focused
          : entries[0]!.icao;
      radio.selectAirport(preferred);
    }
    void radio.toggle();
  };

  if (!expanded) {
    return (
      <div
        className="pointer-events-auto flex w-9 flex-col items-center gap-2 rounded-r-lg bg-[#0B0F14]/90 py-2 ring-1 ring-[#3D9CF0]/40 backdrop-blur sm:w-10"
        title="ATC communications"
      >
        <button
          type="button"
          aria-label="Expand comms"
          onClick={() => setExpanded(true)}
          className="flex h-7 w-7 items-center justify-center rounded text-[#3D9CF0] hover:bg-[#3D9CF0]/10"
        >
          <span
            className={`block h-2 w-2 rounded-full ${
              isPlaying ? "bg-[#3D9CF0]" : "bg-[#6B7280]"
            }`}
          />
        </button>

        {entries.length > 0 ? (
          <ul className="flex flex-col items-center gap-1.5">
            {entries.map((entry) => {
              const isActive = radio.activeIcao === entry.icao;
              return (
                <li key={entry.icao}>
                  <button
                    type="button"
                    title={entry.icao}
                    onClick={() => {
                      radio.selectAirport(entry.icao);
                      onSelectAirport(entry.icao);
                      setExpanded(true);
                    }}
                    className={`flex flex-col items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[9px] leading-none ${
                      isActive
                        ? "text-[#3D9CF0]"
                        : entry.pinned
                          ? "text-[#C8D0D8]"
                          : "text-[#6B7280]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive
                          ? "bg-[#3D9CF0]"
                          : entry.pinned
                            ? "bg-[#C8D0D8]"
                            : "bg-[#6B7280]"
                      }`}
                    />
                    <span>{railLabel(entry.icao)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  const activeFeeds = radio.activeIcao ? feedsForIcao(radio.activeIcao) : [];
  const canPlay = radio.activeFeedId != null || entries.length > 0;
  const playLabel =
    radio.status === "loading" ? "…" : isPlaying ? "Stop" : "Play";

  return (
    <div
      className="pointer-events-auto max-w-xs rounded-lg bg-[#0B0F14]/90 px-3 py-2.5 text-sm shadow-lg ring-1 ring-[#3D9CF0]/40 backdrop-blur"
      title="ATC communications"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold tracking-wide text-white">Comms</div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canPlay && !isPlaying}
            onClick={handleTogglePlay}
            className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={isPlaying ? "Stop ATC radio" : "Play ATC radio"}
          >
            {playLabel}
          </button>
          <button
            type="button"
            aria-label="Collapse comms"
            onClick={() => setExpanded(false)}
            className="rounded px-1.5 py-1 text-xs text-[#6B7280] hover:bg-slate-800/80 hover:text-[#C8D0D8]"
          >
            ‹
          </button>
        </div>
      </div>

      {radio.activeIcao ? (
        <div className="mt-1.5 font-mono text-[11px] text-[#C8D0D8]">
          {radio.activeIcao}
          {activeFeeds.length === 1 ? (
            <span className="ml-1.5 font-sans text-[#6B7280]">
              {activeFeeds[0]!.label}
            </span>
          ) : null}
        </div>
      ) : null}

      {radio.error ? (
        <div className="mt-1.5 text-[11px] text-red-400">{radio.error}</div>
      ) : null}

      {entries.length === 0 ? (
        <div className="mt-2 text-[11px] text-[#6B7280]">
          Listen from an airport card or pin a preset.
        </div>
      ) : (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto border-t border-[#3D9CF0]/20 pt-1.5">
          {entries.map((entry) => {
            const isActive = radio.activeIcao === entry.icao;
            const isFocused = focusedIcao?.toUpperCase() === entry.icao;
            return (
              <li key={entry.icao}>
                <div
                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-800/80 ${
                    isActive ? "bg-slate-800/90" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-label={
                      entry.pinned ? `Unpin ${entry.icao}` : `Pin ${entry.icao}`
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(entry.icao);
                    }}
                    className={`shrink-0 text-xs leading-none ${
                      entry.pinned ? "text-[#3D9CF0]" : "text-[#6B7280]"
                    }`}
                  >
                    {entry.pinned ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      radio.selectAirport(entry.icao);
                      onSelectAirport(entry.icao);
                    }}
                    className={`flex-1 truncate text-left font-mono text-[11px] font-semibold tracking-wide ${
                      isActive
                        ? "text-[#3D9CF0]"
                        : isFocused
                          ? "text-[#C8D0D8]"
                          : "text-[#C8D0D8]/80"
                    }`}
                  >
                    {entry.icao}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {activeFeeds.length > 1 ? (
        <div className="mt-2 border-t border-[#3D9CF0]/20 pt-1.5">
          <label className="flex items-center gap-2 text-[11px] text-[#6B7280]">
            <span className="shrink-0">Feed</span>
            <select
              value={radio.activeFeedId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) radio.selectFeed(id);
              }}
              className="min-w-0 flex-1 rounded bg-slate-800/80 px-1.5 py-1 font-mono text-[11px] text-[#C8D0D8] outline-none ring-1 ring-[#3D9CF0]/20 focus:ring-[#3D9CF0]/50"
              aria-label="ATC feed"
            >
              {activeFeeds.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {radio.status === "playing" || radio.status === "loading" ? (
        <div className="mt-2 space-y-1 border-t border-[#3D9CF0]/20 pt-1.5">
          <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">
            {radio.status === "loading"
              ? "Connecting…"
              : "Listening via LiveATC"}
          </div>
          {radio.listenUrl ? (
            <a
              href={radio.listenUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-sky-400 underline"
            >
              Open on LiveATC
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
