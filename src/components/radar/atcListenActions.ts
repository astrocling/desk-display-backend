import type { AtcRadioStatus } from "./useAtcRadio";

/**
 * Pure click orchestration for "Listen" controls: adds the airport to the
 * Comms session rack, expands the panel, and starts/stops playback.
 */
export function beginListenToAirport(opts: {
  icao: string;
  activeIcao: string | null;
  status: AtcRadioStatus;
  selectAirport: (icao: string) => void;
  play: () => Promise<void>;
  toggle: () => Promise<void>;
  addSession: (icao: string) => void;
  setExpanded: (expanded: boolean) => void;
}): void {
  const upper = opts.icao.trim().toUpperCase();
  const isActive = opts.activeIcao === upper;
  const isPlaying =
    isActive && (opts.status === "playing" || opts.status === "loading");
  if (!isActive) {
    opts.addSession(upper);
    opts.setExpanded(true);
    opts.selectAirport(upper);
    void opts.play();
    return;
  }
  if (isPlaying) {
    void opts.toggle();
    return;
  }
  // active but idle — start play and ensure rack/panel
  opts.addSession(upper);
  opts.setExpanded(true);
  void opts.play();
}
