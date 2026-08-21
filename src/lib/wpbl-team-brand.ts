export type WpblBrandAbbr = "LA" | "NY" | "SF" | "BOS";

export type WpblTeamBrand = {
  abbr: WpblBrandAbbr;
  name: string;
  fullName: string;
  primary: string;
  logoSrc: string;
};

const FALLBACK_PRIMARY = "#64748b";

const BRANDS: Record<WpblBrandAbbr, WpblTeamBrand> = {
  LA: {
    abbr: "LA",
    name: "Queens",
    fullName: "Los Angeles Queens",
    primary: "#AF9067",
    logoSrc: "/wpbl/la.png",
  },
  NY: {
    abbr: "NY",
    name: "Heights",
    fullName: "New York Heights",
    primary: "#0B1F3A",
    logoSrc: "/wpbl/ny.png",
  },
  SF: {
    abbr: "SF",
    name: "Firebells",
    fullName: "San Francisco Firebells",
    primary: "#5B2A8C",
    logoSrc: "/wpbl/sf.png",
  },
  BOS: {
    abbr: "BOS",
    name: "Hunters",
    fullName: "Boston Hunters",
    primary: "#0B6B3A",
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
