import type { WpblLeaderEntry, WpblLeadersResponse } from "@/lib/types/wpbl-display";

export type StatGroup = "hitting" | "pitching";

export type CategoryDef = {
  id: string;
  label: string;
  group: StatGroup;
  /** Counting stats support gap-to-leader bars and race charts. */
  counting?: boolean;
  /** Lower sortValue ranks higher (ERA, WHIP). */
  ascending?: boolean;
  qualifierNote?: (qualifiers: WpblLeadersResponse["qualifiers"]) => string;
  getEntries: (leaders: WpblLeadersResponse) => WpblLeaderEntry[];
};

function ipQualifierNote(q: WpblLeadersResponse["qualifiers"]): string {
  return `min ${(q.pitchingMinOuts / 3).toFixed(1).replace(/\.0$/, "")} IP`;
}

export const LEADER_CATEGORIES: CategoryDef[] = [
  {
    id: "avg",
    label: "AVG",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.avg ?? [],
  },
  {
    id: "obp",
    label: "OBP",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.obp ?? [],
  },
  {
    id: "slg",
    label: "SLG",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.slg ?? [],
  },
  {
    id: "ops",
    label: "OPS",
    group: "hitting",
    qualifierNote: (q) => `min ${q.battingMinAb} AB`,
    getEntries: (l) => l.batting.ops ?? [],
  },
  {
    id: "hr",
    label: "HR",
    group: "hitting",
    counting: true,
    getEntries: (l) => l.batting.hr ?? [],
  },
  {
    id: "rbi",
    label: "RBI",
    group: "hitting",
    counting: true,
    getEntries: (l) => l.batting.rbi ?? [],
  },
  {
    id: "h",
    label: "H",
    group: "hitting",
    counting: true,
    getEntries: (l) => l.batting.h ?? [],
  },
  {
    id: "r",
    label: "R",
    group: "hitting",
    counting: true,
    getEntries: (l) => l.batting.r ?? [],
  },
  {
    id: "doubles",
    label: "2B",
    group: "hitting",
    counting: true,
    getEntries: (l) => l.batting.doubles ?? [],
  },
  {
    id: "sb",
    label: "SB",
    group: "hitting",
    counting: true,
    getEntries: (l) => l.batting.sb ?? [],
  },
  {
    id: "era",
    label: "ERA",
    group: "pitching",
    ascending: true,
    qualifierNote: ipQualifierNote,
    getEntries: (l) => l.pitching.era ?? [],
  },
  {
    id: "whip",
    label: "WHIP",
    group: "pitching",
    ascending: true,
    qualifierNote: ipQualifierNote,
    getEntries: (l) => l.pitching.whip ?? [],
  },
  {
    id: "ip",
    label: "IP",
    group: "pitching",
    qualifierNote: ipQualifierNote,
    getEntries: (l) => l.pitching.ip ?? [],
  },
  {
    id: "so",
    label: "SO",
    group: "pitching",
    counting: true,
    getEntries: (l) => l.pitching.so ?? [],
  },
  {
    id: "w",
    label: "W",
    group: "pitching",
    counting: true,
    getEntries: (l) => l.pitching.w ?? [],
  },
  {
    id: "l",
    label: "L",
    group: "pitching",
    counting: true,
    getEntries: (l) => l.pitching.l ?? [],
  },
  {
    id: "sv",
    label: "SV",
    group: "pitching",
    counting: true,
    getEntries: (l) => l.pitching.sv ?? [],
  },
];

/** Featured boards on the stats race dashboard. */
export const FEATURED_RACE_IDS = [
  "hr",
  "rbi",
  "ops",
  "avg",
  "era",
  "so",
  "w",
  "sv",
] as const;

/** Counting races that can be charted from game logs. */
export const CHARTABLE_RACE_IDS = ["hr", "rbi", "sb", "so"] as const;

export type ChartableRaceId = (typeof CHARTABLE_RACE_IDS)[number];

export function categoriesWithData(
  leaders: WpblLeadersResponse,
  group: StatGroup,
): CategoryDef[] {
  return LEADER_CATEGORIES.filter(
    (c) => c.group === group && c.getEntries(leaders).length > 0,
  );
}

export function findCategory(id: string): CategoryDef | undefined {
  return LEADER_CATEGORIES.find((c) => c.id === id);
}

export type RankedLeaderEntry = WpblLeaderEntry & {
  /** 1-based rank in the full (unfiltered) board. */
  leagueRank: number;
};

export function rankAndFilterEntries(
  entries: WpblLeaderEntry[],
  teamFilter: string,
  limit: number,
): RankedLeaderEntry[] {
  const ranked = entries.map((entry, i) => ({
    ...entry,
    leagueRank: i + 1,
  }));
  const filtered =
    teamFilter === "ALL"
      ? ranked
      : ranked.filter((e) => e.teamAbbr === teamFilter);
  return filtered.slice(0, limit);
}

export function parseStatGroup(raw: string | null): StatGroup | null {
  if (raw === "hitting" || raw === "pitching") return raw;
  return null;
}

export function isChartableRaceId(raw: string | null): raw is ChartableRaceId {
  return (
    raw === "hr" || raw === "rbi" || raw === "sb" || raw === "so"
  );
}
