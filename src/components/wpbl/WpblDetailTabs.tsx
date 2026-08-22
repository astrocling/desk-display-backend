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

/** Game detail view switcher — matches Home nav chrome. */
export function WpblDetailTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: WpblDetailTabsProps<T>) {
  return (
    <nav className="wpbl-nav" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={
              selected ? "wpbl-nav-link wpbl-nav-link--active" : "wpbl-nav-link"
            }
          >
            {tab.label}
            {tab.count != null && tab.count > 0 ? (
              <span className="ml-1.5 text-xs wpbl-muted">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
