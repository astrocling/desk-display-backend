import type { Metadata } from "next";

import { WpblLeagueHeader } from "@/components/wpbl/WpblLeagueHeader";
import { WpblNav } from "@/components/wpbl/WpblNav";
import { WpblThemeProvider } from "@/components/wpbl/WpblThemeProvider";
import "@/components/wpbl/wpbl-board.css";

export const metadata: Metadata = {
  title: "Women's Pro Baseball League",
  description: "WPBL standings, schedule, and stat leaders",
};

export default function WpblLayout({ children }: { children: React.ReactNode }) {
  return (
    <WpblThemeProvider>
      <main className="wpbl-board mx-auto w-full max-w-5xl px-4 py-8">
        <WpblLeagueHeader />
        <WpblNav />
        {children}
      </main>
    </WpblThemeProvider>
  );
}
