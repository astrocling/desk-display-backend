import type { Metadata } from "next";

import { WpblLeagueHeader } from "@/components/wpbl/WpblLeagueHeader";
import { WpblNav } from "@/components/wpbl/WpblNav";
import { WpblThemeProvider } from "@/components/wpbl/WpblThemeProvider";

export const metadata: Metadata = {
  title: "Women's Pro Baseball League — Desk Display",
  description: "WPBL standings, schedule, and stat leaders",
};

export default function WpblLayout({ children }: { children: React.ReactNode }) {
  return (
    <WpblThemeProvider>
      <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-8">
        <WpblLeagueHeader />
        <WpblNav />
        {children}
      </main>
    </WpblThemeProvider>
  );
}
