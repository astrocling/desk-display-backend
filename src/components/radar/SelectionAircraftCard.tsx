"use client";

import {
  formatSelectionCities,
  formatSelectionFooterLeft,
  formatSelectionRoute,
  formatSelectionTelemetryRow1,
  formatSelectionTelemetryRow2,
} from "./selectionCardFormat";
import type { AircraftFeatureProps } from "./types";

/** Layout C selection panel — denser than blip tags; free data only. */
export function SelectionAircraftCard({
  selected,
}: {
  selected: AircraftFeatureProps;
}) {
  const route = formatSelectionRoute(selected.routeIcaos);
  const cities = formatSelectionCities(
    selected.routeIcaos,
    selected.routeLocations,
  );
  const row1 = formatSelectionTelemetryRow1({
    altFt: selected.altFt,
    speedKt: selected.speedKt,
    baroRateFpm: selected.baroRateFpm,
    trackDeg: selected.trackDeg,
    onGround: selected.onGround,
  });
  const row2 = formatSelectionTelemetryRow2({
    type: selected.type,
    squawk: selected.squawk,
    baroRateFpm: selected.baroRateFpm,
    onGround: selected.onGround,
  });
  const footerLeft = formatSelectionFooterLeft({
    airlineCode: selected.airlineCode,
    type: selected.type,
  });
  const hex = selected.hex?.trim().toUpperCase() ?? "";

  return (
    <div className="pointer-events-auto max-w-sm rounded-lg bg-[#0B0F14]/90 px-3 py-2.5 text-sm shadow-lg backdrop-blur ring-1 ring-[#3D9CF0]/40">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold tracking-wide text-white">
          {selected.callsign}
        </div>
        {selected.registration ? (
          <div className="font-mono text-[11px] text-[#6B7280]">
            {selected.registration}
          </div>
        ) : null}
      </div>
      {route ? (
        <div className="mt-2 font-mono text-xs text-[#C8D0D8]">{route}</div>
      ) : null}
      {cities ? (
        <div className="mt-0.5 text-[11px] text-[#6B7280]">{cities}</div>
      ) : null}
      {row1.length > 0 ? (
        <div className="mt-2.5 flex justify-between gap-2 font-mono text-xs text-[#3D9CF0]">
          {row1.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      ) : null}
      {row2.length > 0 ? (
        <div className="mt-1.5 flex justify-between gap-2 font-mono text-xs text-[#3D9CF0]">
          {row2.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      ) : null}
      {footerLeft || hex ? (
        <div className="mt-2.5 flex justify-between gap-2 border-t border-[#3D9CF0]/20 pt-2 font-mono text-[11px] text-[#6B7280]">
          <span>{footerLeft ?? ""}</span>
          <span>{hex}</span>
        </div>
      ) : null}
    </div>
  );
}
