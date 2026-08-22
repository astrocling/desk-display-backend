import type { Viewport } from "next";
import { RadarMap } from "@/components/radar/RadarMap";

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
