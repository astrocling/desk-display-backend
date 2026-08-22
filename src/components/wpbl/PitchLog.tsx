"use client";

import type { PitchChip } from "@/lib/wpbl-tracking";

export type PitchLogProps = {
  chips: PitchChip[];
  label?: string | null;
  compact?: boolean;
};

function pitchDotClass(kind: PitchChip["kind"]): string {
  switch (kind) {
    case "ball":
      return "wpbl-pitch-dot wpbl-pitch-dot--ball";
    case "strike":
      return "wpbl-pitch-dot wpbl-pitch-dot--strike";
    case "foul":
      return "wpbl-pitch-dot wpbl-pitch-dot--foul";
    case "in_play":
      return "wpbl-pitch-dot wpbl-pitch-dot--in-play";
    default:
      return "wpbl-pitch-dot wpbl-pitch-dot--other";
  }
}

/** MLB-style pitch sequence: dot trail + optional description line. */
export function PitchLog({ chips, label, compact }: PitchLogProps) {
  if (!chips.length) return null;

  const description = chips.map((chip) => chip.title).join(" · ");

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {label ? (
        <p className="wpbl-section-label">
          {label}
          <span className="ml-1 font-normal normal-case tracking-normal wpbl-muted">
            · {chips.length} pitch{chips.length === 1 ? "" : "es"}
          </span>
        </p>
      ) : null}
      <div
        className="flex flex-wrap items-center gap-1"
        aria-label={label ?? "Pitch sequence"}
      >
        {chips.map((chip) => (
          <span
            key={chip.key}
            title={chip.title}
            className={pitchDotClass(chip.kind)}
            aria-label={chip.title}
          />
        ))}
      </div>
      {!compact ? (
        <p className="text-[11px] leading-snug wpbl-muted">{description}</p>
      ) : null}
    </div>
  );
}
