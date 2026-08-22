"use client";

import type { PitchChip } from "@/lib/wpbl-tracking";

export type PitchLogProps = {
  chips: PitchChip[];
  label?: string | null;
  compact?: boolean;
};

function chipClass(kind: PitchChip["kind"]): string {
  switch (kind) {
    case "ball":
      return "bg-sky-600 text-white";
    case "strike":
      return "bg-red-600 text-white";
    case "foul":
      return "bg-amber-500 text-white";
    case "in_play":
      return "bg-emerald-600 text-white";
    case "track":
      return "bg-slate-700 text-white dark:bg-slate-600";
    default:
      return "bg-slate-500 text-white";
  }
}

function secondaryLine(chip: PitchChip): string | null {
  if (chip.exitMph != null) return `${chip.exitMph}`;
  if (chip.releaseMph != null) return `${chip.releaseMph}`;
  if (chip.pitchTypeAbbr && chip.kind !== "track") return chip.pitchTypeAbbr;
  return null;
}

export function PitchLog({ chips, label, compact }: PitchLogProps) {
  if (!chips.length) return null;

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {label ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
          <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
            · {chips.length} pitch{chips.length === 1 ? "" : "es"}
          </span>
        </p>
      ) : null}
      <ol
        className="flex flex-wrap gap-1"
        aria-label={label ?? "Pitch sequence"}
      >
        {chips.map((chip) => {
          const secondary = secondaryLine(chip);
          return (
            <li key={chip.key}>
              <span
                title={chip.title}
                className={`inline-flex min-w-[1.6rem] flex-col items-center justify-center rounded px-1 py-0.5 font-mono font-semibold tabular-nums ${chipClass(chip.kind)}`}
              >
                <span className="text-[10px] leading-none">{chip.label}</span>
                {secondary && secondary !== chip.label ? (
                  <span className="text-[8px] font-medium leading-tight opacity-90">
                    {secondary}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {!compact ? (
        <p className="text-[11px] leading-snug text-slate-500">
          {chips.map((c) => c.title).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
