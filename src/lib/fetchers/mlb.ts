import type { MlbScores } from "@/lib/types/scores";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";

const NEXT_GAME_LOOKAHEAD_DAYS = 14;

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: {
    abbreviation: string;
  };
}

interface EspnCompetition {
  date: string;
  competitors: EspnCompetitor[];
  status: {
    period?: number;
    type: {
      state: "pre" | "in" | "post";
      detail?: string;
      shortDetail?: string;
    };
  };
}

interface EspnEvent {
  date: string;
  competitions: EspnCompetition[];
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

function formatInning(detail: string | undefined): string | null {
  if (!detail) {
    return null;
  }

  return detail
    .replace(/\bBottom\b/gi, "Bot")
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTeamOpponentScore(
  team: EspnCompetitor,
  opponent: EspnCompetitor,
): string {
  return `${team.score ?? "0"}-${opponent.score ?? "0"}`;
}

function findTeamEvent(
  events: EspnEvent[] | undefined,
  teamAbbr: string,
): { event: EspnEvent; competition: EspnCompetition } | null {
  if (!events?.length) {
    return null;
  }

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) {
      continue;
    }

    const hasTeam = competition.competitors?.some(
      (competitor) =>
        competitor.team.abbreviation.toUpperCase() === teamAbbr,
    );

    if (hasTeam) {
      return { event, competition };
    }
  }

  return null;
}

function pickTodayTeamGame(
  events: EspnEvent[] | undefined,
  teamAbbr: string,
): { event: EspnEvent; competition: EspnCompetition } | null {
  const matches: { event: EspnEvent; competition: EspnCompetition }[] = [];

  for (const event of events ?? []) {
    const competition = event.competitions?.[0];
    if (!competition) {
      continue;
    }

    const teamCompetitor = competition.competitors?.find(
      (competitor) =>
        competitor.team.abbreviation.toUpperCase() === teamAbbr,
    );

    if (teamCompetitor) {
      matches.push({ event, competition });
    }
  }

  if (!matches.length) {
    return null;
  }

  const statePriority = { in: 0, pre: 1, post: 2 };

  matches.sort((a, b) => {
    const aState = a.competition.status.type.state;
    const bState = b.competition.status.type.state;
    const priorityDiff = statePriority[aState] - statePriority[bState];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return (
      new Date(a.event.date).getTime() - new Date(b.event.date).getTime()
    );
  });

  return matches[0];
}

function buildMlbResult(
  teamAbbr: string,
  competition: EspnCompetition,
  nextGameIso: string | null,
): MlbScores {
  const teamCompetitor = competition.competitors.find(
    (competitor) => competitor.team.abbreviation.toUpperCase() === teamAbbr,
  );
  const opponentCompetitor = competition.competitors.find(
    (competitor) => competitor !== teamCompetitor,
  );

  if (!teamCompetitor || !opponentCompetitor) {
    return {
      live: false,
      score: null,
      inning: null,
      nextGame: nextGameIso,
    };
  }

  const state = competition.status.type.state;

  if (state === "in") {
    return {
      live: true,
      score: formatTeamOpponentScore(teamCompetitor, opponentCompetitor),
      inning: formatInning(competition.status.type.detail),
      nextGame: null,
    };
  }

  if (state === "post") {
    return {
      live: false,
      score: formatTeamOpponentScore(teamCompetitor, opponentCompetitor),
      inning: null,
      nextGame: nextGameIso,
    };
  }

  return {
    live: false,
    score: null,
    inning: null,
    nextGame: competition.date ?? nextGameIso,
  };
}

function formatEspnDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function fetchScoreboard(date?: string): Promise<EspnScoreboard> {
  const url = date
    ? `${ESPN_SCOREBOARD_URL}?dates=${date}`
    : ESPN_SCOREBOARD_URL;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed: ${response.status}`);
  }

  return (await response.json()) as EspnScoreboard;
}

async function findNextScheduledGame(
  teamAbbr: string,
  startOffsetDays = 1,
): Promise<string | null> {
  const today = new Date();

  for (
    let offset = startOffsetDays;
    offset <= NEXT_GAME_LOOKAHEAD_DAYS;
    offset++
  ) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);

    const scoreboard = await fetchScoreboard(formatEspnDate(date));
    const match = findTeamEvent(scoreboard.events, teamAbbr);

    if (
      match &&
      match.competition.status.type.state === "pre"
    ) {
      return match.competition.date ?? match.event.date;
    }
  }

  return null;
}

export async function fetchMlb(teamAbbr: string): Promise<MlbScores> {
  const team = teamAbbr.toUpperCase();
  const todayScoreboard = await fetchScoreboard();
  const todayGame = pickTodayTeamGame(todayScoreboard.events, team);

  if (todayGame) {
    const state = todayGame.competition.status.type.state;
    let nextGameIso: string | null = null;

    if (state === "pre") {
      nextGameIso = todayGame.competition.date ?? todayGame.event.date;
    } else if (state === "post") {
      nextGameIso = await findNextScheduledGame(team, 1);
    }

    return buildMlbResult(team, todayGame.competition, nextGameIso);
  }

  const nextGame = await findNextScheduledGame(team, 0);

  return {
    live: false,
    score: null,
    inning: null,
    nextGame,
  };
}
