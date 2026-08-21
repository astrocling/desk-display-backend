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
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                : "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
