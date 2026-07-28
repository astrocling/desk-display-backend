"use client";

import { isCatalogIcao } from "@/lib/atc/feeds";
import type { AtcRadio } from "./useAtcRadio";

/**
 * Compact Listen/Stop control for airport card reuse.
 * Renders nothing when the ICAO is not in the ATC catalog.
 */
export function AtcListenButton({
  icao,
  radio,
}: {
  icao: string;
  radio: AtcRadio;
}) {
  const upper = icao.trim().toUpperCase();
  if (!isCatalogIcao(upper)) return null;

  const isActive = radio.activeIcao === upper;
  const isPlaying =
    isActive &&
    (radio.status === "playing" || radio.status === "loading");
  const label =
    radio.status === "loading" && isActive
      ? "…"
      : isPlaying
        ? "Stop"
        : "Listen";

  return (
    <button
      type="button"
      onClick={() => {
        if (!isActive) {
          radio.selectAirport(upper);
          // selectAirport stops any prior stream and sets the default feed;
          // always start (do not toggle-stop) after switching airports.
          void radio.play();
          return;
        }
        void radio.toggle();
      }}
      className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
      aria-label={isPlaying ? `Stop ATC for ${upper}` : `Listen to ATC for ${upper}`}
      title={radio.error && isActive ? radio.error : undefined}
    >
      {label}
    </button>
  );
}
