"use client";

import { StandingsTable } from "./StandingsTable";
import {
  WpblBoardError,
  WpblBoardLoading,
  WpblSectionTitle,
  WpblUpdatedLine,
} from "./WpblBoardShell";
import { useWpblBoardData } from "./useWpblBoardData";

export function WpblStandingsClient() {
  const { league, leagueError, loading, hasLive, updatedAt } =
    useWpblBoardData();

  if (loading) return <WpblBoardLoading />;
  if (!league && leagueError) {
    return <WpblBoardError message={leagueError} />;
  }
  if (!league) return null;

  return (
    <div className="mt-6 space-y-6">
      <WpblUpdatedLine updatedAt={updatedAt} hasLive={hasLive} />
      <section>
        <WpblSectionTitle>Standings</WpblSectionTitle>
        <StandingsTable rows={league.standings} variant="full" />
      </section>
    </div>
  );
}
