import {
  applyWpblLiveEnvelope,
  parseWpblLiveEnvelope,
  type WpblLiveEnvelope,
} from "@/lib/fetchers/wpbl-v1/live-merge";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

export const WPBL_LIVE_WS_HOST = "stats.womensprobaseballleague.com";

/** Official public live feed URL for a game. */
export function wpblLiveWsUrl(gameId: string): string {
  const channels = `game:${gameId},boxscore:${gameId}`;
  return `wss://${WPBL_LIVE_WS_HOST}/v1/ws?channels=${encodeURIComponent(channels)}`;
}

export type WpblLiveConnection = "connecting" | "live" | "reconnecting" | "idle";

export type WpblLiveSocketHandlers = {
  onConnection: (status: WpblLiveConnection) => void;
  onEnvelope: (envelope: WpblLiveEnvelope) => void;
};

/**
 * Open a reconnecting WebSocket to the WPBL live feed.
 * Returns a dispose function that stops reconnects and closes the socket.
 */
export function connectWpblLiveSocket(
  gameId: string,
  handlers: WpblLiveSocketHandlers,
): () => void {
  let disposed = false;
  let socket: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnect = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    handlers.onConnection("reconnecting");
    clearReconnect();
    const delay = Math.min(30_000, 1000 * Math.pow(1.8, reconnectAttempt));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (disposed) return;
    clearReconnect();
    handlers.onConnection(reconnectAttempt === 0 ? "connecting" : "reconnecting");

    try {
      socket = new WebSocket(wpblLiveWsUrl(gameId));
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      if (disposed) return;
      reconnectAttempt = 0;
      handlers.onConnection("live");
    };

    socket.onmessage = (event) => {
      if (disposed) return;
      try {
        const parsed = JSON.parse(String(event.data)) as unknown;
        const envelope = parseWpblLiveEnvelope(parsed);
        if (envelope.type === "subscribed") {
          handlers.onConnection("live");
          return;
        }
        if (envelope.type === "ignored") return;
        handlers.onEnvelope(envelope);
      } catch {
        // Ignore malformed frames; keep the socket open.
      }
    };

    socket.onerror = () => {
      // onclose will schedule reconnect.
    };

    socket.onclose = () => {
      socket = null;
      if (disposed) return;
      scheduleReconnect();
    };
  };

  connect();

  return () => {
    disposed = true;
    clearReconnect();
    handlers.onConnection("idle");
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socket = null;
    }
  };
}

/** Merge helper exposed for tests / callers that already parsed an envelope. */
export function mergeLiveEnvelope(
  prior: WpblGameDetailResponse,
  envelope: WpblLiveEnvelope,
): WpblGameDetailResponse {
  return applyWpblLiveEnvelope(prior, envelope);
}
