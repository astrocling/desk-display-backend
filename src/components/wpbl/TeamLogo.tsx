"use client";

import { useState } from "react";

import {
  getWpblTeamBrand,
  wpblTeamBadgeBg,
  wpblTeamLogoSrc,
} from "@/lib/wpbl-team-brand";

/** Display sizes — source marks are 128×128; keep at or below that for sharpness. */
const SIZES = { sm: 36, md: 48, lg: 56 } as const;

const SIZE_CLASS = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-14 w-14",
} as const;

export type TeamLogoProps = {
  abbr: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/** Team mark on a team-color chip — always clipped inside the circle. */
export function TeamLogo({ abbr, size = "md", className }: TeamLogoProps) {
  const src = wpblTeamLogoSrc(abbr);
  const brand = getWpblTeamBrand(abbr);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  const px = SIZES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full p-[10%] ${SIZE_CLASS[size]} ${className ?? ""}`.trim()}
      style={{ backgroundColor: wpblTeamBadgeBg(abbr) }}
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
