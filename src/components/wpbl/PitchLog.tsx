"use client";

import type { WpblPitchEvent } from "@/lib/types/wpbl-display";
import { pitchKind } from "@/lib/wpbl-plays";

export type PitchLogProps = {
  pitches: WpblPitchEvent[];
  label?: string | null;
  compact?: boolean;
};

function chipClass(kind: ReturnType<typeof pitchKind>): string {
  switch (kind) {
    case "ball":
      return "bg-sky-600 text-white";
    case "strike":
      return "bg-red-600 text-white";
    case "foul":
      return "bg-amber-500 text-white";
    case "in_play":
      return "bg-emerald-600 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function shortLabel(event: WpblPitchEvent): string {
  const kind = pitchKind(event);
  if (kind === "ball") return "B";
  if (kind === "foul") return "F";
  if (kind === "in_play") return "X";
  if (kind === "strike") {
    if (event.type.includes("swinging") || event.code.toUpperCase() === "S") {
      return "S";
    }
    return "K";
  }
  return event.code || "?";
}

export function PitchLog({ pitches, label, compact }: PitchLogProps) {
  if (!pitches.length) return null;

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {label ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
          <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
            · {pitches.length} pitch{pitches.length === 1 ? "" : "es"}
          </span>
        </p>
      ) : null}
      <ol
        className="flex flex-wrap gap-1"
        aria-label={label ?? "Pitch sequence"}
      >
        {pitches.map((event) => {
          const kind = pitchKind(event);
          return (
            <li key={`${event.sequence}-${event.code}-${event.description}`}>
              <span
                title={event.description || event.type}
                className={`inline-flex min-w-[1.35rem] items-center justify-center rounded px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${chipClass(kind)}`}
              >
                {shortLabel(event)}
              </span>
            </li>
          );
        })}
      </ol>
      {!compact ? (
        <p className="text-[11px] leading-snug text-slate-500">
          {pitches.map((e) => e.description || e.code).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
