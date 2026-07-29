import { normalizeCatalogIcao, resolvedFeedIdForIcao } from "./commsPresets";

export type CommsTuneAction =
  | { type: "stop" }
  | { type: "play"; icao: string; feedId: string };

export function decideCommsTune(args: {
  targetIcao: string;
  activeIcao: string | null;
  status: "idle" | "loading" | "playing" | "error";
  lastFeedByIcao: Record<string, string>;
}): CommsTuneAction | null {
  const icao = normalizeCatalogIcao(args.targetIcao);
  if (!icao) return null;

  const live =
    args.status === "playing" || args.status === "loading";
  if (live && args.activeIcao === icao) {
    return { type: "stop" };
  }

  const feedId = resolvedFeedIdForIcao(icao, args.lastFeedByIcao);
  if (!feedId) return null;
  return { type: "play", icao, feedId };
}
