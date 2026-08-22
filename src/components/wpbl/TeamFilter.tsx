import { wpblTeamAccent } from "@/lib/wpbl-team-brand";

import { TeamLogo } from "./TeamLogo";

export type WpblTeamFilter = "ALL" | "LA" | "NY" | "SF" | "BOS";

export function gameInvolvesTeam(
  game: { awayAbbr: string; homeAbbr: string },
  abbr: WpblTeamFilter,
): boolean {
  if (abbr === "ALL") return true;
  return game.awayAbbr === abbr || game.homeAbbr === abbr;
}

const OPTIONS: { value: WpblTeamFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LA", label: "LA" },
  { value: "NY", label: "NY" },
  { value: "SF", label: "SF" },
  { value: "BOS", label: "BOS" },
];

export type TeamFilterProps = {
  value: WpblTeamFilter;
  onChange: (value: WpblTeamFilter) => void;
};

export function TeamFilter({ value, onChange }: TeamFilterProps) {
  return (
    <div
      className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Team filter"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        const isTeam = opt.value !== "ALL";
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? isTeam
                  ? "wpbl-team-accent-fill wpbl-filter-btn"
                  : "wpbl-filter-btn wpbl-filter-btn--active-all"
                : "wpbl-filter-btn"
            }
            style={
              active && isTeam
                ? {
                    ...wpblTeamAccent(opt.value),
                    color: opt.value === "LA" ? "#111827" : undefined,
                  }
                : undefined
            }
          >
            {isTeam ? <TeamLogo key={opt.value} abbr={opt.value} size="sm" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
