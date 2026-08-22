"use client";

import { useState } from "react";

import { getWpblTeamBrand, wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

/** Display sizes — source marks are 128×128; keep at or below that for sharpness. */
const SIZES = { sm: 32, md: 44, lg: 56 } as const;

/** Explicit CSS boxes so every mark occupies the same square (Tailwind preflight sets img height:auto). */
const SIZE_CLASS = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

export type TeamLogoProps = {
  abbr: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function TeamLogo({ abbr, size = "md", className }: TeamLogoProps) {
  const src = wpblTeamLogoSrc(abbr);
  const brand = getWpblTeamBrand(abbr);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  const px = SIZES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden dark:rounded-sm dark:bg-white ${SIZE_CLASS[size]} ${className ?? ""}`.trim()}
      title={brand?.fullName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed local marks; next/image adds no benefit */}
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        decoding="async"
        className="h-full w-full object-contain"
        onError={() => setFailedSrc(src)}
      />
    </span>
  );
}
