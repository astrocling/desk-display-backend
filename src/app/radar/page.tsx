import type { Metadata, Viewport } from "next";
import { RadarMap } from "@/components/radar/RadarMap";

export const metadata: Metadata = {
  title: "Radar — Desk Display",
  description: "Mobile-friendly ADS-B radar with map overlays",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RadarPage() {
  return <RadarMap />;
}
