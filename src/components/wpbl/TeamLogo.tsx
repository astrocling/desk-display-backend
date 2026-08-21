"use client";

import { useState } from "react";

import { getWpblTeamBrand, wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

/** Display sizes — source marks are 64×64; keep at or below that for sharpness. */
const SIZES = { sm: 28, md: 40, lg: 48 } as const;

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
    // eslint-disable-next-line @next/next/no-img-element -- fixed local marks; next/image adds no benefit
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      decoding="async"
      className={`inline-block shrink-0 rounded-sm object-contain dark:bg-white/95 dark:p-0.5 ${className ?? ""}`.trim()}
      onError={() => setFailedSrc(src)}
      title={brand?.fullName}
    />
  );
}
