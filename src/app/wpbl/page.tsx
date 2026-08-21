import { WpblLeagueClient } from "@/components/wpbl/WpblLeagueClient";

export default function WpblPage() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-8 pr-14">
      <h1 className="text-3xl font-semibold tracking-tight">WPBL</h1>
      <p className="mt-1 text-sm text-slate-500">Standings, schedule, and leaders</p>
      <WpblLeagueClient />
    </main>
  );
}
