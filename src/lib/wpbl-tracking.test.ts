import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  mapWpblTrackingActivity,
  mapWpblTrackingEvent,
} from "@/lib/fetchers/wpbl-v1/boxscore";
import {
  applyWpblLiveEnvelope,
  parseWpblLiveEnvelope,
} from "@/lib/fetchers/wpbl-v1/live-merge";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";
import {
  buildPitchChips,
  chipsForPlay,
  displayTrackingName,
  filterTrackingFeed,
  plateLocationCall,
  pitchTypeAbbr,
  strikeZonePoints,
  trackingForPlateAppearance,
  trackingMetricChips,
} from "@/lib/wpbl-tracking";

const trackingFixture = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "fetchers/wpbl-v1/fixtures/tracking-trimmed.json",
    ),
    "utf8",
  ),
);

describe("mapWpblTrackingActivity", () => {
  it("maps TrackMan rows oldest-first", () => {
    const rows = mapWpblTrackingActivity(trackingFixture.tracking_activity);
    expect(rows.length).toBe(7);
    expect(rows[0]).toMatchObject({
      kind: "pitch",
      pitchType: "Fastball",
      batterName: "Maximiliana, Thaima",
      releaseSpeed: 70.7023,
    });
    expect(rows.at(-1)).toMatchObject({
      kind: "hit",
      exitSpeed: 30.61357,
      batterName: "Eccles, Claire",
    });
  });

  it("maps a single live envelope payload", () => {
    const event = mapWpblTrackingEvent(trackingFixture.tracking_activity[0]);
    expect(event?.activityId).toContain("8bcc14cd");
    expect(event?.pitchType).toBe("Fastball");
  });
});

describe("pitch chips + live tracking merge", () => {
  it("abbreviates pitch types", () => {
    expect(pitchTypeAbbr("Fastball")).toBe("FB");
    expect(pitchTypeAbbr("ChangeUp")).toBe("CH");
    expect(pitchTypeAbbr("FourSeamFastBall")).toBe("FF");
  });

  it("matches Last, First batter names for a plate appearance", () => {
    const rows = mapWpblTrackingActivity(trackingFixture.tracking_activity);
    const pa = trackingForPlateAppearance(rows, {
      batterName: "Claire Eccles",
      inning: 7,
      half: "bottom",
    });
    expect(pa).toHaveLength(5);
    expect(pa.every((r) => r.inning === 7)).toBe(true);
  });

  it("uses TrackMan mid-PA when play feed only has the prior AB", () => {
    const tracking = mapWpblTrackingActivity(trackingFixture.tracking_activity);
    const { chips, source, label } = buildPitchChips(
      {
        inningNumber: 7,
        half: "bottom",
        balls: 1,
        strikes: 2,
        outs: 1,
        onFirst: false,
        onSecond: false,
        onThird: false,
        runnerFirst: null,
        runnerSecond: null,
        runnerThird: null,
        batterName: "Claire Eccles",
        pitcherName: "Meggie Meidlinger",
      },
      [
        {
          sequence: 50,
          inning: 7,
          half: "bottom",
          outs: 1,
          batterName: "Someone Else",
          pitcherName: "Meggie Meidlinger",
          runnerFirst: null,
          runnerSecond: null,
          runnerThird: null,
          narrative: "Someone Else struck out.",
          eventType: "strikeout",
          isHit: false,
          isScoringPlay: false,
          runsScored: 0,
          pitchSequence: "KKS",
          pitchEvents: [],
          finalBalls: 0,
          finalStrikes: 3,
          finalFouls: 0,
        },
      ],
      tracking,
    );
    expect(source).toBe("current");
    expect(label).toBe("This at-bat");
    expect(chips.length).toBe(5);
    expect(chips[0]!.pitchTypeAbbr).toBe("FB");
    expect(chips[0]!.releaseMph).toBe(71.3);
  });

  it("parses and applies tracking_activity_updated envelopes", () => {
    const prior: WpblGameDetailResponse = {
      updatedAt: "2026-08-21T12:00:00.000Z",
      game: {
        id: "g1",
        status: "live",
        startIso: null,
        whenEt: null,
        awayAbbr: "LA",
        homeAbbr: "NY",
        awayName: "Queens",
        homeName: "Heights",
        awayRuns: 1,
        homeRuns: 2,
        venue: null,
        countsInStandings: true,
        gameType: "regular",
        inning: "Top 4",
        situation: null,
      },
      boxscore: {
        available: true,
        lineScore: null,
        batting: [],
        pitching: [],
        plays: [],
        tracking: [],
      },
    };

    const envelope = parseWpblLiveEnvelope({
      type: "tracking_activity_updated",
      data: { new_value: trackingFixture.tracking_activity[0] },
    });
    expect(envelope.type).toBe("tracking");

    const next = applyWpblLiveEnvelope(prior, envelope);
    expect(next.boxscore.tracking).toHaveLength(1);
    expect(next.boxscore.tracking[0]!.releaseSpeed).toBe(70.7023);

    const again = applyWpblLiveEnvelope(next, envelope);
    expect(again.boxscore.tracking).toHaveLength(1);
  });
});

describe("TrackMan feed helpers", () => {
  const rows = () =>
    mapWpblTrackingActivity(trackingFixture.tracking_activity);

  it("flips Last, First display names", () => {
    expect(displayTrackingName("Eccles, Claire")).toBe("Claire Eccles");
    expect(displayTrackingName("Claire Eccles")).toBe("Claire Eccles");
  });

  it("builds metric chips for pitch and contact", () => {
    const pitch = rows().find((r) => r.kind === "pitch")!;
    const hit = rows().find((r) => r.kind === "hit")!;
    expect(trackingMetricChips(pitch).map((c) => c.text)).toEqual(
      expect.arrayContaining(["Fastball", "70.7 mph", "1937 rpm"]),
    );
    expect(trackingMetricChips(hit).some((c) => c.impact)).toBe(true);
    expect(trackingMetricChips(hit).map((c) => c.text)).toEqual(
      expect.arrayContaining([
        "Fastball",
        "30.6 mph exit",
        "Ground Ball",
      ]),
    );
  });

  it("filters newest-first feed by kind", () => {
    const all = filterTrackingFeed(rows(), "all");
    expect(all[0]!.kind).toBe("hit");
    expect(filterTrackingFeed(rows(), "hits")).toHaveLength(1);
    expect(filterTrackingFeed(rows(), "pitches").every((r) => r.kind === "pitch")).toBe(
      true,
    );
  });

  it("enriches a completed play’s pitch chips with TrackMan", () => {
    const tracking = rows();
    const chips = chipsForPlay(
      {
        sequence: 99,
        inning: 7,
        half: "bottom",
        outs: 1,
        batterName: "Claire Eccles",
        pitcherName: "Meggie Meidlinger",
        runnerFirst: null,
        runnerSecond: null,
        runnerThird: null,
        narrative: "Claire Eccles grounded out (1-2).",
        eventType: "groundout",
        isHit: false,
        isScoringPlay: false,
        runsScored: 0,
        pitchSequence: "BBBX",
        pitchEvents: [],
        finalBalls: 1,
        finalStrikes: 2,
        finalFouls: 0,
      },
      tracking,
    );
    expect(chips).toHaveLength(4);
    expect(chips[0]).toMatchObject({
      label: "B",
      pitchTypeAbbr: "FB",
      releaseMph: 71.3,
    });
    expect(chips[3]).toMatchObject({
      label: "X",
      pitchTypeAbbr: "FB",
      exitMph: 30.6,
    });
  });

  it("maps plate location and classifies in/out of zone", () => {
    const tracking = rows();
    expect(tracking[0]!.plateLocationHeight).toBeCloseTo(1.19814);
    expect(tracking[0]!.plateLocationSide).toBeCloseTo(0.17601);
    // height ~1.2 is below the 1.5–3.5 window → out
    expect(plateLocationCall(tracking[0]!)).toBe("out");
    const points = strikeZonePoints(tracking);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toMatchObject({
      key: expect.any(String),
      side: expect.any(Number),
      height: expect.any(Number),
    });
  });
});
