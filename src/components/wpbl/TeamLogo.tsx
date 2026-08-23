"use client";

import { useState } from "react";

import {
  getWpblTeamBrand,
  wpblTeamBadgeBg,
  wpblTeamBadgeRing,
  wpblTeamLogoSrc,
} from "@/lib/wpbl-team-brand";

/**
 * Display sizes — source marks are 128×128.
 * Sized large enough to read on mobile standings / schedule rows.
 */
const SIZES = { sm: 40, md: 56, lg: 72 } as const;

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-[4.5rem] w-[4.5rem]",
} as const;

export type TeamLogoProps = {
  abbr: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/** Team mark on a contrasting plate + brand ring — readable on the dark board. */
export function TeamLogo({ abbr, size = "md", className }: TeamLogoProps) {
  const src = wpblTeamLogoSrc(abbr);
  const brand = getWpblTeamBrand(abbr);
  const ring = wpblTeamBadgeRing(abbr);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  const px = SIZES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${SIZE_CLASS[size]} ${className ?? ""}`.trim()}
      style={{
        backgroundColor: wpblTeamBadgeBg(abbr),
        // Ring sits outside the plate — keep overflow visible so it isn’t clipped.
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
      title={brand?.fullName}
    >
      {/* Clip only the mark so we can scale past transparent PNG padding. */}
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed local marks; next/image adds no benefit */}
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          decoding="async"
          className="h-full w-full scale-[1.28] object-contain"
          onError={() => setFailedSrc(src)}
        />
      </span>
    </span>
  );
}
