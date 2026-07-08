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
  // Switzerland 0–0 Colombia (Jul 7), Switzerland won 4–3 on penalties —
  // upstream had Colombia as the winner.
  {
    test: (h, a) => {
      const s = `${h} ${a}`.toLowerCase();
      return s.includes("switzerland") && s.includes("colombia");
    },
    homeScore: 4,
    awayScore: 3,
  },
];

function resultFromScore(home: number, away: number): MatchResult {
  if (home > away) return "H";
  if (away > home) return "A";
  return "T";
}

/**
 * Manually pinned Round-of-32 matchups. football-data is slow to fill in the
 * knockout draw — it leaves fixtures as TBD long after the matchup is decided —
 * which leaves our bracket empty while everyone is making picks. We pin each
 * confirmed matchup here, keyed by the fixture's official kickoff (UTC); the
 * earliest-resolving sources (and our own R32_SLOTS schedule) agree on these
 * times, so the key is unambiguous (R32 fixtures are ≥3.5h apart).
 *
 * FILL-ONLY: a side is only set when the feed still has it as "TBD", so we never
 * overwrite a real team football-data has already published, and we never create
 * a duplicate. Leave a side out (undefined) for slots that genuinely aren't
 * decided yet (third-place / runner-up spots) — football-data fills those in
 * later, and the sticky-team guard in the sync then protects them.
 *
 * Team names use football-data's spelling; the flag map (lib/services/flags.ts)
 * accepts the common variants either way.
 */
const MANUAL_MATCHUPS: { kickoffUtc: string; home?: string; away?: string }[] = [
  { kickoffUtc: "2026-06-28T19:00:00Z", home: "South Africa",  away: "Canada" },                 // M73
  { kickoffUtc: "2026-06-29T17:00:00Z", home: "Brazil",        away: "Japan" },                  // M76
  { kickoffUtc: "2026-06-29T20:30:00Z", home: "Germany",       away: "Paraguay" },               // M74
  { kickoffUtc: "2026-06-30T01:00:00Z", home: "Netherlands",   away: "Morocco" },                // M75
  { kickoffUtc: "2026-06-30T17:00:00Z", home: "Ivory Coast",   away: "Norway" },                 // M78
  { kickoffUtc: "2026-06-30T21:00:00Z", home: "France",        away: "Sweden" },                 // M77
  { kickoffUtc: "2026-07-01T01:00:00Z", home: "Mexico",        away: "Ecuador" },                // M79
  { kickoffUtc: "2026-07-01T16:00:00Z", home: "England" },                                       // M80 (away: 3rd — TBD)
  { kickoffUtc: "2026-07-01T20:00:00Z", home: "Belgium" },                                       // M82 (away: 3rd — TBD)
  { kickoffUtc: "2026-07-02T00:00:00Z", home: "United States", away: "Bosnia and Herzegovina" }, // M81
  { kickoffUtc: "2026-07-02T19:00:00Z", home: "Spain" },                                         // M84 (away: 2J — TBD)
  { kickoffUtc: "2026-07-02T23:00:00Z", away: "Croatia" },                                       // M83 (home: 2K — TBD)
  { kickoffUtc: "2026-07-03T03:00:00Z", home: "Switzerland" },                                   // M85 (away: 3rd — TBD)
  { kickoffUtc: "2026-07-03T18:00:00Z", home: "Australia",     away: "Egypt" },                  // M88
  { kickoffUtc: "2026-07-03T22:00:00Z", home: "Argentina",     away: "Cape Verde" },             // M86
  { kickoffUtc: "2026-07-04T01:30:00Z", away: "Ghana" },                                         // M87 (home: 1K — TBD)
];

const MATCHUP_KEY_TOLERANCE_MS = 90 * 60 * 1000; // R32 fixtures are ≥3.5h apart

/**
 * Fill in a Round-of-32 matchup from MANUAL_MATCHUPS where the feed is still TBD.
 * Returns the (possibly updated) [home, away]. Never overwrites a real feed team
 * and never produces two identical sides.
 */
function applyManualMatchup(round: Round, kickoffUtc: string, home: string, away: string): [string, string] {
  if (round !== "ROUND_OF_32") return [home, away];
  const t = new Date(kickoffUtc).getTime();
  const m = MANUAL_MATCHUPS.find(e => Math.abs(new Date(e.kickoffUtc).getTime() - t) <= MATCHUP_KEY_TOLERANCE_MS);
  if (!m) return [home, away];
  let h = home, a = away;
  if (m.home && h === "TBD" && a !== m.home) h = m.home;
  if (m.away && a === "TBD" && h !== m.away) a = m.away;
  return [h, a];
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

    const feedHome = m.homeTeam?.name || m.homeTeam?.tla || "TBD";
    const feedAway = m.awayTeam?.name || m.awayTeam?.tla || "TBD";

    // Fill in confirmed knockout matchups the feed is lagging on (still TBD).
    const [homeTeam, awayTeam] = applyManualMatchup(round, m.utcDate, feedHome, feedAway);

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
