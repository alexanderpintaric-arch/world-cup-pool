import type { Match, MatchResult, MatchStatus, Round } from "../types";
import { STAGE_MAP, ROUND_CONFIG } from "../constants";

const BASE = "https://api.football-data.org/v4";
const WC_CODE = "WC";

function headers() {
  return { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY! };
}

interface FDMatch {
  id: number;
  stage: string;
  status: string;
  utcDate: string;
  homeTeam: { name?: string; tla?: string } | null;
  awayTeam: { name?: string; tla?: string } | null;
  score: {
    winner: string | null;
    fullTime?: { home: number | null; away: number | null } | null;
    extraTime?: { home: number | null; away: number | null } | null;
    penalties?: { home: number | null; away: number | null } | null;
  } | null;
}

function mapResult(winner: string | null, stage: string): MatchResult {
  if (!winner) return null;
  if (winner === "DRAW") return "T";
  if (winner === "HOME_TEAM") return "H";
  if (winner === "AWAY_TEAM") return "A";
  return null;
}

function mapStatus(s: string): MatchStatus {
  const valid = ["SCHEDULED","LIVE","IN_PLAY","PAUSED","FINISHED","POSTPONED","SUSPENDED","CANCELLED"];
  return valid.includes(s) ? (s as MatchStatus) : "SCHEDULED";
}

export async function fetchAllWCMatches(): Promise<Match[]> {
  const res = await fetch(`${BASE}/competitions/${WC_CODE}/matches`, {
    headers: headers(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const fdMatches: FDMatch[] = data.matches ?? [];

  return fdMatches.map((m): Match => {
    const round: Round = STAGE_MAP[m.stage] ?? "GROUP";
    const status = mapStatus(m.status);

    const homeScore =
      m.score?.penalties?.home != null ? m.score.penalties!.home :
      m.score?.extraTime?.home != null ? m.score.extraTime!.home :
      m.score?.fullTime?.home ?? null;

    const awayScore =
      m.score?.penalties?.away != null ? m.score.penalties!.away :
      m.score?.extraTime?.away != null ? m.score.extraTime!.away :
      m.score?.fullTime?.away ?? null;

    return {
      matchId:     String(m.id),
      round,
      homeTeam:    m.homeTeam?.name || m.homeTeam?.tla || "TBD",
      awayTeam:    m.awayTeam?.name || m.awayTeam?.tla || "TBD",
      result:      status === "FINISHED" ? mapResult(m.score?.winner ?? null, m.stage) : null,
      status,
      kickoffUtc:  m.utcDate,
      pointsValue: ROUND_CONFIG[round].pointsValue,
      homeScore,
      awayScore,
    };
  });
}
