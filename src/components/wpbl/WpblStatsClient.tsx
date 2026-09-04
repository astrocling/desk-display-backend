"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { WpblRacesResponse } from "@/lib/types/wpbl-display";

import { AwardWatch } from "./AwardWatch";
import { RaceMatchup, RacePicker, RaceStandings } from "./FeaturedRaces";
import { LeadersBoards } from "./LeadersBoards";
import {
  findCategory,
  isChartableRaceId,
  parseStatGroup,
  type ChartableRaceId,
  type StatGroup,
} from "./leadersCategories";
import { RaceChart } from "./RaceChart";
import { TeamFilter, type WpblTeamFilter } from "./TeamFilter";
import { TeamSeriesCards } from "./TeamSeriesCards";
import { WpblDetailTabs } from "./WpblDetailTabs";
import {
  WpblBoardError,
  WpblBoardLoading,
  WpblUpdatedLine,
} from "./WpblBoardShell";
import { useWpblBoardData } from "./useWpblBoardData";

type StatsView = "races" | "leaders" | "awards" | "series";

const STATS_VIEWS: { id: StatsView; label: string }[] = [
  { id: "races", label: "Races" },
  { id: "leaders", label: "Leaders" },
  { id: "awards", label: "Awards" },
  { id: "series", label: "Series" },
];

function parseTeamFilter(raw: string | null): WpblTeamFilter {
  if (raw === "LA" || raw === "NY" || raw === "SF" || raw === "BOS") {
    return raw;
  }
  return "ALL";
}

function parseStatsView(raw: string | null): StatsView {
  if (
    raw === "races" ||
    raw === "leaders" ||
    raw === "awards" ||
    raw === "series"
  ) {
    return raw;
  }
  return "races";
}

function writeStatsUrl(params: {
  view: StatsView;
  group: StatGroup;
  cat: string;
  team: WpblTeamFilter;
  race: ChartableRaceId;
}) {
  const url = new URL(window.location.href);
  if (params.view === "races") url.searchParams.delete("view");
  else url.searchParams.set("view", params.view);
  url.searchParams.set("group", params.group);
  url.searchParams.set("cat", params.cat);
  if (params.team === "ALL") url.searchParams.delete("team");
  else url.searchParams.set("team", params.team);
  if (params.race === "hr") url.searchParams.delete("race");
  else url.searchParams.set("race", params.race);
  window.history.replaceState(null, "", url.pathname + url.search);
}

function scrollRaceFocusToTop() {
  // Defer until the races panel (and chart) are painted after a view switch.
  requestAnimationFrame(() => {
    document
      .getElementById("wpbl-race-focus")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function WpblStatsClient() {
  const searchParams = useSearchParams();
  const { league, leaders, leadersError, loading, hasLive, updatedAt } =
    useWpblBoardData({ includeLeaders: true });

  const [view, setView] = useState<StatsView>(() =>
    parseStatsView(searchParams.get("view")),
  );
  const [teamFilter, setTeamFilter] = useState<WpblTeamFilter>(() =>
    parseTeamFilter(searchParams.get("team")),
  );
  const [group, setGroup] = useState<StatGroup>(() => {
    const fromUrl = parseStatGroup(searchParams.get("group"));
    const cat = findCategory(searchParams.get("cat") ?? "hr");
    return fromUrl ?? cat?.group ?? "hitting";
  });
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
    const nextView = parseStatsView(searchParams.get("view"));
    const nextTeam = parseTeamFilter(searchParams.get("team"));
    const nextCat = searchParams.get("cat");
    const nextGroup =
      parseStatGroup(searchParams.get("group")) ??
      (nextCat ? findCategory(nextCat)?.group : undefined);
    const nextRace = searchParams.get("race");
    setView(nextView);
    setTeamFilter(nextTeam);
    if (nextGroup) setGroup(nextGroup);
    if (nextCat) setCategoryId(nextCat);
    if (isChartableRaceId(nextRace)) setRaceId(nextRace);
  }, [searchParams]);

  useEffect(() => {
    writeStatsUrl({
      view,
      group,
      cat: categoryId,
      team: teamFilter,
      race: raceId,
    });
  }, [view, group, categoryId, teamFilter, raceId]);

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

  const selectRace = useCallback((nextCat: string) => {
    const cat = findCategory(nextCat);
    if (!cat) return;
    setView("races");
    setGroup(cat.group);
    setCategoryId(cat.id);
    if (isChartableRaceId(cat.id)) setRaceId(cat.id);
    scrollRaceFocusToTop();
  }, []);

  const setViewAndFocus = useCallback((next: StatsView) => {
    setView(next);
    requestAnimationFrame(() => {
      document
        .getElementById("wpbl-stats-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const games = useMemo(() => league?.games ?? [], [league]);
  const showChart = isChartableRaceId(categoryId);
  const chartRaceId: ChartableRaceId = showChart ? categoryId : raceId;

  if (loading) return <WpblBoardLoading />;

  return (
    <div className="mt-6 space-y-4">
      <WpblUpdatedLine updatedAt={updatedAt} hasLive={hasLive} />
      <TeamFilter value={teamFilter} onChange={setTeamFilter} />

      <div className="wpbl-stats-tabs sticky top-0 z-20 -mx-4 bg-[var(--wpbl-bg)]/95 px-4 py-2 backdrop-blur-sm">
        <WpblDetailTabs
          tabs={STATS_VIEWS}
          active={view}
          onChange={setViewAndFocus}
          ariaLabel="Stats sections"
        />
      </div>

      <div id="wpbl-stats-panel" className="wpbl-stats-panel">
        {!leaders ? (
          <WpblBoardError
            className=""
            message={leadersError ?? "Leaders unavailable."}
          />
        ) : null}

        {leaders && view === "races" ? (
          <div id="wpbl-race-focus" className="space-y-4">
            <RacePicker
              leaders={leaders}
              teamFilter={teamFilter}
              activeCategoryId={categoryId}
              onSelectCategory={selectRace}
            />

            {showChart ? (
              <RaceChart
                races={races}
                raceId={chartRaceId}
                loading={racesLoading}
                error={racesError}
              />
            ) : (
              <p className="text-[11px] wpbl-muted">
                Rate / counting board — chart available for HR, RBI, SB, SO.
              </p>
            )}

            <RaceMatchup
              leaders={leaders}
              teamFilter={teamFilter}
              categoryId={categoryId}
            />

            <RaceStandings
              leaders={leaders}
              teamFilter={teamFilter}
              categoryId={categoryId}
            />
          </div>
        ) : null}

        {leaders && view === "leaders" ? (
          <LeadersBoards
            leaders={leaders}
            teamFilter={teamFilter}
            group={group}
            onGroupChange={setGroup}
            categoryId={categoryId}
            onCategoryChange={(id) => {
              setCategoryId(id);
              const cat = findCategory(id);
              if (cat) setGroup(cat.group);
              if (isChartableRaceId(id)) setRaceId(id);
            }}
            showGapBars
          />
        ) : null}

        {leaders && view === "awards" ? (
          <AwardWatch leaders={leaders} />
        ) : null}

        {view === "series" ? (
          games.length > 0 ? (
            <TeamSeriesCards games={games} />
          ) : (
            <p className="text-sm wpbl-muted">No completed series yet.</p>
          )
        ) : null}
      </div>
    </div>
  );
}
