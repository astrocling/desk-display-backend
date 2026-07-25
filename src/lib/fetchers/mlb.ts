import type { MlbScores } from "@/lib/types/scores";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";
const ESPN_SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary";
const ESPN_TEAM_URL =
  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams";
const ESPN_STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings";

const NEXT_GAME_LOOKAHEAD_DAYS = 14;

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: {
    abbreviation: string;
    shortDisplayName?: string;
    name?: string;
  };
}

interface EspnSituationAthlete {
  id?: string;
  shortName?: string;
  displayName?: string;
}

interface EspnSituationPlayer {
  playerId?: number | string;
  summary?: string;
  athlete?: EspnSituationAthlete;
}

interface EspnSituation {
  balls?: number;
  strikes?: number;
  outs?: number;
  onFirst?: boolean;
  onSecond?: boolean;
  onThird?: boolean;
  batter?: EspnSituationPlayer;
  pitcher?: EspnSituationPlayer;
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
  situation?: EspnSituation;
}

interface EspnEvent {
  id?: string;
  date: string;
  competitions: EspnCompetition[];
}

interface EspnGameSummary {
  boxscore?: {
    players?: Array<{
      statistics?: Array<{
        type?: string;
        labels?: string[];
        athletes?: Array<{ athlete?: { id?: string }; stats?: string[] }>;
      }>;
    }>;
  };
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

interface EspnStandingStat {
  name: string;
  displayValue?: string;
  value?: number;
}

interface EspnStandingEntry {
  team: {
    abbreviation: string;
  };
  stats: EspnStandingStat[];
}

interface EspnStandingsResponse {
  shortName?: string;
  name?: string;
  standings?: {
    entries?: EspnStandingEntry[];
  };
}

interface NextScheduledGame {
  iso: string;
  competition: EspnCompetition;
}

interface DivisionStanding {
  record: string;
  standingLine: string;
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

function competitorNickname(competitor: EspnCompetitor): string {
  return (
    competitor.team.shortDisplayName ||
    competitor.team.name ||
    competitor.team.abbreviation
  );
}

function formatMatchup(
  teamAbbr: string,
  competition: EspnCompetition,
): string | null {
  const teamCompetitor = competition.competitors?.find(
    (competitor) =>
      competitor.team.abbreviation.toUpperCase() === teamAbbr,
  );
  const opponentCompetitor = competition.competitors?.find(
    (competitor) => competitor !== teamCompetitor,
  );

  if (!teamCompetitor || !opponentCompetitor) {
    return null;
  }

  const usNick = competitorNickname(teamCompetitor);
  const oppNick = competitorNickname(opponentCompetitor);

  if (teamCompetitor.homeAway === "home") {
    return `${usNick} vs. ${oppNick}`;
  }

  return `${usNick} @ ${oppNick}`;
}

function matchupParticipants(
  teamAbbr: string,
  competition: EspnCompetition,
): { teamAbbr: string; opponentAbbr: string; homeAway: "home" | "away" } | null {
  const teamCompetitor = competition.competitors?.find(
    (c) => c.team.abbreviation.toUpperCase() === teamAbbr,
  );
  const opponent = competition.competitors?.find((c) => c !== teamCompetitor);
  if (!teamCompetitor || !opponent) return null;
  return {
    teamAbbr: teamCompetitor.team.abbreviation.toUpperCase(),
    opponentAbbr: opponent.team.abbreviation.toUpperCase(),
    homeAway: teamCompetitor.homeAway,
  };
}

/** Format an ISO instant as Eastern wall time, e.g. "Fri 7/24 7:40 PM". */
export function formatWhenEt(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

  return formatted
    .replace(/,/g, "")
    .replace(/[\s\u00a0\u202f]+/g, " ")
    .trim()
    .replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
}

function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function findStat(
  stats: EspnStandingStat[] | undefined,
  name: string,
): EspnStandingStat | undefined {
  return stats?.find((stat) => stat.name === name);
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

function parseRunCount(score: string | undefined): number | null {
  if (score === undefined || score === "") {
    return null;
  }
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function situationPlayerName(player: EspnSituationPlayer | undefined): string | null {
  const name = player?.athlete?.shortName || player?.athlete?.displayName;
  return name?.trim() ? name.trim() : null;
}

function situationSummary(player: EspnSituationPlayer | undefined): string | null {
  const s = player?.summary?.trim();
  return s ? s : null;
}

function situationPlayerId(player: EspnSituationPlayer | undefined): string | null {
  if (player?.playerId !== undefined && player.playerId !== null) {
    return String(player.playerId);
  }
  const athleteId = player?.athlete?.id?.trim();
  return athleteId ? athleteId : null;
}

function boxscoreStat(
  summary: EspnGameSummary,
  playerId: string,
  statType: "batting" | "pitching",
  label: string,
): string | null {
  for (const group of summary.boxscore?.players ?? []) {
    for (const block of group.statistics ?? []) {
      if (block.type !== statType) continue;
      const idx = (block.labels ?? []).indexOf(label);
      if (idx < 0) continue;
      for (const row of block.athletes ?? []) {
        if (String(row.athlete?.id ?? "") !== playerId) continue;
        const v = row.stats?.[idx]?.trim();
        if (v) return v;
      }
    }
  }
  return null;
}

async function fetchGameSummary(eventId: string): Promise<EspnGameSummary | null> {
  try {
    const response = await fetch(
      `${ESPN_SUMMARY_URL}?event=${encodeURIComponent(eventId)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return null;
    return (await response.json()) as EspnGameSummary;
  } catch {
    return null;
  }
}

function emptyLiveSituation(): Pick<
  MlbScores,
  | "teamRuns"
  | "opponentRuns"
  | "balls"
  | "strikes"
  | "outs"
  | "onFirst"
  | "onSecond"
  | "onThird"
  | "batterName"
  | "batterAvg"
  | "batterSummary"
  | "pitcherName"
  | "pitcherEra"
  | "pitcherSummary"
> {
  return {
    teamRuns: null,
    opponentRuns: null,
    balls: null,
    strikes: null,
    outs: null,
    onFirst: null,
    onSecond: null,
    onThird: null,
    batterName: null,
    batterAvg: null,
    batterSummary: null,
    pitcherName: null,
    pitcherEra: null,
    pitcherSummary: null,
  };
}

function buildScoreFields(
  teamAbbr: string,
  competition: EspnCompetition,
  nextGameIso: string | null,
): Pick<
  MlbScores,
  | "live"
  | "score"
  | "inning"
  | "nextGame"
  | "teamRuns"
  | "opponentRuns"
  | "balls"
  | "strikes"
  | "outs"
  | "onFirst"
  | "onSecond"
  | "onThird"
  | "batterName"
  | "batterAvg"
  | "batterSummary"
  | "pitcherName"
  | "pitcherEra"
  | "pitcherSummary"
> {
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
      ...emptyLiveSituation(),
    };
  }

  const state = competition.status.type.state;
  const teamRuns = parseRunCount(teamCompetitor.score);
  const opponentRuns = parseRunCount(opponentCompetitor.score);

  if (state === "in") {
    const sit = competition.situation;
    return {
      live: true,
      score: formatTeamOpponentScore(teamCompetitor, opponentCompetitor),
      inning: formatInning(competition.status.type.detail),
      nextGame: null,
      teamRuns,
      opponentRuns,
      balls: typeof sit?.balls === "number" ? sit.balls : null,
      strikes: typeof sit?.strikes === "number" ? sit.strikes : null,
      outs: typeof sit?.outs === "number" ? sit.outs : null,
      onFirst: typeof sit?.onFirst === "boolean" ? sit.onFirst : null,
      onSecond: typeof sit?.onSecond === "boolean" ? sit.onSecond : null,
      onThird: typeof sit?.onThird === "boolean" ? sit.onThird : null,
      batterName: situationPlayerName(sit?.batter),
      batterAvg: null,
      batterSummary: situationSummary(sit?.batter),
      pitcherName: situationPlayerName(sit?.pitcher),
      pitcherEra: null,
      pitcherSummary: situationSummary(sit?.pitcher),
    };
  }

  if (state === "post") {
    return {
      live: false,
      score: formatTeamOpponentScore(teamCompetitor, opponentCompetitor),
      inning: null,
      nextGame: nextGameIso,
      teamRuns,
      opponentRuns,
      balls: null,
      strikes: null,
      outs: null,
      onFirst: null,
      onSecond: null,
      onThird: null,
      batterName: null,
      batterAvg: null,
      batterSummary: null,
      pitcherName: null,
      pitcherEra: null,
      pitcherSummary: null,
    };
  }

  return {
    live: false,
    score: null,
    inning: null,
    nextGame: competition.date ?? nextGameIso,
    ...emptyLiveSituation(),
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
): Promise<NextScheduledGame | null> {
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

    if (match && match.competition.status.type.state === "pre") {
      return {
        iso: match.competition.date ?? match.event.date,
        competition: match.competition,
      };
    }
  }

  return null;
}

async function fetchTeamDivisionGroupId(teamAbbr: string): Promise<string> {
  const response = await fetch(`${ESPN_TEAM_URL}/${teamAbbr}`);

  if (!response.ok) {
    throw new Error(`ESPN team request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    team?: { groups?: { id?: string } };
  };
  const groupId = data.team?.groups?.id;

  if (!groupId) {
    throw new Error(`ESPN team response missing groups.id for ${teamAbbr}`);
  }

  return groupId;
}

function formatGamesUpOrBehind(
  rank: number,
  teamGb: EspnStandingStat | undefined,
  secondGb: EspnStandingStat | undefined,
): string {
  const display = teamGb?.displayValue?.trim();
  const isLeader =
    rank === 1 || display === "-" || teamGb?.value === 0;

  if (isLeader) {
    if (
      secondGb?.displayValue &&
      secondGb.displayValue !== "-"
    ) {
      return `${secondGb.displayValue} GU`;
    }
    if (typeof secondGb?.value === "number" && Number.isFinite(secondGb.value)) {
      return `${String(secondGb.value).replace(/\.0$/, "")} GU`;
    }
    return "0 GU";
  }

  if (display && display !== "-") {
    return `${display} GB`;
  }

  if (typeof teamGb?.value === "number" && Number.isFinite(teamGb.value)) {
    return `${String(teamGb.value).replace(/\.0$/, "")} GB`;
  }

  return "0 GB";
}

function buildStandingLine(
  rank: number,
  divShort: string,
  entries: EspnStandingEntry[],
  teamEntry: EspnStandingEntry,
): string {
  const teamGb = findStat(teamEntry.stats, "divisionGamesBehind");
  const secondGb =
    entries.length > 1
      ? findStat(entries[1].stats, "divisionGamesBehind")
      : undefined;
  const gbOrGu = formatGamesUpOrBehind(rank, teamGb, secondGb);
  return `${formatOrdinal(rank)} ${divShort} · ${gbOrGu}`;
}

async function fetchDivisionStanding(
  teamAbbr: string,
): Promise<DivisionStanding | null> {
  try {
    const groupId = await fetchTeamDivisionGroupId(teamAbbr);
    const response = await fetch(
      `${ESPN_STANDINGS_URL}?group=${encodeURIComponent(groupId)}`,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as EspnStandingsResponse;
    const entries = data.standings?.entries ?? [];
    const teamIndex = entries.findIndex(
      (entry) => entry.team.abbreviation.toUpperCase() === teamAbbr,
    );

    if (teamIndex < 0) {
      return null;
    }

    const teamEntry = entries[teamIndex];
    const overall = findStat(teamEntry.stats, "overall")?.displayValue;
    const wins = findStat(teamEntry.stats, "wins")?.displayValue;
    const losses = findStat(teamEntry.stats, "losses")?.displayValue;
    const record =
      overall ||
      (wins !== undefined && losses !== undefined
        ? `${wins}-${losses}`
        : null);

    if (!record) {
      return null;
    }

    const divShort = data.shortName || data.name;
    if (!divShort) {
      return null;
    }

    const rank = teamIndex + 1;

    return {
      record,
      standingLine: buildStandingLine(rank, divShort, entries, teamEntry),
    };
  } catch {
    return null;
  }
}

function withDisplayFields(
  scoreFields: ReturnType<typeof buildScoreFields>,
  matchupCompetition: EspnCompetition | null,
  teamAbbr: string,
  standing: DivisionStanding | null,
): MlbScores {
  const matchup =
    !scoreFields.live && matchupCompetition
      ? formatMatchup(teamAbbr, matchupCompetition)
      : null;
  const whenEt =
    !scoreFields.live && scoreFields.nextGame
      ? formatWhenEt(scoreFields.nextGame)
      : null;

  // Live and not-live: prefer participants from the competition that owns the
  // score/matchup context (today's game while live/pre/post, else next game).
  const parts = matchupCompetition
    ? matchupParticipants(teamAbbr, matchupCompetition)
    : null;

  return {
    ...scoreFields,
    matchup,
    whenEt,
    record: standing?.record ?? null,
    standingLine: standing?.standingLine ?? null,
    teamAbbr: teamAbbr.toUpperCase(),
    opponentAbbr: parts?.opponentAbbr ?? null,
    homeAway: parts?.homeAway ?? null,
  };
}

export interface FetchMlbOptions {
  /** Reuse standings from a prior blob; skips ESPN standings fetch. */
  preserveStanding?: Pick<MlbScores, "record" | "standingLine"> | null;
}

export async function fetchMlb(
  teamAbbr: string,
  options?: FetchMlbOptions,
): Promise<MlbScores> {
  const team = teamAbbr.toUpperCase();
  const todayScoreboard = await fetchScoreboard();
  const todayGame = pickTodayTeamGame(todayScoreboard.events, team);
  const standingPromise = options?.preserveStanding
    ? Promise.resolve(
        options.preserveStanding.record || options.preserveStanding.standingLine
          ? {
              record: options.preserveStanding.record ?? "",
              standingLine: options.preserveStanding.standingLine ?? "",
            }
          : null,
      )
    : fetchDivisionStanding(team);

  if (todayGame) {
    const state = todayGame.competition.status.type.state;

    if (state === "in") {
      const scoreFields = buildScoreFields(team, todayGame.competition, null);
      const eventId = todayGame.event.id;
      const sit = todayGame.competition.situation;
      let batterAvg: string | null = null;
      let pitcherEra: string | null = null;
      if (eventId) {
        const summary = await fetchGameSummary(String(eventId));
        if (summary) {
          const batterId = situationPlayerId(sit?.batter);
          const pitcherId = situationPlayerId(sit?.pitcher);
          if (batterId) {
            batterAvg = boxscoreStat(summary, batterId, "batting", "AVG");
          }
          if (pitcherId) {
            pitcherEra = boxscoreStat(summary, pitcherId, "pitching", "ERA");
          }
        }
      }
      const standing = await standingPromise;
      return withDisplayFields(
        { ...scoreFields, batterAvg, pitcherEra },
        todayGame.competition,
        team,
        standing,
      );
    }

    if (state === "pre") {
      const nextGameIso =
        todayGame.competition.date ?? todayGame.event.date;
      const scoreFields = buildScoreFields(
        team,
        todayGame.competition,
        nextGameIso,
      );
      const standing = await standingPromise;
      return withDisplayFields(
        scoreFields,
        todayGame.competition,
        team,
        standing,
      );
    }

    // Final today — look ahead for next scheduled game in parallel with standings.
    const [nextGame, standing] = await Promise.all([
      findNextScheduledGame(team, 1),
      standingPromise,
    ]);
    const scoreFields = buildScoreFields(
      team,
      todayGame.competition,
      nextGame?.iso ?? null,
    );
    return withDisplayFields(
      scoreFields,
      nextGame?.competition ?? null,
      team,
      standing,
    );
  }

  const [nextGame, standing] = await Promise.all([
    findNextScheduledGame(team, 0),
    standingPromise,
  ]);

  return withDisplayFields(
    {
      live: false,
      score: null,
      inning: null,
      nextGame: nextGame?.iso ?? null,
      ...emptyLiveSituation(),
    },
    nextGame?.competition ?? null,
    team,
    standing,
  );
}
