"use client";

import {
  formatAirportFreqLine,
  formatAirportRunwayLabel,
  formatAirportSubtitle,
  formatAirportTafLine,
  formatAirportTrafficSummary,
  formatAirportWeatherRows,
} from "./airportCardFormat";
import type { AirportDetailResponse } from "./types";

type AirportTrafficAircraft = { callsign: string; hex: string };

type AirportTraffic = {
  inbound: AirportTrafficAircraft[];
  outbound: AirportTrafficAircraft[];
  radiusNm: number;
} | null;

const MAX_TRAFFIC_CHIPS = 6;

/** Presentational airport selection panel — parallel to SelectionAircraftCard. */
export function SelectionAirportCard({
  detail,
  groundMode,
  onClose,
  onEnterGround,
  onExitGround,
  traffic = null,
  onSelectTrafficHex,
}: {
  detail: AirportDetailResponse;
  groundMode: boolean;
  onClose: () => void;
  onEnterGround: () => void;
  onExitGround: () => void;
  traffic?: AirportTraffic;
  onSelectTrafficHex?: (hex: string) => void;
}) {
  const subtitle = formatAirportSubtitle({
    municipality: detail.municipality,
    elevFt: detail.elevFt,
  });
  const weather = formatAirportWeatherRows(detail.metar);
  const hasWeather = weather.row1.length > 0 || weather.row2.length > 0;
  const tafLine = formatAirportTafLine(detail.taf);
  const freqLine = formatAirportFreqLine(detail.frequencies);
  const trafficSummary = traffic
    ? formatAirportTrafficSummary({
        inbound: traffic.inbound.length,
        outbound: traffic.outbound.length,
      })
    : null;
  const trafficChips = traffic ? [...traffic.inbound, ...traffic.outbound] : [];
  const showTrafficChips =
    trafficSummary != null && trafficChips.length <= MAX_TRAFFIC_CHIPS;

  return (
    <div className="pointer-events-auto max-w-sm rounded-lg bg-[#0B0F14]/90 px-3 py-2.5 text-sm shadow-lg backdrop-blur ring-1 ring-[#3D9CF0]/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold tracking-wide text-white">
            {detail.icao}
            {detail.iata ? (
              <span className="ml-1.5 font-normal text-[#6B7280]">
                {detail.iata}
              </span>
            ) : null}
            {detail.name ? (
              <span className="ml-2 font-normal text-[#C8D0D8]">
                {detail.name}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-[#6B7280]">{subtitle}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-200"
          aria-label="Close airport detail"
        >
          Close
        </button>
      </div>

      {hasWeather ? (
        <div className="mt-2.5 space-y-1 font-mono text-xs text-[#3D9CF0]">
          {weather.row1.length > 0 ? (
            <div className="flex flex-wrap gap-x-2">
              {weather.row1.map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
          ) : null}
          {weather.row2.length > 0 ? (
            <div className="flex flex-wrap gap-x-2">
              {weather.row2.map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
          ) : null}
          {weather.raw ? (
            <div className="truncate text-[11px] text-[#6B7280]">
              {weather.raw}
            </div>
          ) : null}
        </div>
      ) : null}

      {tafLine ? (
        <div className="mt-2 text-[11px] text-[#C8D0D8]">
          <span className="text-[#6B7280]">TAF </span>
          {tafLine}
        </div>
      ) : null}

      {detail.runways.length > 0 ? (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto border-t border-[#3D9CF0]/20 pt-1.5 font-mono text-[11px] text-[#C8D0D8]">
          {detail.runways.map((rwy) => (
            <li key={`${rwy.leIdent}-${rwy.heIdent}`}>
              {formatAirportRunwayLabel(rwy)}
            </li>
          ))}
        </ul>
      ) : null}

      {freqLine ? (
        <div className="mt-1.5 border-t border-[#3D9CF0]/20 pt-1.5 font-mono text-[11px] text-[#C8D0D8]">
          {freqLine}
        </div>
      ) : null}

      {trafficSummary ? (
        <div className="mt-1.5 border-t border-[#3D9CF0]/20 pt-1.5">
          <div className="font-mono text-[11px] text-[#C8D0D8]">
            {trafficSummary}
            {traffic ? (
              <span className="ml-1.5 text-[#6B7280]">
                within {traffic.radiusNm} nm
              </span>
            ) : null}
          </div>
          {showTrafficChips ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {trafficChips.map((ac) => (
                <button
                  key={ac.hex}
                  type="button"
                  onClick={() => onSelectTrafficHex?.(ac.hex)}
                  disabled={!onSelectTrafficHex}
                  className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-[#C8D0D8] hover:bg-slate-700 disabled:cursor-default disabled:hover:bg-slate-800/80"
                >
                  {ac.callsign}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2 border-t border-[#3D9CF0]/20 pt-2">
        <button
          type="button"
          onClick={onEnterGround}
          className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600"
        >
          Ground view
        </button>
        {groundMode ? (
          <button
            type="button"
            onClick={onExitGround}
            className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            Zoom out
          </button>
        ) : null}
        {groundMode ? (
          <span className="font-mono text-[11px] text-[#3D6B3D]">
            GROUND MODE
          </span>
        ) : null}
      </div>
    </div>
  );
}
