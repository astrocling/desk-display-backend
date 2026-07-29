"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getFeedById } from "@/lib/atc/feeds";
import {
  COMMS_PRESETS_STORAGE_KEY,
  mergeCommsEntries,
  normalizeCatalogIcao,
  parseCommsPresetsStored,
  serializeCommsPresetsStored,
  type CommsPresetEntry,
} from "./commsPresets";

export type CommsPresets = {
  entries: CommsPresetEntry[];
  expanded: boolean;
  lastFeedByIcao: Record<string, string>;
  addSession: (icao: string) => void;
  togglePin: (icao: string) => void;
  removeSession: (icao: string) => void;
  setExpanded: (expanded: boolean) => void;
  rememberFeed: (icao: string, feedId: string) => void;
};

function readStored(): ReturnType<typeof parseCommsPresetsStored> {
  if (typeof window === "undefined") {
    return { pinnedIcaos: [], expanded: false, lastFeedByIcao: {} };
  }
  try {
    return parseCommsPresetsStored(
      window.localStorage.getItem(COMMS_PRESETS_STORAGE_KEY),
    );
  } catch {
    return { pinnedIcaos: [], expanded: false, lastFeedByIcao: {} };
  }
}

function writeStored(
  pinnedIcaos: string[],
  expanded: boolean,
  lastFeedByIcao: Record<string, string>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMMS_PRESETS_STORAGE_KEY,
      serializeCommsPresetsStored({
        pinnedIcaos,
        expanded,
        lastFeedByIcao,
      }),
    );
  } catch {
    // private mode / quota — keep in-memory only
  }
}

export function useCommsPresets(): CommsPresets {
  const [pinnedIcaos, setPinnedIcaos] = useState<string[]>([]);
  const [sessionIcaos, setSessionIcaos] = useState<string[]>([]);
  const [expanded, setExpandedState] = useState(false);
  const [lastFeedByIcao, setLastFeedByIcao] = useState<Record<string, string>>(
    {},
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client hydrate from localStorage after SSR-safe collapsed default, not a render-triggered sync
    setPinnedIcaos(stored.pinnedIcaos);
    setExpandedState(stored.expanded);
    setLastFeedByIcao(stored.lastFeedByIcao);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(pinnedIcaos, expanded, lastFeedByIcao);
  }, [pinnedIcaos, expanded, lastFeedByIcao, hydrated]);

  const entries = useMemo(
    () => mergeCommsEntries(pinnedIcaos, sessionIcaos),
    [pinnedIcaos, sessionIcaos],
  );

  const addSession = useCallback((icao: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    setSessionIcaos((prev) => (prev.includes(upper) ? prev : [...prev, upper]));
  }, []);

  const removeSession = useCallback((icao: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    setSessionIcaos((prev) => prev.filter((x) => x !== upper));
  }, []);

  const togglePin = useCallback((icao: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    setPinnedIcaos((prev) =>
      prev.includes(upper) ? prev.filter((x) => x !== upper) : [...prev, upper],
    );
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
  }, []);

  const rememberFeed = useCallback((icao: string, feedId: string) => {
    const upper = normalizeCatalogIcao(icao);
    if (!upper) return;
    const feed = getFeedById(feedId);
    if (feed?.icao !== upper) return;
    setLastFeedByIcao((prev) => ({ ...prev, [upper]: feed.id }));
  }, []);

  return {
    entries,
    expanded,
    lastFeedByIcao,
    addSession,
    togglePin,
    removeSession,
    setExpanded,
    rememberFeed,
  };
}
