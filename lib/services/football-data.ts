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

/**
 * Manual result overrides. football-data has these matches wrong or stale and
 * keeps reverting them on every sync, which silently corrupts the standings.
 * We pin the correct score here so it is re-applied on EVERY sync and can never
 * be lost. Matched on team names (order-agnostic). The status is forced to
 * FINISHED and the result derived from the score below. Add an entry only when
 * the upstream feed is demonstrably wrong for a settled match.
 */
const MANUAL_RESULTS: { test: (home: string, away: string) => boolean; homeScore: number; awayScore: number }[] = [
  // Canada 1–1 Bosnia and Herzegovina (Jun 12) — upstream never settled it.
  {
    test: (h, a) => {
      const s = `${h} ${a}`.toLowerCase();
      return s.includes("canada") && s.includes("bosnia");
    },
    homeScore: 1,
    awayScore: 1,
  },
];

function resultFromScore(home: number, away: number): MatchResult {
  if (home > away) return "H";
  if (away > home) return "A";
  return "T";
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

  return fdMatches.flatMap((m): Match[] => {
    const round: Round | undefined = STAGE_MAP[m.stage];
    if (!round) {
      console.warn(`[football-data] Unknown stage "${m.stage}" for match ${m.id} — skipping`);
      return [];
    }
    const status = mapStatus(m.status);

    const homeScore =
      m.score?.penalties?.home != null ? m.score.penalties!.home :
      m.score?.extraTime?.home != null ? m.score.extraTime!.home :
      m.score?.fullTime?.home ?? null;

    const awayScore =
      m.score?.penalties?.away != null ? m.score.penalties!.away :
      m.score?.extraTime?.away != null ? m.score.extraTime!.away :
      m.score?.fullTime?.away ?? null;

    const homeTeam = m.homeTeam?.name || m.homeTeam?.tla || "TBD";
    const awayTeam = m.awayTeam?.name || m.awayTeam?.tla || "TBD";

    // Apply any pinned manual result — upstream is wrong/stale for these and
    // keeps reverting them. Forced on every sync so it can never be overridden.
    const override = MANUAL_RESULTS.find(o => o.test(homeTeam, awayTeam));

    return [{
      matchId:     String(m.id),
      round,
      homeTeam,
      awayTeam,
      result:      override ? resultFromScore(override.homeScore, override.awayScore)
                   : status === "FINISHED" ? mapResult(m.score?.winner ?? null, m.stage) : null,
      status:      override ? "FINISHED" : status,
      kickoffUtc:  m.utcDate,
      pointsValue: ROUND_CONFIG[round].pointsValue,
      homeScore:   override ? override.homeScore : homeScore,
      awayScore:   override ? override.awayScore : awayScore,
    }];
  });
}
