import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radar — Desk Display",
  description: "Mobile-friendly ADS-B radar with map overlays",
};

export default function RadarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
