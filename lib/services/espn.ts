import type { Match, MatchResult } from "../types";
import { normalizeTeam, type ScoreUpdate } from "./odds";

// ── ESPN scoreboard fallback ─────────────────────────────────────────────────
// A third, independent settlement source, placed AHEAD of the Odds API /scores
// fallback. ESPN's public scoreboard API is keyless, fast (it's what powers most
// live sports widgets), and — crucially — reports the winner of a penalty
// shootout directly via each competitor's `winner` flag. That's the one thing
// football-data is slow on and the Odds API /scores literally can't tell us, so
// it's exactly what was stranding decided knockout games for hours.
//
// Endpoint (no auth): the FIFA men's World Cup league slug is `fifa.world`.
//   https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD
// We query the scoreboard for each distinct UTC day that has a still-pending
// match, then map results back onto OUR fixtures by team name (orientation-
// agnostic), so it doesn't matter which side ESPN calls "home".

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

interface EspnCompetitor {
  homeAway: "home" | "away";
  winner?: boolean;
  score?: string;
  // Present on shootout-decided games; not needed (the `winner` flag is enough)
  // but useful to recognise a penalty result.
  shootoutScore?: number;
  team?: { displayName?: string; name?: string; shortDisplayName?: string; abbreviation?: string };
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  status?: { type?: { completed?: boolean; state?: string } };
}

interface EspnEvent {
  id: string;
  date?: string;
  competitions?: EspnCompetition[];
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

function espnTeamName(c: EspnCompetitor): string {
  return c.team?.displayName || c.team?.name || c.team?.shortDisplayName || c.team?.abbreviation || "";
}

/** UTC YYYYMMDD for ESPN's `dates` query param. */
function utcYmd(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/**
 * Fetch final scores (incl. penalty-shootout winners) for still-pending matches
 * from ESPN, keyed by OUR match IDs. Only completed games are returned, and a
 * knockout tie we can't assign a winner to is skipped (left to another source)
 * rather than guessed.
 *
 * pendingMatches: matches the caller still needs settled — used both to decide
 *   which days to query and to map ESPN events back to our fixtures by name.
 */
export async function fetchWCScoresFromEspn(pendingMatches: Match[]): Promise<ScoreUpdate[]> {
  const needs = pendingMatches.filter(m => m.homeTeam !== "TBD" && m.awayTeam !== "TBD");
  if (needs.length === 0) return [];

  // Lookup by unordered, normalised team pair → our match (orientation-agnostic).
  const byPair = new Map<string, Match>();
  for (const m of needs) {
    const pair = [normalizeTeam(m.homeTeam), normalizeTeam(m.awayTeam)].sort().join("|");
    byPair.set(pair, m);
  }

  // Query each distinct UTC match day once (plus the following day, so a late
  // kickoff that ESPN files under the next calendar day is still picked up).
  const days = new Set<string>();
  for (const m of needs) {
    const t = new Date(m.kickoffUtc).getTime();
    days.add(utcYmd(m.kickoffUtc));
    days.add(utcYmd(new Date(t + 24 * 60 * 60 * 1000).toISOString()));
  }

  const events: EspnEvent[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    let board: EspnScoreboard;
    try {
      const res = await fetch(`${ESPN_SCOREBOARD}?dates=${day}`, { next: { revalidate: 0 } });
      if (!res.ok) {
        console.error(`ESPN scoreboard error ${res.status} for ${day}`);
        continue;
      }
      board = await res.json();
    } catch (e) {
      console.error(`ESPN scoreboard fetch failed for ${day} (non-fatal):`, e);
      continue;
    }
    for (const ev of board.events ?? []) {
      if (ev.id && !seen.has(ev.id)) { seen.add(ev.id); events.push(ev); }
    }
  }

  const updates: ScoreUpdate[] = [];
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const cs = comp.competitors ?? [];
    if (cs.length !== 2) continue;

    const pair = cs.map(espnTeamName).map(normalizeTeam).sort().join("|");
    const m = byPair.get(pair);
    if (!m) continue;

    // Assign to OUR home/away by team name, not ESPN's orientation.
    const homeComp = cs.find(c => normalizeTeam(espnTeamName(c)) === normalizeTeam(m.homeTeam));
    const awayComp = cs.find(c => normalizeTeam(espnTeamName(c)) === normalizeTeam(m.awayTeam));
    if (!homeComp || !awayComp) continue;

    const homeScore = Number(homeComp.score);
    const awayScore = Number(awayComp.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    // Winner flag settles knockout ties (penalties) that the score alone can't.
    const result: MatchResult =
      homeComp.winner ? "H" :
      awayComp.winner ? "A" :
      homeScore > awayScore ? "H" :
      awayScore > homeScore ? "A" : "T";

    // A level knockout game with no winner flag means we can't tell who advanced
    // (mid-update on ESPN's side) — skip and let the next sync / source settle it.
    if (result === "T" && m.round !== "GROUP") continue;

    updates.push({ matchId: m.matchId, homeScore, awayScore, result });
  }

  return updates;
}
