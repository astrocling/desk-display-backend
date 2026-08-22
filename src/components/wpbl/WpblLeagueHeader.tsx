/** Official WPBL lockup — gold mark on the dark board. */
export function WpblLeagueHeader() {
  return (
    <header>
      <h1 className="sr-only">Women&apos;s Pro Baseball League</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- static local brand assets */}
      <img
        src="/wpbl/league-lockup-light.png"
        alt=""
        width={867}
        height={128}
        decoding="async"
        className="h-10 w-auto max-w-full sm:h-12"
      />
    </header>
  );
}
