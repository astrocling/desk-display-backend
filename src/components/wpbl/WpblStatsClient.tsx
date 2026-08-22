"use client";

import { useState } from "react";

import { LeadersBoards } from "./LeadersBoards";
import { TeamFilter, type WpblTeamFilter } from "./TeamFilter";
import {
  WpblBoardError,
  WpblBoardLoading,
  WpblSectionTitle,
  WpblUpdatedLine,
} from "./WpblBoardShell";
import { useWpblBoardData } from "./useWpblBoardData";

export function WpblStatsClient() {
  const { leaders, leadersError, loading, hasLive, updatedAt } =
    useWpblBoardData({ includeLeaders: true });
  const [teamFilter, setTeamFilter] = useState<WpblTeamFilter>("ALL");

  if (loading) return <WpblBoardLoading />;

  return (
    <div className="mt-6 space-y-6">
      <WpblUpdatedLine updatedAt={updatedAt} hasLive={hasLive} />
      <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      <section>
        <WpblSectionTitle>Leaders</WpblSectionTitle>
        {leaders ? (
          <LeadersBoards leaders={leaders} teamFilter={teamFilter} />
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
