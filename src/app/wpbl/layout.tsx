import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WPBL — Desk Display",
  description: "WPBL standings, schedule, and stat leaders",
};

export default function WpblLayout({ children }: { children: React.ReactNode }) {
  return children;
}
