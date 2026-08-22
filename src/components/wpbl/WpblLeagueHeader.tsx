import { WpblThemeToggle } from "./WpblThemeToggle";

/** Official WPBL primary lockup — dark mark for light UI, gold for dark UI. */
export function WpblLeagueHeader() {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="sr-only">Women&apos;s Pro Baseball League</h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- static local brand assets */}
        <img
          src="/wpbl/league-lockup-dark.png"
          alt=""
          width={867}
          height={128}
          decoding="async"
          className="h-10 w-auto max-w-full dark:hidden sm:h-12"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- static local brand assets */}
        <img
          src="/wpbl/league-lockup-light.png"
          alt=""
          width={867}
          height={128}
          decoding="async"
          className="hidden h-10 w-auto max-w-full dark:block sm:h-12"
        />
      </div>
      <div className="shrink-0">
        <WpblThemeToggle />
      </div>
    </header>
  );
}
