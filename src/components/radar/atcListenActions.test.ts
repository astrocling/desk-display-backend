import { describe, expect, it, vi } from "vitest";
import { beginListenToAirport } from "./atcListenActions";

describe("beginListenToAirport", () => {
  it("adds session, expands, selects, and plays when switching airport", () => {
    const addSession = vi.fn();
    const setExpanded = vi.fn();
    const selectAirport = vi.fn();
    const play = vi.fn(async () => {});
    const toggle = vi.fn(async () => {});
    beginListenToAirport({
      icao: "KDAY",
      activeIcao: "KIND",
      status: "playing",
      selectAirport,
      play,
      toggle,
      addSession,
      setExpanded,
    });
    expect(addSession).toHaveBeenCalledWith("KDAY");
    expect(setExpanded).toHaveBeenCalledWith(true);
    expect(selectAirport).toHaveBeenCalledWith("KDAY");
    expect(play).toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
  });

  it("toggles stop when already playing this airport", () => {
    const toggle = vi.fn(async () => {});
    const addSession = vi.fn();
    const setExpanded = vi.fn();
    const play = vi.fn(async () => {});
    const selectAirport = vi.fn();
    beginListenToAirport({
      icao: "KIND",
      activeIcao: "KIND",
      status: "playing",
      selectAirport,
      play,
      toggle,
      addSession,
      setExpanded,
    });
    expect(toggle).toHaveBeenCalled();
    expect(addSession).not.toHaveBeenCalled();
    expect(setExpanded).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(selectAirport).not.toHaveBeenCalled();
  });

  it("starts play when active but idle on the same airport", () => {
    const addSession = vi.fn();
    const setExpanded = vi.fn();
    const play = vi.fn(async () => {});
    const toggle = vi.fn(async () => {});
    const selectAirport = vi.fn();
    beginListenToAirport({
      icao: "KIND",
      activeIcao: "KIND",
      status: "idle",
      selectAirport,
      play,
      toggle,
      addSession,
      setExpanded,
    });
    expect(addSession).toHaveBeenCalledWith("KIND");
    expect(setExpanded).toHaveBeenCalledWith(true);
    expect(play).toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
  });
});
