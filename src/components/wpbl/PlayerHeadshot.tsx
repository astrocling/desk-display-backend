"use client";

import { useState } from "react";

import {
  WPBL_LOGO_CHIP_INSET,
  wpblTeamBadgeBg,
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
  const accent = teamAbbr ? wpblTeamBadgeBg(teamAbbr) : null;
  /** Badge large enough that the mark can dominate the chip. */
  const badge = Math.max(22, Math.round(size * 0.44));
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
          boxShadow: accent ? `0 0 0 ${ring}px ${accent}` : undefined,
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
            padding: WPBL_LOGO_CHIP_INSET,
            backgroundColor: accent ?? "#fff",
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
            className="h-full w-full object-contain"
          />
        </span>
      ) : null}
    </span>
  );
}
