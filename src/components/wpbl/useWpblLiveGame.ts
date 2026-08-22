"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyWpblLiveEnvelope,
  type WpblLiveEnvelope,
} from "@/lib/fetchers/wpbl-v1/live-merge";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";
import {
  connectWpblLiveSocket,
  type WpblLiveConnection,
} from "@/lib/wpbl-live-ws";

/** Poll when the socket is down / unknown. */
const POLL_DISCONNECTED_MS = 10_000;
/** Slow safety poll while the live socket is healthy. */
const POLL_CONNECTED_MS = 45_000;

export type UseWpblLiveGameOptions = {
  /** When false, only the initial HTTP fetch runs (no WS / live poll). */
  enabled?: boolean;
};

export type UseWpblLiveGameResult = {
  data: WpblGameDetailResponse | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
  connection: WpblLiveConnection;
  reload: () => Promise<boolean>;
};

export function useWpblLiveGame(
  gameId: string,
  options: UseWpblLiveGameOptions = {},
): UseWpblLiveGameResult {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<WpblGameDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<WpblLiveConnection>("idle");

  const hasDataRef = useRef(false);
  const dataRef = useRef<WpblGameDetailResponse | null>(null);
  const connectionRef = useRef<WpblLiveConnection>("idle");

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/wpbl/games/${gameId}`);

      if (res.status === 404) {
        if (!hasDataRef.current) {
          setNotFound(true);
          setData(null);
          setError(null);
        }
        return false;
      }

      if (!res.ok) {
        if (!hasDataRef.current) {
          let detail: string | null = null;
          try {
            const body = (await res.json()) as { error?: unknown };
            detail =
              typeof body.error === "string" && body.error.trim()
                ? body.error.trim()
                : null;
          } catch {
            detail = null;
          }
          setError(detail ?? `Game fetch failed (${res.status})`);
          setData(null);
        }
        return false;
      }

      const json = (await res.json()) as WpblGameDetailResponse;
      setData(json);
      setNotFound(false);
      setError(null);
      hasDataRef.current = true;
      return true;
    } catch {
      if (!hasDataRef.current) {
        setError("Game fetch failed — network error.");
        setData(null);
      }
      return false;
    }
  }, [gameId]);

  // Initial HTTP load (and whenever the game id changes).
  useEffect(() => {
    let cancelled = false;
    hasDataRef.current = false;
    setData(null);
    setNotFound(false);
    setError(null);
    setConnection("idle");

    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const isLive = data?.game.status === "live";
  const liveActive = enabled && Boolean(isLive);

  // Official live websocket while the game is in progress.
  useEffect(() => {
    if (!liveActive || !hasDataRef.current) {
      setConnection("idle");
      return;
    }

    const dispose = connectWpblLiveSocket(gameId, {
      onConnection: setConnection,
      onEnvelope: (envelope: WpblLiveEnvelope) => {
        const prior = dataRef.current;
        if (!prior) return;
        const next = applyWpblLiveEnvelope(prior, envelope);
        dataRef.current = next;
        setData(next);
      },
    });

    return () => {
      dispose();
      setConnection("idle");
    };
  }, [gameId, liveActive]);

  // HTTP poll: faster when disconnected, slow safety net while WS is live.
  useEffect(() => {
    if (!liveActive) return;

    const ms =
      connection === "live" ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS;
    const timer = window.setInterval(() => {
      void load();
    }, ms);

    return () => window.clearInterval(timer);
  }, [liveActive, load, connection]);

  return {
    data,
    loading,
    notFound,
    error,
    connection,
    reload: load,
  };
}
