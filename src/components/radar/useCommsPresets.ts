"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  addSession: (icao: string) => void;
  togglePin: (icao: string) => void;
  removeSession: (icao: string) => void;
  setExpanded: (expanded: boolean) => void;
};

function readStored(): ReturnType<typeof parseCommsPresetsStored> {
  if (typeof window === "undefined") {
    return { pinnedIcaos: [], expanded: false };
  }
  try {
    return parseCommsPresetsStored(
      window.localStorage.getItem(COMMS_PRESETS_STORAGE_KEY),
    );
  } catch {
    return { pinnedIcaos: [], expanded: false };
  }
}

function writeStored(pinnedIcaos: string[], expanded: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMMS_PRESETS_STORAGE_KEY,
      serializeCommsPresetsStored({ pinnedIcaos, expanded }),
    );
  } catch {
    // private mode / quota — keep in-memory only
  }
}

export function useCommsPresets(): CommsPresets {
  const [pinnedIcaos, setPinnedIcaos] = useState<string[]>([]);
  const [sessionIcaos, setSessionIcaos] = useState<string[]>([]);
  const [expanded, setExpandedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setPinnedIcaos(stored.pinnedIcaos);
    setExpandedState(stored.expanded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(pinnedIcaos, expanded);
  }, [pinnedIcaos, expanded, hydrated]);

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

  return {
    entries,
    expanded,
    addSession,
    togglePin,
    removeSession,
    setExpanded,
  };
}
