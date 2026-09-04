"use client";

import { useMemo } from "react";

import { LeadersBoards } from "./LeadersBoards";
import { ScheduleList } from "./ScheduleList";
import { StandingsTable } from "./StandingsTable";
import { TodaysGamesSection } from "./LiveGamesSection";
import {
  WpblBoardError,
  WpblBoardLoading,
  WpblSectionHeader,
  WpblUpdatedLine,
} from "./WpblBoardShell";
import { homeScheduleTeaserGames, todaysSlateGames } from "./scheduleWeek";
import { useWpblBoardData } from "./useWpblBoardData";

const HOME_LEADERS_LIMIT = 5;

/** League home digest: slate + compact standings + schedule/stats teasers. */
export function WpblHomeClient() {
  const {
    league,
    leaders,
    leagueError,
    leadersError,
    loading,
    hasLive,
    liveRefreshKey,
    updatedAt,
  } = useWpblBoardData({ includeLeaders: true });

  const todayGames = useMemo(
    () => (league ? todaysSlateGames(league.games) : []),
    [league],
  );

  const teaserGames = useMemo(() => {
    if (!league) return [];
    const excludeIds = new Set(todayGames.map((g) => g.id));
    return homeScheduleTeaserGames(league.games, { excludeIds });
  }, [league, todayGames]);

  if (loading) return <WpblBoardLoading />;

  if (!league && leagueError) {
    return <WpblBoardError message={leagueError} />;
  }

  if (!league) return null;

  return (
    <div className="mt-6 space-y-8">
      <WpblUpdatedLine updatedAt={updatedAt} hasLive={hasLive} />

      <TodaysGamesSection
        games={todayGames}
        standings={league.standings}
        refreshKey={liveRefreshKey}
      />

      <section>
        <WpblSectionHeader
          title="Standings"
          href="/wpbl/standings"
          linkLabel="Full standings →"
        />
        <StandingsTable rows={league.standings} variant="compact" />
      </section>

      {teaserGames.length > 0 ? (
        <section>
          <WpblSectionHeader
            title="Up next"
            href="/wpbl/schedule"
            linkLabel="Full schedule →"
          />
          <ScheduleList games={teaserGames} variant="flat" />
        </section>
      ) : null}

      <section>
        <WpblSectionHeader
          title="Leaders"
          href="/wpbl/stats"
          linkLabel="All stats →"
        />
        {leaders ? (
          <LeadersBoards
            leaders={leaders}
            teamFilter="ALL"
            limit={HOME_LEADERS_LIMIT}
            initialCategoryId="hr"
            compact
          />
        ) : (
          <WpblBoardError
            className=""
            message={leadersError ?? "Leaders unavailable."}
          />
        )}
      </section>
    </div>
  );
}

/** @deprecated Prefer WpblHomeClient */
export const WpblLeagueClient = WpblHomeClient;
