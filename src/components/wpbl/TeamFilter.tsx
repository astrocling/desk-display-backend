import { wpblTeamAccent } from "@/lib/wpbl-team-brand";

import { TeamLogo } from "./TeamLogo";

export type WpblTeamFilter = "ALL" | "LA" | "NY" | "SF" | "BOS";

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
    <div className="flex flex-wrap gap-2" role="group" aria-label="Team filter">
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
                  ? "wpbl-team-accent-fill inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                : "inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            }
            style={
              active && isTeam
                ? {
                    ...wpblTeamAccent(opt.value),
                    // Queens gold is mid-tone — dark text reads better than white
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
