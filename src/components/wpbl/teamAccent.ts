import type { CSSProperties } from "react";
import { wpblTeamPrimary } from "@/lib/wpbl-team-brand";

export function teamAccentStyle(abbr: string): CSSProperties {
  return {
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: wpblTeamPrimary(abbr),
  };
}
