"use client";

export type WpblFeedFilterOption<T extends string> = {
  value: T;
  label: string;
};

export type WpblFeedFilterProps<T extends string> = {
  options: WpblFeedFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Underline tabs (default) or MLB-style pill chips. */
  variant?: "tabs" | "pills";
};

/** Text underline filter — matches box score / leaders tabs, not pills. */
export function WpblFeedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "tabs",
}: WpblFeedFilterProps<T>) {
  if (variant === "pills") {
    return (
      <div className="wpbl-feed-pills" role="group" aria-label={ariaLabel}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={
                selected ? "wpbl-feed-pill wpbl-feed-pill--active" : "wpbl-feed-pill"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex gap-4 border-b border-[var(--wpbl-rule)]"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={selected ? "wpbl-tab wpbl-tab--active" : "wpbl-tab"}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
