"use client";

import { useState } from "react";

import { getWpblTeamBrand, wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

/** Display sizes — source marks are 128×128; keep at or below that for sharpness. */
const SIZES = { sm: 28, md: 40, lg: 48 } as const;

/** Dark metallic / purple marks need a light plate in dark mode; colour marks do not. */
const NEEDS_LIGHT_PLATE = new Set(["LA", "SF"]);

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
  const plate = NEEDS_LIGHT_PLATE.has(abbr.toUpperCase())
    ? "rounded-sm dark:bg-white dark:ring-1 dark:ring-white/10"
    : "";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local marks; next/image adds no benefit
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      decoding="async"
      className={`inline-block shrink-0 object-contain ${plate} ${className ?? ""}`.trim()}
      onError={() => setFailedSrc(src)}
      title={brand?.fullName}
    />
  );
}
