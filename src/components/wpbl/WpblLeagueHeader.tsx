/** Official WPBL primary lockup — dark mark for light UI, gold for dark UI. */
export function WpblLeagueHeader() {
  return (
    <header>
      <h1 className="sr-only">Women&apos;s Pro Baseball League</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- static local brand assets */}
      <img
        src="/wpbl/league-lockup-dark.png"
        alt=""
        width={867}
        height={128}
        decoding="async"
        className="h-10 w-auto dark:hidden sm:h-12"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static local brand assets */}
      <img
        src="/wpbl/league-lockup-light.png"
        alt=""
        width={867}
        height={128}
        decoding="async"
        className="hidden h-10 w-auto dark:block sm:h-12"
      />
    </header>
  );
}
