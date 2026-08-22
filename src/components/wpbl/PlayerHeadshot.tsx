"use client";

import { useState } from "react";

import { wpblTeamLogoSrc } from "@/lib/wpbl-team-brand";

export type PlayerHeadshotProps = {
  name: string;
  headshotUrl?: string | null;
  teamAbbr?: string | null;
  /** Pixel size for the circular crop. Default 40. */
  size?: number;
};

/** Compact circular player photo with optional team-mark badge. */
export function PlayerHeadshot({
  name,
  headshotUrl,
  teamAbbr,
  size = 40,
}: PlayerHeadshotProps) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(headshotUrl) && !failed;
  const logoSrc = teamAbbr ? wpblTeamLogoSrc(teamAbbr) : null;
  const badge = Math.max(12, Math.round(size * 0.36));
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote WPBL CDN URLs
        <img
          src={headshotUrl!}
          alt=""
          width={size}
          height={size}
          decoding="async"
          className="rounded-full bg-neutral-700 object-cover object-top"
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full bg-neutral-700 font-semibold text-neutral-200"
          style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
          aria-hidden
        >
          {initials}
        </span>
      )}
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- local team marks
        <img
          src={logoSrc}
          alt=""
          width={badge}
          height={badge}
          decoding="async"
          className="absolute -left-0.5 -top-0.5 rounded-full bg-white object-contain p-px shadow-sm"
          style={{ width: badge, height: badge }}
        />
      ) : null}
    </span>
  );
}
