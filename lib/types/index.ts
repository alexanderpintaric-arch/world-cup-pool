export type Round =
  | "GROUP"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL";

export type MatchResult = "H" | "A" | "T" | null; // Home / Away / Tie / not yet played
export type MatchStatus = "SCHEDULED" | "LIVE" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED";

export interface Match {
  matchId: string;
  round: Round;
  homeTeam: string;
  awayTeam: string;
  result: MatchResult;
  status: MatchStatus;
  kickoffUtc: string; // ISO string
  pointsValue: number;
  homeScore: number | null;
  awayScore: number | null;
}

export interface Pick {
  email: string;
  matchId: string;
  round: Round;
  pick: MatchResult;
  leagueId: string;
  submittedAt: string;
  updatedAt: string;
}

export interface User {
  email: string;
  name: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  email: string;
  name: string;
  totalScore: number;
  maxPossibleScore: number;
  scoreByRound: Record<Round, number>;
  correctPicks: number;
  totalPicks: number;
  tiebreaker?: {
    finalHomeScore: number | null;
    finalAwayScore: number | null;
    goldenBoot: string | null;
  };
}

export interface RoundState {
  round: Round;
  label: string;
  pointsValue: number;
  isOpen: boolean;       // any match in round still pickable
  isAvailable: boolean;  // previous round is complete (or this is the first round)
  isComplete: boolean;   // all matches finished
  deadline: string | null; // ISO string — next upcoming kickoff in round
  matchCount: number;
}

export interface OddsData {
  matchId: string;
  homeOdds: number | null;   // decimal
  drawOdds: number | null;
  awayOdds: number | null;
  homeProb: number | null;   // 0-100
  drawProb: number | null;
  awayProb: number | null;
  updatedAt: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt: string;
}

export type LeagueRole = "owner" | "member";

export interface LeagueWithRole extends League {
  role: LeagueRole;
  memberCount: number;
}

export interface SyncResult {
  matchesUpdated: number;
  roundsOpened: string[];
  emailsSent: number;
  error?: string;
  syncedAt: string;
}
