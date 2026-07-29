"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AirportPreset } from "./airportLayers";

export type LayersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  airportPreset: AirportPreset;
  onAirportPresetChange: (p: AirportPreset) => void;
  pinned: string[];
  onAddPin: (raw: string) => Promise<"ok" | "not_found" | "duplicate">;
  onRemovePin: (code: string) => void;
  pinError: string | null;
  showClassAirspace: boolean;
  onShowClassAirspaceChange: (v: boolean) => void;
  showArtcc: boolean;
  onShowArtccChange: (v: boolean) => void;
  showAppDep: boolean;
  onShowAppDepChange: (v: boolean) => void;
  showTfrs: boolean;
  onShowTfrsChange: (v: boolean) => void;
  tfrCount: number;
  showHighways: boolean;
  onShowHighwaysChange: (v: boolean) => void;
  airportsCapped: boolean;
};

const AIRPORT_PRESETS: { value: AirportPreset; label: string }[] = [
  { value: "towered", label: "Towered only" },
  { value: "public", label: "Public use" },
  { value: "public_paved", label: "Public + paved" },
  { value: "all", label: "All airports" },
];

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
      {children}
    </div>
  );
}

export function LayersPanel({
  open,
  onOpenChange,
  airportPreset,
  onAirportPresetChange,
  pinned,
  onAddPin,
  onRemovePin,
  pinError,
  showClassAirspace,
  onShowClassAirspaceChange,
  showArtcc,
  onShowArtccChange,
  showAppDep,
  onShowAppDepChange,
  showTfrs,
  onShowTfrsChange,
  tfrCount,
  showHighways,
  onShowHighwaysChange,
  airportsCapped,
}: LayersPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onOpenChange]);

  const handleAddPin = async (e: FormEvent) => {
    e.preventDefault();
    const raw = pinInput.trim();
    if (!raw || pinSubmitting) return;
    setPinSubmitting(true);
    try {
      const result = await onAddPin(raw);
      if (result === "ok") setPinInput("");
    } finally {
      setPinSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="rounded-lg bg-slate-900/85 px-2.5 py-1.5 text-sm shadow-lg backdrop-blur hover:bg-slate-800"
        title="Map overlay layers"
        aria-expanded={open}
      >
        Layers
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg bg-slate-900/95 p-3 shadow-xl ring-1 ring-slate-700 backdrop-blur">
          <SectionTitle>Airports</SectionTitle>
          <select
            value={airportPreset}
            onChange={(e) =>
              onAirportPresetChange(e.target.value as AirportPreset)
            }
            aria-label="Airport preset"
            className="mb-2 w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none ring-slate-600 focus:ring"
          >
            {AIRPORT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>

          <form className="mb-2 flex gap-1" onSubmit={handleAddPin}>
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.toUpperCase())}
              placeholder="Add designator…"
              maxLength={12}
              aria-label="Add airport designator"
              className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1.5 font-mono text-sm uppercase outline-none ring-sky-500/40 focus:ring"
            />
            <button
              type="submit"
              disabled={!pinInput.trim() || pinSubmitting}
              className="rounded bg-sky-600 px-2.5 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
            >
              Add
            </button>
          </form>

          {pinError ? (
            <div className="mb-2 text-xs text-rose-400">{pinError}</div>
          ) : null}

          {pinned.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {pinned.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-200"
                >
                  {code}
                  <button
                    type="button"
                    onClick={() => onRemovePin(code)}
                    aria-label={`Remove pin ${code}`}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {airportsCapped ? (
            <p className="mb-3 text-xs text-slate-500">
              Zoom in for more airports
            </p>
          ) : (
            <div className="mb-3" />
          )}

          <div className="border-t border-slate-700 pt-3">
            <SectionTitle>Airspace</SectionTitle>
            <div className="flex flex-col gap-1.5 text-sm">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showClassAirspace}
                  onChange={(e) => onShowClassAirspaceChange(e.target.checked)}
                  className="accent-emerald-500"
                />
                Class B / C / D
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showArtcc}
                  onChange={(e) => onShowArtccChange(e.target.checked)}
                  className="accent-sky-500"
                />
                ARTCC boundaries
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showAppDep}
                  onChange={(e) => onShowAppDepChange(e.target.checked)}
                  className="accent-cyan-500"
                />
                APP / DEP boundaries
              </label>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-700 pt-3">
            <SectionTitle>Context</SectionTitle>
            <div className="flex flex-col gap-1.5 text-sm">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showTfrs}
                  onChange={(e) => onShowTfrsChange(e.target.checked)}
                  className="accent-rose-500"
                />
                TFRs
                {showTfrs && tfrCount > 0 ? ` (${tfrCount})` : ""}
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showHighways}
                  onChange={(e) => onShowHighwaysChange(e.target.checked)}
                  className="accent-amber-500"
                />
                Highways
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
