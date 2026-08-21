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
  const nyPad = abbr === "NY" ? "rounded bg-slate-800 p-0.5" : "";
  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      className={`inline-block shrink-0 object-contain ${nyPad} ${className ?? ""}`.trim()}
      onError={() => setFailedSrc(src)}
      title={brand?.fullName}
    />
  );
}
