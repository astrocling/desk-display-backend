"use client";

import { useEffect } from "react";
import {
  feedsForIcao,
  isCatalogIcao,
} from "@/lib/atc/feeds";
import type { AtcRadio } from "./useAtcRadio";

type AirportOnScreen = {
  icao: string;
  name?: string;
};

function pickDefaultIcao(
  visible: AirportOnScreen[],
  focusedIcao: string | null,
): string | null {
  if (visible.length === 0) return null;
  const focused = focusedIcao?.trim().toUpperCase() ?? null;
  if (focused && visible.some((a) => a.icao.trim().toUpperCase() === focused)) {
    return focused;
  }
  return visible[0].icao.trim().toUpperCase();
}

export function CommsPanel({
  airportsOnScreen,
  focusedIcao,
  radio,
  onSelectAirport,
}: {
  airportsOnScreen: AirportOnScreen[];
  focusedIcao: string | null;
  radio: AtcRadio;
  onSelectAirport: (icao: string) => void;
}) {
  const visible = airportsOnScreen.filter((a) =>
    isCatalogIcao(a.icao.trim().toUpperCase()),
  );

  const visibleKey = visible
    .map((a) => a.icao.trim().toUpperCase())
    .sort()
    .join(",");

  // Ensure a feed is selected whenever catalog airports are in view so Play works.
  // Also select when the map focuses a catalog airport (airport card) even before overlays refresh.
  useEffect(() => {
    if (radio.status === "playing" || radio.status === "loading") return;

    const focused = focusedIcao?.trim().toUpperCase() ?? null;
    if (focused && isCatalogIcao(focused)) {
      if (radio.activeIcao !== focused || radio.activeFeedId == null) {
        radio.selectAirport(focused);
      }
      return;
    }

    const preferred = pickDefaultIcao(visible, focusedIcao);
    if (!preferred) return;

    if (radio.activeIcao === preferred && radio.activeFeedId != null) return;

    if (
      radio.activeIcao &&
      visible.some((a) => a.icao.trim().toUpperCase() === radio.activeIcao)
    ) {
      return;
    }

    radio.selectAirport(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visible via visibleKey
  }, [
    visibleKey,
    focusedIcao,
    radio.activeIcao,
    radio.activeFeedId,
    radio.status,
    radio.selectAirport,
  ]);

  const activeFeeds = radio.activeIcao
    ? feedsForIcao(radio.activeIcao)
    : [];
  const isPlaying =
    radio.status === "playing" || radio.status === "loading";
  const canPlay = radio.activeFeedId != null || visible.length > 0;

  const playLabel =
    radio.status === "loading"
      ? "…"
      : isPlaying
        ? "Stop"
        : "Play";

  return (
    <div
      className="pointer-events-auto max-w-xs rounded-lg bg-[#0B0F14]/90 px-3 py-2.5 text-sm shadow-lg backdrop-blur ring-1 ring-[#3D9CF0]/40"
      title="ATC communications"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold tracking-wide text-white">Comms</div>
        <button
          type="button"
          disabled={!canPlay && !isPlaying}
          onClick={() => {
            if (!radio.activeFeedId) {
              const preferred = pickDefaultIcao(visible, focusedIcao);
              if (preferred) radio.selectAirport(preferred);
            }
            void radio.toggle();
          }}
          className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={isPlaying ? "Stop ATC radio" : "Play ATC radio"}
        >
          {playLabel}
        </button>
      </div>

      {radio.error ? (
        <div className="mt-1.5 text-[11px] text-red-400">{radio.error}</div>
      ) : null}

      {visible.length === 0 ? (
        <div className="mt-2 text-[11px] text-[#6B7280]">
          No ATC feeds in view
        </div>
      ) : (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto border-t border-[#3D9CF0]/20 pt-1.5">
          {visible.map((airport) => {
            const icao = airport.icao.trim().toUpperCase();
            const isActive = radio.activeIcao === icao;
            const isFocused = focusedIcao?.toUpperCase() === icao;
            return (
              <li key={icao}>
                <button
                  type="button"
                  onClick={() => {
                    radio.selectAirport(icao);
                    onSelectAirport(icao);
                  }}
                  className={`flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left font-mono text-[11px] hover:bg-slate-800/80 ${
                    isActive
                      ? "bg-slate-800/90 text-[#3D9CF0]"
                      : isFocused
                        ? "text-[#C8D0D8]"
                        : "text-[#C8D0D8]/80"
                  }`}
                >
                  <span className="font-semibold tracking-wide">{icao}</span>
                  {airport.name ? (
                    <span className="truncate font-sans text-[#6B7280]">
                      {airport.name}
                    </span>
                  ) : null}
                </button>
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
      ) : activeFeeds.length === 1 ? (
        <div className="mt-1.5 text-[11px] text-[#6B7280]">
          {activeFeeds[0].label}
        </div>
      ) : null}

      {radio.status === "playing" || radio.status === "loading" ? (
        <div className="mt-2 border-t border-[#3D9CF0]/20 pt-1.5 space-y-1">
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
