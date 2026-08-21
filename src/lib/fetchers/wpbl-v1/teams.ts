export const FALLBACK_SEASON_ID = "c9sgab9f9yx00z75";

export const WPBL_TEAMS = {
  "9f08or2mffx81409": { abbr: "BOS", name: "Hunters", fullName: "Boston Hunters" },
  v4gisr4rbgmn67b0: { abbr: "LA", name: "Queens", fullName: "Los Angeles Queens" },
  fttth861nft1j2s7: { abbr: "NY", name: "Heights", fullName: "New York Heights" },
  vhubhz8li07tmgq8: { abbr: "SF", name: "Firebells", fullName: "San Francisco Firebells" },
} as const;

export type WpblTeamAbbr = (typeof WPBL_TEAMS)[keyof typeof WPBL_TEAMS]["abbr"];

export function teamFromId(id: string) {
  return WPBL_TEAMS[id as keyof typeof WPBL_TEAMS] ?? null;
}

export function teamFromFullName(fullName: string) {
  const entry = Object.values(WPBL_TEAMS).find((t) => t.fullName === fullName);
  return entry ?? null;
}
