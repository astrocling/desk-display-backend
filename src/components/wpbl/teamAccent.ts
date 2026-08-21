import type { CSSProperties } from "react";
import { wpblTeamAccent } from "@/lib/wpbl-team-brand";

/** Sets CSS vars only — border color comes from `.wpbl-team-accent` so dark mode can switch. */
export function teamAccentStyle(abbr: string): CSSProperties {
  return wpblTeamAccent(abbr);
}
