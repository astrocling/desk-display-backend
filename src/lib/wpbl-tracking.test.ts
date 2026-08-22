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
  pitchTypeAbbr,
  trackingForPlateAppearance,
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
