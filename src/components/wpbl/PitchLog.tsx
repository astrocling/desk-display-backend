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
      return "border-sky-500/40 bg-sky-500/15 text-sky-300";
    case "strike":
      return "border-red-500/40 bg-red-500/15 text-red-300";
    case "foul":
      return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    case "in_play":
      return "border-[color-mix(in_srgb,var(--wpbl-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--wpbl-accent)_12%,transparent)] text-[var(--wpbl-accent)]";
    case "track":
      return "border-[var(--wpbl-rule)] bg-[var(--wpbl-bg-elevated)] text-[var(--wpbl-ink-secondary)]";
    default:
      return "border-[var(--wpbl-rule)] bg-[var(--wpbl-bg-hover)] text-[var(--wpbl-muted)]";
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
        <p className="wpbl-section-label">
          {label}
          <span className="ml-1 font-normal normal-case tracking-normal wpbl-muted">
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
                className={`inline-flex min-w-[1.6rem] flex-col items-center justify-center rounded border px-1 py-0.5 font-mono font-semibold tabular-nums ${chipClass(chip.kind)}`}
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
        <p className="text-[11px] leading-snug wpbl-muted">
          {chips.map((c) => c.title).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
