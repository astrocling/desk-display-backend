import type { WpblGameStatus } from "@/lib/types/wpbl-display";

export function mapWpblStatus(raw: string): WpblGameStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "other";
  if (s.startsWith("final")) return "final";
  if (s === "live" || s.includes("in progress")) return "live";
  if (
    s === "not started" ||
    s === "upcoming" ||
    s === "scheduled" ||
    s.includes("not started")
  ) {
    return "scheduled";
  }
  return "other";
}
