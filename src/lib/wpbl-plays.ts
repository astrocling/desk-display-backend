import type { WpblPlay } from "@/lib/types/wpbl-display";

/** Newest play by sequence, or null when empty. */
export function latestWpblPlay(plays: WpblPlay[]): WpblPlay | null {
  if (!plays.length) return null;
  return plays.reduce((best, play) =>
    play.sequence >= best.sequence ? play : best,
  );
}

/** Newest-first list; optionally scoring plays only. */
export function filterWpblPlays(
  plays: WpblPlay[],
  mode: "all" | "scoring",
): WpblPlay[] {
  const filtered =
    mode === "scoring" ? plays.filter((p) => p.isScoringPlay) : plays;
  return [...filtered].sort((a, b) => b.sequence - a.sequence);
}

export function formatPlayInning(play: WpblPlay): string {
  if (play.half === "top") return `Top ${play.inning}`;
  if (play.half === "bottom") return `Bot ${play.inning}`;
  return `Inn ${play.inning}`;
}

/** Short last-token label for diamond runner chips. */
export function shortRunnerLabel(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] ?? trimmed;
}
