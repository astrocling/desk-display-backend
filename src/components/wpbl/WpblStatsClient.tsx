"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { WpblRacesResponse } from "@/lib/types/wpbl-display";

import { AwardWatch } from "./AwardWatch";
import { FeaturedRaces } from "./FeaturedRaces";
import { LeadersBoards } from "./LeadersBoards";
import {
  findCategory,
  isChartableRaceId,
  parseStatGroup,
  type ChartableRaceId,
  type StatGroup,
} from "./leadersCategories";
import { PlayerCompare } from "./PlayerCompare";
import { RaceChart } from "./RaceChart";
import { TeamFilter, type WpblTeamFilter } from "./TeamFilter";
import { TeamSeriesCards } from "./TeamSeriesCards";
import {
  WpblBoardError,
  WpblBoardLoading,
  WpblSectionTitle,
  WpblUpdatedLine,
} from "./WpblBoardShell";
import { useWpblBoardData } from "./useWpblBoardData";

function parseTeamFilter(raw: string | null): WpblTeamFilter {
  if (raw === "LA" || raw === "NY" || raw === "SF" || raw === "BOS") {
    return raw;
  }
  return "ALL";
}

function writeStatsUrl(params: {
  group: StatGroup;
  cat: string;
  team: WpblTeamFilter;
  race: ChartableRaceId;
}) {
  const url = new URL(window.location.href);
  url.searchParams.set("group", params.group);
  url.searchParams.set("cat", params.cat);
  if (params.team === "ALL") url.searchParams.delete("team");
  else url.searchParams.set("team", params.team);
  if (params.race === "hr") url.searchParams.delete("race");
  else url.searchParams.set("race", params.race);
  window.history.replaceState(null, "", url.pathname + url.search);
}

export function WpblStatsClient() {
  const searchParams = useSearchParams();
  const { league, leaders, leadersError, loading, hasLive, updatedAt } =
    useWpblBoardData({ includeLeaders: true });

  const [teamFilter, setTeamFilter] = useState<WpblTeamFilter>(() =>
    parseTeamFilter(searchParams.get("team")),
  );
  const [group, setGroup] = useState<StatGroup>(
    () => parseStatGroup(searchParams.get("group")) ?? "hitting",
  );
  const [categoryId, setCategoryId] = useState(
    () => searchParams.get("cat") ?? "hr",
  );
  const [raceId, setRaceId] = useState<ChartableRaceId>(() => {
    const raw = searchParams.get("race");
    return isChartableRaceId(raw) ? raw : "hr";
  });

  const [races, setRaces] = useState<WpblRacesResponse | null>(null);
  const [racesLoading, setRacesLoading] = useState(true);
  const [racesError, setRacesError] = useState<string | null>(null);

  useEffect(() => {
    const nextTeam = parseTeamFilter(searchParams.get("team"));
    const nextGroup = parseStatGroup(searchParams.get("group"));
    const nextCat = searchParams.get("cat");
    const nextRace = searchParams.get("race");
    setTeamFilter(nextTeam);
    if (nextGroup) setGroup(nextGroup);
    if (nextCat) setCategoryId(nextCat);
    if (isChartableRaceId(nextRace)) setRaceId(nextRace);
  }, [searchParams]);

  useEffect(() => {
    writeStatsUrl({ group, cat: categoryId, team: teamFilter, race: raceId });
  }, [group, categoryId, teamFilter, raceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRacesLoading(true);
      try {
        const res = await fetch("/api/wpbl/races");
        if (!res.ok) {
          if (!cancelled) {
            setRacesError(
              res.status === 503
                ? "Race chart not ready — leaders cache may still be empty."
                : `Race chart failed (${res.status})`,
            );
            setRaces(null);
          }
          return;
        }
        const body = (await res.json()) as WpblRacesResponse;
        if (!cancelled) {
          setRaces(body);
          setRacesError(null);
        }
      } catch {
        if (!cancelled) {
          setRacesError("Race chart failed — network error.");
          setRaces(null);
        }
      } finally {
        if (!cancelled) setRacesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncCategory = useCallback((nextCat: string) => {
    const cat = findCategory(nextCat);
    if (cat) {
      setGroup(cat.group);
      setCategoryId(cat.id);
      if (isChartableRaceId(cat.id)) setRaceId(cat.id);
      document
        .getElementById("wpbl-full-leaders")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const games = useMemo(() => league?.games ?? [], [league]);

  if (loading) return <WpblBoardLoading />;

  return (
    <div className="mt-6 space-y-8">
      <WpblUpdatedLine updatedAt={updatedAt} hasLive={hasLive} />
      <TeamFilter value={teamFilter} onChange={setTeamFilter} />

      {!leaders ? (
        <WpblBoardError
          className=""
          message={leadersError ?? "Leaders unavailable."}
        />
      ) : (
        <>
          <section>
            <WpblSectionTitle>Featured races</WpblSectionTitle>
            <FeaturedRaces
              leaders={leaders}
              teamFilter={teamFilter}
              onSelectCategory={syncCategory}
              activeCategoryId={categoryId}
            />
          </section>

          <section>
            <RaceChart
              races={races}
              raceId={raceId}
              onRaceIdChange={setRaceId}
              loading={racesLoading}
              error={racesError}
            />
          </section>

          <section id="wpbl-full-leaders">
            <WpblSectionTitle>All leaders</WpblSectionTitle>
            <LeadersBoards
              leaders={leaders}
              teamFilter={teamFilter}
              group={group}
              onGroupChange={setGroup}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              showGapBars
            />
          </section>

          <section>
            <WpblSectionTitle>Award watch</WpblSectionTitle>
            <AwardWatch leaders={leaders} />
          </section>

          <section>
            <WpblSectionTitle>Head to head</WpblSectionTitle>
            <PlayerCompare leaders={leaders} />
          </section>
        </>
      )}

      {games.length > 0 ? (
        <section>
          <WpblSectionTitle>Team series</WpblSectionTitle>
          <TeamSeriesCards games={games} />
        </section>
      ) : null}
    </div>
  );
}
