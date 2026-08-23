"use client";

import type { BasesOccupancy } from "@/lib/wpbl-play-display";

export type BasesStateIconProps = {
  bases: BasesOccupancy;
  size?: number;
  className?: string;
};

/** Compact diamond for play-by-play timeline nodes. */
export function BasesStateIcon({
  bases,
  size = 20,
  className,
}: BasesStateIconProps) {
  const baseClass = (on: boolean) =>
    `absolute rotate-45 border ${
      on
        ? "border-[var(--wpbl-ink)] bg-[var(--wpbl-ink)]"
        : "border-[var(--wpbl-muted)] bg-transparent"
    }`;

  const baseSize = Math.max(6, Math.round(size * 0.28));

  return (
    <span
      className={`relative inline-flex shrink-0 ${className ?? ""}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className={`${baseClass(bases.onSecond)} left-1/2 top-0 -translate-x-1/2`}
        style={{ width: baseSize, height: baseSize }}
      />
      <span
        className={`${baseClass(bases.onThird)} left-0 top-1/2 -translate-y-1/2`}
        style={{ width: baseSize, height: baseSize }}
      />
      <span
        className={`${baseClass(bases.onFirst)} right-0 top-1/2 -translate-y-1/2`}
        style={{ width: baseSize, height: baseSize }}
      />
    </span>
  );
}
