"use client";

import { useMemo, useState } from "react";

import { ScheduleList } from "./ScheduleList";
import {
  TeamFilter,
  gameInvolvesTeam,
  type WpblTeamFilter,
} from "./TeamFilter";
import {
  WpblBoardError,
  WpblBoardLoading,
  WpblSectionTitle,
  WpblUpdatedLine,
} from "./WpblBoardShell";
import { sortWpblSchedule } from "./scheduleSort";
import { useWpblBoardData } from "./useWpblBoardData";

export function WpblScheduleClient() {
  const { league, leagueError, loading, hasLive, updatedAt } =
    useWpblBoardData();
  const [teamFilter, setTeamFilter] = useState<WpblTeamFilter>("ALL");

  const filteredSchedule = useMemo(() => {
    if (!league) return [];
    const sorted = sortWpblSchedule(league.games);
    if (teamFilter === "ALL") return sorted;
    return sorted.filter((g) => gameInvolvesTeam(g, teamFilter));
  }, [league, teamFilter]);

  if (loading) return <WpblBoardLoading />;
  if (!league && leagueError) {
    return <WpblBoardError message={leagueError} />;
  }
  if (!league) return null;

  return (
    <div className="mt-6 space-y-6">
      <WpblUpdatedLine updatedAt={updatedAt} hasLive={hasLive} />
      <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      <section>
        <WpblSectionTitle>Schedule</WpblSectionTitle>
        <ScheduleList games={filteredSchedule} variant="week" />
      </section>
    </div>
  );
}
