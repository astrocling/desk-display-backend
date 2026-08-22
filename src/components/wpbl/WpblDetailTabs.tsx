"use client";

export type WpblDetailTab<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export type WpblDetailTabsProps<T extends string> = {
  tabs: WpblDetailTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
};

/** Game detail view switcher — underline tabs like box score / leaders. */
export function WpblDetailTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: WpblDetailTabsProps<T>) {
  return (
    <nav
      className="flex gap-4 overflow-x-auto border-b border-[var(--wpbl-rule)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={ariaLabel}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 ${selected ? "wpbl-tab wpbl-tab--active" : "wpbl-tab"}`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 ? (
              <span className="ml-1 text-xs font-normal wpbl-muted">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
