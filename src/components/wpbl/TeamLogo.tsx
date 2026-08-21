"use client";

import { useState } from "react";

import { getWpblTeamBrand, wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

const SIZES = { sm: 16, md: 24 } as const;

export type TeamLogoProps = {
  abbr: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function TeamLogo({ abbr, size = "sm", className }: TeamLogoProps) {
  const src = wpblTeamLogoSrc(abbr);
  const brand = getWpblTeamBrand(abbr);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  const px = SIZES[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed 16–24px local marks; next/image adds no benefit
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      decoding="async"
      className={`inline-block shrink-0 rounded object-contain p-px dark:bg-white/90 ${className ?? ""}`.trim()}
      onError={() => setFailedSrc(src)}
      title={brand?.fullName}
    />
  );
}
