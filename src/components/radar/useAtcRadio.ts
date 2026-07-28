"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultFeedForIcao,
  getFeedById,
  isCatalogIcao,
} from "@/lib/atc/feeds";

export type AtcRadioStatus = "idle" | "loading" | "playing" | "error";

type ResolveResponse = {
  feed?: { id: string };
  streamUrl?: string;
  streamUrls?: string[];
  listenUrl?: string;
  error?: string;
};

export type AtcRadio = {
  activeIcao: string | null;
  activeFeedId: string | null;
  status: AtcRadioStatus;
  error: string | null;
  /** Active HTTPS Icecast stream URL (HTML5 audio). */
  streamUrl: string | null;
  /** External LiveATC page (new tab). */
  listenUrl: string | null;
  /** Set active ICAO + default feed; does not auto-play. */
  selectAirport: (icao: string) => void;
  selectFeed: (feedId: string) => void;
  play: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
};

function stopAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.onerror = null;
  audio.onplaying = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

/**
 * Shared ATC radio state for CommsPanel / Listen buttons.
 * Plays LiveATC Icecast MP3 via HTMLAudioElement (iframes are blocked).
 */
export function useAtcRadio(): AtcRadio {
  const [activeIcao, setActiveIcao] = useState<string | null>(null);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const [status, setStatus] = useState<AtcRadioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [listenUrl, setListenUrl] = useState<string | null>(null);

  const statusRef = useRef<AtcRadioStatus>("idle");
  const feedIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopAudio(audioRef.current);
    audioRef.current = null;
    statusRef.current = "idle";
    setStreamUrl(null);
    setListenUrl(null);
    setError(null);
    setStatus("idle");
  }, []);

  const selectAirport = useCallback(
    (icao: string) => {
      const upper = icao.trim().toUpperCase();
      if (!isCatalogIcao(upper)) return;

      const wasPlaying =
        statusRef.current === "playing" || statusRef.current === "loading";
      if (wasPlaying) stop();

      const feed = defaultFeedForIcao(upper);
      feedIdRef.current = feed?.id ?? null;
      setActiveIcao(upper);
      setActiveFeedId(feed?.id ?? null);
      setError(null);
    },
    [stop],
  );

  const selectFeed = useCallback(
    (feedId: string) => {
      const feed = getFeedById(feedId);
      if (!feed) return;

      const wasPlaying =
        statusRef.current === "playing" || statusRef.current === "loading";
      if (wasPlaying) stop();

      feedIdRef.current = feed.id;
      setActiveIcao(feed.icao);
      setActiveFeedId(feed.id);
      setError(null);
    },
    [stop],
  );

  const play = useCallback(async () => {
    const feedId = feedIdRef.current;
    if (!feedId) {
      statusRef.current = "error";
      setError("No feed selected");
      setStatus("error");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    stopAudio(audioRef.current);
    audioRef.current = null;

    statusRef.current = "loading";
    setStatus("loading");
    setError(null);
    setStreamUrl(null);
    setListenUrl(null);

    try {
      const res = await fetch(
        `/api/atc/resolve?feed=${encodeURIComponent(feedId)}`,
        { signal: controller.signal },
      );
      const data = (await res.json()) as ResolveResponse;

      if (!res.ok) {
        throw new Error(data.error ?? `Resolve failed (${res.status})`);
      }

      const candidates =
        data.streamUrls?.length
          ? data.streamUrls
          : data.streamUrl
            ? [data.streamUrl]
            : [];

      if (candidates.length === 0) {
        throw new Error("No stream URL returned");
      }

      if (controller.signal.aborted) return;

      setListenUrl(data.listenUrl ?? null);

      await new Promise<void>((resolve, reject) => {
        let index = 0;
        let settled = false;

        const finishOk = () => {
          if (settled || controller.signal.aborted) return;
          settled = true;
          statusRef.current = "playing";
          setStatus("playing");
          setError(null);
          resolve();
        };

        const finishErr = (message: string) => {
          if (settled || controller.signal.aborted) return;
          settled = true;
          reject(new Error(message));
        };

        const tryNext = () => {
          if (controller.signal.aborted) {
            finishOk();
            return;
          }
          if (index >= candidates.length) {
            finishErr("Stream unavailable");
            return;
          }

          const url = candidates[index++]!;
          stopAudio(audioRef.current);
          const audio = new Audio(url);
          audio.preload = "none";
          audioRef.current = audio;
          setStreamUrl(url);

          audio.onplaying = () => {
            finishOk();
          };

          audio.onerror = () => {
            tryNext();
          };

          void audio.play().then(finishOk).catch(() => {
            tryNext();
          });
        };

        tryNext();
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Failed to start ATC audio";
      stopAudio(audioRef.current);
      audioRef.current = null;
      statusRef.current = "error";
      setStreamUrl(null);
      setError(message);
      setStatus("error");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const toggle = useCallback(async () => {
    if (
      statusRef.current === "playing" ||
      statusRef.current === "loading"
    ) {
      stop();
      return;
    }
    await play();
  }, [play, stop]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      stopAudio(audioRef.current);
      audioRef.current = null;
    };
  }, []);

  return {
    activeIcao,
    activeFeedId,
    status,
    error,
    streamUrl,
    listenUrl,
    selectAirport,
    selectFeed,
    play,
    stop,
    toggle,
  };
}
