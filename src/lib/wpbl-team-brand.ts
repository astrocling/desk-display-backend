import type { CSSProperties } from "react";

export type WpblBrandAbbr = "LA" | "NY" | "SF" | "BOS";

export type WpblTeamBrand = {
  abbr: WpblBrandAbbr;
  name: string;
  fullName: string;
  primary: string;
  /** Lightened variant for ≥3:1 non-text contrast on dark backgrounds */
  primaryDark: string;
  logoSrc: string;
};

const FALLBACK_PRIMARY = "#64748b";

const BRANDS: Record<WpblBrandAbbr, WpblTeamBrand> = {
  LA: {
    abbr: "LA",
    name: "Queens",
    fullName: "Los Angeles Queens",
    primary: "#AF9067",
    primaryDark: "#AF9067",
    logoSrc: "/wpbl/la.png",
  },
  NY: {
    abbr: "NY",
    name: "Heights",
    fullName: "New York Heights",
    primary: "#0B1F3A",
    primaryDark: "#3C6FA8",
    logoSrc: "/wpbl/ny.png",
  },
  SF: {
    abbr: "SF",
    name: "Firebells",
    fullName: "San Francisco Firebells",
    primary: "#5B2A8C",
    primaryDark: "#8B5FC4",
    logoSrc: "/wpbl/sf.png",
  },
  BOS: {
    abbr: "BOS",
    name: "Hunters",
    fullName: "Boston Hunters",
    primary: "#0B6B3A",
    primaryDark: "#1FA05A",
    logoSrc: "/wpbl/bos.png",
  },
};

function isBrandAbbr(abbr: string): abbr is WpblBrandAbbr {
  return abbr === "LA" || abbr === "NY" || abbr === "SF" || abbr === "BOS";
}

export function getWpblTeamBrand(abbr: string): WpblTeamBrand | null {
  if (!isBrandAbbr(abbr)) return null;
  return BRANDS[abbr];
}

export function wpblTeamPrimary(abbr: string): string {
  return getWpblTeamBrand(abbr)?.primary ?? FALLBACK_PRIMARY;
}

/** Dark plate under full-color marks so NY/SF/BOS don’t drown in their own fill. */
const BADGE_PLATE_DARK = "#12171E";

/**
 * Badge / chip fill behind team marks.
 * - LA’s mark is dark charcoal → gold primary plate so it reads
 * - Other marks are already team-colored → dark neutral plate (never primaryDark)
 */
export function wpblTeamBadgeBg(abbr: string): string {
  const brand = getWpblTeamBrand(abbr);
  if (!brand) return FALLBACK_PRIMARY;
  if (luminance(brand.primary) > 120) return brand.primary;
  return BADGE_PLATE_DARK;
}

/** Readable team-color ring around a dark badge plate (null when the plate is already brand-colored). */
export function wpblTeamBadgeRing(abbr: string): string | null {
  const brand = getWpblTeamBrand(abbr);
  if (!brand) return null;
  if (luminance(brand.primary) > 120) return null;
  return brand.primaryDark;
}

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return 0;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wpblTeamLogoSrc(abbr: string): string | null {
  return getWpblTeamBrand(abbr)?.logoSrc ?? null;
}

/** CSS custom properties for theme-aware team accent colours */
export function wpblTeamAccent(abbr: string): CSSProperties {
  const brand = getWpblTeamBrand(abbr);
  const primary = brand?.primary ?? FALLBACK_PRIMARY;
  const primaryDark = brand?.primaryDark ?? primary;
  return {
    ["--team-accent" as string]: primary,
    ["--team-accent-dark" as string]: primaryDark,
  };
}
