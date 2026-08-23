"use client";

import { useState } from "react";

import {
  getWpblTeamBrand,
  wpblTeamBadgeBg,
  wpblTeamBadgeRing,
  wpblTeamLogoSrc,
} from "@/lib/wpbl-team-brand";

export type PlayerHeadshotProps = {
  name: string;
  headshotUrl?: string | null;
  teamAbbr?: string | null;
  /** Pixel size for the circular crop. Default 48. */
  size?: number;
};

/** Circular player photo with team-color ring + logo badge. */
export function PlayerHeadshot({
  name,
  headshotUrl,
  teamAbbr,
  size = 48,
}: PlayerHeadshotProps) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(headshotUrl) && !failed;
  const logoSrc = teamAbbr ? wpblTeamLogoSrc(teamAbbr) : null;
  const brand = teamAbbr ? getWpblTeamBrand(teamAbbr) : null;
  /** Photo ring stays team-colored; logo chip uses the contrasting badge plate. */
  const photoRing =
    brand?.primaryDark ?? (teamAbbr ? wpblTeamBadgeBg(teamAbbr) : null);
  const badgePlate = teamAbbr ? wpblTeamBadgeBg(teamAbbr) : null;
  const badgeRing = teamAbbr ? wpblTeamBadgeRing(teamAbbr) : null;
  const badge = Math.max(22, Math.round(size * 0.48));
  const ring = Math.max(2, Math.round(size * 0.05));
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
      <span
        className="block overflow-hidden rounded-full bg-[var(--wpbl-bg-hover)]"
        style={{
          width: size,
          height: size,
          boxShadow: photoRing ? `0 0 0 ${ring}px ${photoRing}` : undefined,
        }}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote WPBL CDN URLs
          <img
            src={headshotUrl!}
            alt=""
            width={size}
            height={size}
            decoding="async"
            className="h-full w-full object-cover object-top"
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center font-semibold text-[var(--wpbl-ink-secondary)]"
            style={{ fontSize: Math.max(11, size * 0.32) }}
            aria-hidden
          >
            {initials}
          </span>
        )}
      </span>
      {logoSrc ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center overflow-hidden rounded-full shadow-md ring-2 ring-[var(--wpbl-bg-panel)]"
          style={{
            width: badge,
            height: badge,
            backgroundColor: badgePlate ?? "#fff",
            boxShadow: badgeRing ? `0 0 0 1.5px ${badgeRing}` : undefined,
          }}
          title={teamAbbr ?? undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local team marks */}
          <img
            src={logoSrc}
            alt=""
            width={badge}
            height={badge}
            decoding="async"
            className="h-full w-full scale-[1.28] object-contain"
          />
        </span>
      ) : null}
    </span>
  );
}
