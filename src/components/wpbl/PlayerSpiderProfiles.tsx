"use client";

import { useEffect, useMemo, useState } from "react";

import { WPBL_PANEL } from "@/lib/wpbl-board";
import {
  buildPlayerSpiderProfiles,
  type WpblSpiderProfile,
} from "@/lib/wpbl-spider-profile";
import { wpblTeamPrimary } from "@/lib/wpbl-team-brand";
import type {
  WpblLeadersResponse,
  WpblPlayerBattingSeason,
  WpblPlayerPitchingSeason,
} from "@/lib/types/wpbl-display";

import { SpiderProfileChart } from "./SpiderProfileChart";

export type PlayerSpiderProfilesProps = {
  batting: WpblPlayerBattingSeason | null;
  pitching: WpblPlayerPitchingSeason | null;
  teamAbbr: string;
};

/**
 * Loads `/api/wpbl/leaders` and renders batting/pitching spider charts when
 * enough axes can be scored against the league boards.
 */
export function PlayerSpiderProfiles({
  batting,
  pitching,
  teamAbbr,
}: PlayerSpiderProfilesProps) {
  const [leaders, setLeaders] = useState<WpblLeadersResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/wpbl/leaders", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as WpblLeadersResponse;
        if (!cancelled) setLeaders(json);
      } catch {
        // Soft-fail: hide spiders if leaders are unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profiles = useMemo(() => {
    if (!leaders) return null;
    return buildPlayerSpiderProfiles({ batting, pitching }, leaders);
  }, [batting, pitching, leaders]);

  const charts: WpblSpiderProfile[] = [];
  if (profiles?.batting) charts.push(profiles.batting);
  if (profiles?.pitching) charts.push(profiles.pitching);
  if (charts.length === 0) return null;

  const accent = wpblTeamPrimary(teamAbbr);

  return (
    <section className={WPBL_PANEL}>
      <div className="border-b border-[var(--wpbl-rule)] px-4 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-[var(--wpbl-ink)]">
          Season profile
        </h2>
        <p className="mt-0.5 text-[11px] wpbl-muted">
          Spider chart of league percentiles — no TrackMan required.
        </p>
      </div>
      <div className="grid gap-6 px-4 py-5 sm:grid-cols-2 sm:px-6">
        {charts.map((profile) => (
          <SpiderProfileChart
            key={profile.kind}
            profile={profile}
            accent={accent}
          />
        ))}
      </div>
    </section>
  );
}
