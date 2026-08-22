import { WpblLeagueClient } from "@/components/wpbl/WpblLeagueClient";
import { WpblLeagueHeader } from "@/components/wpbl/WpblLeagueHeader";

export default function WpblPage() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-8 pr-14">
      <WpblLeagueHeader />
      <WpblLeagueClient />
    </main>
  );
}
