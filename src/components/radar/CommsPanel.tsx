"use client";

import { useEffect, useState } from "react";
import { feedsForIcao, isCatalogIcao } from "@/lib/atc/feeds";
import { resolvedFeedIdForIcao } from "./commsPresets";
import { decideCommsTune } from "./commsTune";
import type { AtcRadio } from "./useAtcRadio";
import type { CommsPresets } from "./useCommsPresets";

/** Rail indicator label: drop the leading "K" (US ICAO) so it fits the narrow strip. */
function railLabel(icao: string): string {
  return icao.startsWith("K") && icao.length > 3 ? icao.slice(1) : icao;
}

export function CommsPanel({
  focusedIcao,
  radio,
  presets,
}: {
  focusedIcao: string | null;
  radio: AtcRadio;
  presets: CommsPresets;
}) {
  const { entries, expanded, setExpanded, togglePin } = presets;
  const [managingPresets, setManagingPresets] = useState(false);

  const handleTune = (icao: string) => {
    const action = decideCommsTune({
      targetIcao: icao,
      activeIcao: radio.activeIcao,
      status: radio.status,
      lastFeedByIcao: presets.lastFeedByIcao,
    });
    if (!action) return;
    if (action.type === "stop") {
      radio.stop();
      return;
    }
    presets.rememberFeed(action.icao, action.feedId);
    radio.selectAirport(action.icao, action.feedId);
    void radio.play();
  };

  const handleFeedChip = (feedId: string) => {
    const wasLive =
      radio.status === "playing" || radio.status === "loading";
    if (radio.activeIcao) {
      presets.rememberFeed(radio.activeIcao, feedId);
    }
    radio.selectFeed(feedId);
    if (wasLive) void radio.play();
  };

  // Idle auto-select: only when the focused airport is already on the rack.
  // Map focus alone must never grow the rack, expand the panel, or start audio.
  useEffect(() => {
    if (radio.status === "playing" || radio.status === "loading") return;

    const focused = focusedIcao?.trim().toUpperCase() ?? null;
    if (!focused || !isCatalogIcao(focused)) return;
    if (!entries.some((entry) => entry.icao === focused)) return;
    if (radio.activeIcao === focused && radio.activeFeedId != null) return;

    const feedId = resolvedFeedIdForIcao(focused, presets.lastFeedByIcao);
    radio.selectAirport(focused, feedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- track primitive radio fields, not the object identity
  }, [
    focusedIcao,
    entries,
    radio.activeIcao,
    radio.activeFeedId,
    radio.status,
    radio.selectAirport,
    presets.lastFeedByIcao,
  ]);

  const isPlaying = radio.status === "playing" || radio.status === "loading";

  const handleTogglePlay = () => {
    if (!radio.activeFeedId && entries.length > 0) {
      const focused = focusedIcao?.trim().toUpperCase() ?? null;
      const preferred =
        focused && entries.some((entry) => entry.icao === focused)
          ? focused
          : entries[0]!.icao;
      const feedId = resolvedFeedIdForIcao(preferred, presets.lastFeedByIcao);
      radio.selectAirport(preferred, feedId);
    }
    void radio.toggle();
  };

  const handleCollapse = () => {
    setManagingPresets(false);
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <div
        className="pointer-events-auto flex w-12 flex-col items-center gap-1.5 rounded-r-lg border border-l-0 border-[#3D9CF0]/25 bg-gradient-to-b from-[#11161C]/95 to-[#0B0F14]/90 py-2 shadow-lg backdrop-blur"
        title="ATC communications"
      >
        <button
          type="button"
          aria-label="Expand comms"
          onClick={() => setExpanded(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-[#3D9CF0]/30 hover:bg-[#3D9CF0]/10"
        >
          <span
            className={`block h-2.5 w-2.5 rounded-full ${
              isPlaying
                ? "bg-[#3D9CF0] shadow-[0_0_6px_2px_rgba(61,156,240,0.7)]"
                : "bg-[#3A4552]"
            }`}
          />
        </button>

        {entries.length > 0 ? (
          <ul className="flex flex-col items-center gap-1">
            {entries.map((entry) => {
              const isActive = radio.activeIcao === entry.icao;
              return (
                <li key={entry.icao}>
                  <button
                    type="button"
                    title={entry.icao}
                    onClick={() => handleTune(entry.icao)}
                    className={`flex h-8 w-8 items-center justify-center rounded border font-mono text-[9px] font-bold leading-none transition-colors ${
                      isActive
                        ? "border-[#3D9CF0] bg-[#3D9CF0]/15 text-[#3D9CF0]"
                        : entry.pinned
                          ? "border-[#3D9CF0]/25 text-[#C8D0D8] hover:border-[#3D9CF0]/40"
                          : "border-[#2A3138] text-[#6B7280] hover:border-[#3D9CF0]/25"
                    }`}
                  >
                    {railLabel(entry.icao)}
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
  const activeFeedLabel =
    activeFeeds.find((f) => f.id === radio.activeFeedId)?.label ?? null;
  const transportLabel =
    radio.status === "loading"
      ? "Connecting"
      : isPlaying
        ? "Stop"
        : "Play";
  const transportSubtitle = radio.activeIcao
    ? activeFeedLabel
      ? `${radio.activeIcao} · ${activeFeedLabel}`
      : radio.activeIcao
    : "Select a station";
  const lcdStatus =
    radio.status === "loading"
      ? "Connecting…"
      : isPlaying
        ? "RX · LIVE"
        : "IDLE";

  return (
    <div
      className="pointer-events-auto w-60 rounded-lg border border-[#3D9CF0]/25 bg-gradient-to-b from-[#11161C]/95 to-[#0B0F14]/95 p-2.5 text-sm shadow-lg ring-1 ring-[#3D9CF0]/40 backdrop-blur"
      title="ATC communications"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-[0.2em] text-[#6B7280]">
          COMMS
        </div>
        <button
          type="button"
          aria-label="Collapse comms"
          onClick={handleCollapse}
          className="rounded px-1.5 py-0.5 text-xs text-[#6B7280] hover:bg-[#3D9CF0]/10 hover:text-[#C8D0D8]"
        >
          ‹
        </button>
      </div>

      {/* LCD */}
      <div className="mt-1.5 rounded border border-[#3D9CF0]/20 bg-black/40 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`flex items-center gap-1.5 text-[10px] font-semibold tracking-wide ${
              isPlaying ? "text-[#3D9CF0]" : "text-[#6B7280]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isPlaying
                  ? "bg-[#3D9CF0] shadow-[0_0_5px_1px_rgba(61,156,240,0.8)]"
                  : "bg-[#3A4552]"
              }`}
            />
            {lcdStatus}
          </span>
          {radio.activeIcao ? (
            <span className="font-mono text-xs font-bold text-[#C8D0D8]">
              {radio.activeIcao}
            </span>
          ) : (
            <span className="text-[10px] text-[#6B7280]">no signal</span>
          )}
        </div>
        {activeFeeds.length === 1 ? (
          <div className="mt-0.5 truncate text-[10px] text-[#6B7280]">
            {activeFeeds[0]!.label}
          </div>
        ) : null}
        {activeFeeds.length > 1 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {activeFeeds.map((feed) => {
              const isActiveFeed = radio.activeFeedId === feed.id;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => handleFeedChip(feed.id)}
                  aria-pressed={isActiveFeed}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    isActiveFeed
                      ? "bg-[#3D9CF0]/20 text-[#3D9CF0]"
                      : "bg-white/5 text-[#C8D0D8]/80 hover:bg-white/10"
                  }`}
                >
                  {feed.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {radio.error ? (
        <div className="mt-1.5 text-[11px] text-red-400">{radio.error}</div>
      ) : null}

      {/* Transport bar — status words live here / on LCD, never inside a fixed circle alone */}
      {isPlaying || canPlay ? (
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={isPlaying ? "Stop ATC radio" : "Play ATC radio"}
          className={`mt-2 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
            isPlaying
              ? "border-[#3D9CF0]/50 bg-[#3D9CF0]/10"
              : "border-[#2A3138] hover:border-[#3D9CF0]/40"
          }`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
              isPlaying
                ? "border-[#3D9CF0] text-[#3D9CF0]"
                : "border-[#3D9CF0]/40 text-[#C8D0D8]"
            }`}
          >
            {radio.status === "loading" ? "…" : isPlaying ? "■" : "▶"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-[#E8F4FF]">
              {transportLabel}
            </span>
            <span className="block truncate text-[10px] text-[#6B7280]">
              {transportSubtitle}
            </span>
          </span>
        </button>
      ) : null}

      {entries.length === 0 ? (
        <div className="mt-2 text-[11px] text-[#6B7280]">
          Listen from an airport card or pin a preset.
        </div>
      ) : managingPresets ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <li
              key={entry.icao}
              className="flex items-center gap-2 rounded border border-[#2A3138] bg-black/20 px-2 py-1.5"
            >
              <span className="flex-1 font-mono text-[11px] font-semibold tracking-wide text-[#C8D0D8]">
                {entry.icao}
              </span>
              <button
                type="button"
                aria-label={
                  entry.pinned ? `Unpin ${entry.icao}` : `Pin ${entry.icao}`
                }
                onClick={() => togglePin(entry.icao)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-base leading-none ${
                  entry.pinned
                    ? "text-[#3D9CF0]"
                    : "text-[#6B7280] hover:text-[#C8D0D8]"
                }`}
              >
                {entry.pinned ? "★" : "☆"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-1.5">
          {entries.map((entry) => {
            const isActive = radio.activeIcao === entry.icao;
            const isFocused = focusedIcao?.toUpperCase() === entry.icao;
            const isLiveActive = isActive && isPlaying;
            return (
              <li key={entry.icao}>
                <button
                  type="button"
                  onClick={() => handleTune(entry.icao)}
                  aria-label={`Tune ${entry.icao}`}
                  className={`flex h-9 w-full items-center justify-center rounded border font-mono text-[11px] font-bold tracking-wide transition-colors ${
                    isLiveActive
                      ? "border-[#3D9CF0] bg-[#3D9CF0]/15 text-[#3D9CF0]"
                      : isFocused
                        ? "border-[#3D9CF0]/40 text-[#C8D0D8] hover:border-[#3D9CF0]/60"
                        : "border-[#2A3138] text-[#C8D0D8]/80 hover:border-[#3D9CF0]/30"
                  }`}
                >
                  {railLabel(entry.icao)}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() =>
          setManagingPresets((prev) => !prev)
        }
        className="mt-2 w-full rounded py-1.5 text-center text-[11px] text-[#6B7280] hover:bg-[#3D9CF0]/10 hover:text-[#C8D0D8]"
      >
        {managingPresets ? "Done" : "Presets"}
      </button>

      {isPlaying && radio.listenUrl ? (
        <div className="mt-2 border-t border-[#3D9CF0]/20 pt-1.5">
          <a
            href={radio.listenUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-sky-400 underline"
          >
            Open on LiveATC
          </a>
        </div>
      ) : null}
    </div>
  );
}
