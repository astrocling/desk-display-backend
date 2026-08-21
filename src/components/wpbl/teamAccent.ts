import type { CSSProperties } from "react";
import { wpblTeamAccent } from "@/lib/wpbl-team-brand";

export function teamAccentStyle(abbr: string): CSSProperties {
  return {
    ...wpblTeamAccent(abbr),
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: "var(--team-accent)",
  };
}
