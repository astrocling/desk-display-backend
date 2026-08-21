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
    primaryDark: "#0B6B3A",
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
