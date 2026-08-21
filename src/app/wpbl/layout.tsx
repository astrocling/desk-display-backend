import type { Metadata } from "next";

import { WpblThemeProvider } from "@/components/wpbl/WpblThemeProvider";
import { WpblThemeToggle } from "@/components/wpbl/WpblThemeToggle";

export const metadata: Metadata = {
  title: "WPBL — Desk Display",
  description: "WPBL standings, schedule, and stat leaders",
};

export default function WpblLayout({ children }: { children: React.ReactNode }) {
  return (
    <WpblThemeProvider>
      <div className="relative min-h-[100dvh]">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <WpblThemeToggle />
        </div>
        {children}
      </div>
    </WpblThemeProvider>
  );
}
