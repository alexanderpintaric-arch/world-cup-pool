import type { OddsData, Match, MatchResult } from "../types";

const BASE = "https://api.the-odds-api.com/v4";

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiBookmaker {
  markets: { key: string; outcomes: OddsApiOutcome[] }[];
}

interface OddsApiGame {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

function decimalToProb(decimal: number): number {
  return Math.round((1 / decimal) * 100 * 10) / 10;
}

// Remove bookmaker margin so probabilities sum to 100%
function normalizeProbs(h: number, d: number | null, a: number): [number, number | null, number] {
  const total = h + (d ?? 0) + a;
  if (total === 0) return [h, d, a];
  const norm = (v: number) => Math.round((v / total) * 100 * 10) / 10;
  return [norm(h), d !== null ? norm(d) : null, norm(a)];
}

// ── Team name normalisation ────────────────────────────────────────────────
// The Odds API and football-data.org use different team names for the same
// country. We strip punctuation and apply a canonical alias table so both
// sides can be compared on equal footing.

const CANONICAL: Record<string, string> = {
  // United States
  "united states":                  "usa",
  "united states of america":       "usa",
  // Korea
  "south korea":                    "korea republic",
  "korea":                          "korea republic",
  // Iran
  "iran":                           "ir iran",
  // Czech Republic
  "czech republic":                 "czechia",
  // Ivory Coast
  "ivory coast":                    "cote divoire",
  "côte d ivoire":                  "cote divoire",
  "cote d ivoire":                  "cote divoire",
  "cote divoire":                   "cote divoire",
  // Bosnia — football-data uses "Bosnia-Herzegovina" (→ "bosnia herzegovina"),
  // The Odds API uses "Bosnia and Herzegovina"
  "bosnia and herzegovina":         "bosnia herzegovina",
  "bosnia & herzegovina":           "bosnia herzegovina",
  // DR Congo
  "dr congo":                       "congo dr",
  "democratic republic of congo":   "congo dr",
  "democratic republic of the congo": "congo dr",
  // North Macedonia (some sources drop "North")
  "macedonia":                      "north macedonia",
  // Cape Verde / Cabo Verde — football-data uses "Cape Verde Islands"
  "cape verde":                     "cabo verde",
  "cape verde islands":             "cabo verde",
  // Palestine
  "state of palestine":             "palestine",
  "palestinian territories":        "palestine",
  // Other common mismatches
  "republic of ireland":            "ireland",
  "trinidad & tobago":              "trinidad and tobago",
  "guinea bissau":                  "guinea-bissau",
  "guinea-bissau":                  "guinea-bissau",
  // New Zealand alias
  "new zealand":                    "new zealand",
  // Chinese Taipei / Taiwan
  "chinese taipei":                 "taiwan",
  "taiwan":                         "taiwan",
  // Venezuela
  "venezuela":                      "venezuela",
  // El Salvador
  "el salvador":                    "el salvador",
  // Saudi Arabia
  "saudi arabia":                   "saudi arabia",
  "ksa":                            "saudi arabia",
  // UAE
  "united arab emirates":           "uae",
  "uae":                            "uae",
  // DPR Korea / North Korea
  "dpr korea":                      "north korea",
  "korea dpr":                      "north korea",
  // Curacao
  "curaçao":                        "curacao",
  "curacao":                        "curacao",
};

function normalizeTeam(name: string): string {
  const lower = name
    .toLowerCase()
    .replace(/['’.]/g, "")   // strip apostrophes / periods
    .replace(/[-]/g, " ")         // hyphens → spaces
    .replace(/\s+/g, " ")
    .trim();
  return CANONICAL[lower] ?? lower;
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetch odds for all upcoming WC matches, keyed by *our* match IDs.
 * Matching is done by normalised team names rather than by the Odds API's
 * own opaque IDs (which have no relation to football-data.org IDs).
 *
 * knownMatches: the full list of matches from our DB — used to build the
 *   home+away lookup table.
 */
export async function fetchWCOdds(knownMatches: Match[]): Promise<OddsData[]> {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    console.warn("ODDS_API_KEY not set — skipping odds fetch");
    return [];
  }

  // Build lookup: "normHome|normAway" → matchId
  const matchLookup = new Map<string, string>();
  for (const m of knownMatches) {
    if (m.homeTeam === "TBD" || m.awayTeam === "TBD") continue;
    const key = `${normalizeTeam(m.homeTeam)}|${normalizeTeam(m.awayTeam)}`;
    matchLookup.set(key, m.matchId);
  }

  const params = new URLSearchParams({
    apiKey: key,
    bookmakers: "fanduel",
    markets: "h2h",
    oddsFormat: "decimal",
  });

  const res = await fetch(`${BASE}/sports/soccer_fifa_world_cup/odds?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error(`Odds API error ${res.status}`);
    return [];
  }

  const games: OddsApiGame[] = await res.json();
  const now = new Date().toISOString();
  const results: OddsData[] = [];

  for (const g of games) {
    const normHome  = normalizeTeam(g.home_team);
    const normAway  = normalizeTeam(g.away_team);
    const lookupKey = `${normHome}|${normAway}`;
    const matchId   = matchLookup.get(lookupKey);
    if (!matchId) {
      // Try reversed (some APIs swap home/away in pre-match period)
      const reversed = `${normAway}|${normHome}`;
      if (!matchLookup.get(reversed)) {
        console.warn(`[odds] Unmatched: "${g.home_team}" vs "${g.away_team}" (normalised: "${normHome}" | "${normAway}")`);
        continue;
      }
    }
    const resolvedId = matchId ?? matchLookup.get(`${normalizeTeam(g.away_team)}|${normalizeTeam(g.home_team)}`)!;

    // Average decimal odds across bookmakers
    let homeSum = 0, drawSum = 0, awaySum = 0, count = 0;
    for (const bm of g.bookmakers) {
      const h2h = bm.markets.find(m => m.key === "h2h");
      if (!h2h) continue;
      const home = h2h.outcomes.find(o => o.name === g.home_team)?.price ?? 0;
      const away = h2h.outcomes.find(o => o.name === g.away_team)?.price ?? 0;
      const draw = h2h.outcomes.find(o => o.name === "Draw")?.price ?? 0;
      if (home && away) { homeSum += home; drawSum += draw; awaySum += away; count++; }
    }

    if (count === 0) continue;

    const homeOdds = Math.round((homeSum / count) * 100) / 100;
    const drawOdds = drawSum > 0 ? Math.round((drawSum / count) * 100) / 100 : null;
    const awayOdds = Math.round((awaySum / count) * 100) / 100;

    const rawHome = decimalToProb(homeOdds);
    const rawDraw = drawOdds ? decimalToProb(drawOdds) : null;
    const rawAway = decimalToProb(awayOdds);
    const [homeProb, drawProb, awayProb] = normalizeProbs(rawHome, rawDraw, rawAway);

    results.push({
      matchId: resolvedId,
      homeOdds, drawOdds, awayOdds,
      homeProb, drawProb, awayProb,
      updatedAt: now,
    });
  }

  return results;
}

// ── Scores fallback ──────────────────────────────────────────────────────────
// football-data.org regularly leaves a finished match unsettled for hours, which
// strands a decided game (and everyone's points for it) as blank. The Odds API
// has a /scores endpoint that reports completed-game scores, so we use it as a
// second, independent settlement source: when the primary feed hasn't settled a
// game yet, the sync fills the result from here instead of waiting.

interface OddsApiScoreEntry {
  name: string;
  score: string | null;
}

interface OddsApiScoreGame {
  id: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: OddsApiScoreEntry[] | null;
}

export interface ScoreUpdate {
  matchId: string;
  homeScore: number;
  awayScore: number;
  result: MatchResult;
}

/**
 * Fetch final scores for recently completed WC matches, keyed by *our* match IDs.
 * Scores are mapped back to each match's own home/away orientation by team name,
 * so it doesn't matter which side the Odds API calls "home".
 *
 * Knockout draws are skipped: the /scores endpoint reports the regulation/extra-
 * time score, which can be level when the tie was actually decided on penalties,
 * and the endpoint doesn't expose the shoot-out winner. We let the primary feed
 * settle those; only decisive (H/A) knockout results are filled from here.
 *
 * knownMatches: the full list of matches from our DB — used to map teams → ids.
 */
export async function fetchWCScores(knownMatches: Match[]): Promise<ScoreUpdate[]> {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    console.warn("ODDS_API_KEY not set — skipping score fallback");
    return [];
  }

  // Lookup by unordered, normalised team pair → our match (orientation-agnostic).
  const byPair = new Map<string, Match>();
  for (const m of knownMatches) {
    if (m.homeTeam === "TBD" || m.awayTeam === "TBD") continue;
    const pair = [normalizeTeam(m.homeTeam), normalizeTeam(m.awayTeam)].sort().join("|");
    byPair.set(pair, m);
  }

  // daysFrom (1-3) includes completed games from up to N days ago.
  const params = new URLSearchParams({ apiKey: key, daysFrom: "3" });
  const res = await fetch(`${BASE}/sports/soccer_fifa_world_cup/scores?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error(`Odds API scores error ${res.status}`);
    return [];
  }

  const games: OddsApiScoreGame[] = await res.json();
  const updates: ScoreUpdate[] = [];

  for (const g of games) {
    if (!g.completed || !g.scores) continue;
    const pair = [normalizeTeam(g.home_team), normalizeTeam(g.away_team)].sort().join("|");
    const m = byPair.get(pair);
    if (!m) {
      console.warn(`[scores] Unmatched: "${g.home_team}" vs "${g.away_team}"`);
      continue;
    }

    // Assign scores to OUR home/away by name, not the API's orientation.
    const scoreFor = (team: string): number => {
      const norm = normalizeTeam(team);
      const entry = g.scores!.find(s => normalizeTeam(s.name) === norm);
      const n = entry?.score != null ? Number(entry.score) : NaN;
      return n;
    };
    const homeScore = scoreFor(m.homeTeam);
    const awayScore = scoreFor(m.awayTeam);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    const result: MatchResult =
      homeScore > awayScore ? "H" : awayScore > homeScore ? "A" : "T";

    // A level score in a knockout tie means penalties decided it — and /scores
    // can't tell us who won the shoot-out. Leave those to the primary feed.
    if (result === "T" && m.round !== "GROUP") continue;

    updates.push({ matchId: m.matchId, homeScore, awayScore, result });
  }

  return updates;
}

// ── Matchup fallback ─────────────────────────────────────────────────────────
// football-data.org is slow to fill the knockout draw — it leaves fixtures as TBD
// for hours after the group stage has decided the matchup, which leaves bracket
// slots empty while everyone is trying to make picks. The Odds API's /events
// endpoint lists every upcoming fixture with both team names and is FREE (it
// doesn't count against the usage quota), so we use it to fill the missing side
// of any knockout match the primary feed still has as TBD.

interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

export interface MatchupFill {
  matchId: string;
  /** Football-data spelling to drop into a TBD home side (omitted if not filled). */
  home?: string;
  away?: string;
}

const MATCHUP_TOLERANCE_MS = 12 * 60 * 60 * 1000; // generous: just a sanity bound on the fixture date

/**
 * Resolve the still-TBD side of knockout matchups from The Odds API /events.
 * Fill-only: only ever returns a team for a side our data still has as "TBD",
 * so a real team the primary feed already published is never overwritten.
 *
 * Filled names are converted to football-data's spelling (looked up from teams
 * we already know — every knockout team played the group stage) so they match
 * what the primary feed will eventually publish. That keeps flags rendering and,
 * crucially, stops a later spelling flip from invalidating people's bracket picks
 * (scoring matches picks by exact team name).
 */
export async function fetchWCMatchups(knownMatches: Match[]): Promise<MatchupFill[]> {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    console.warn("ODDS_API_KEY not set — skipping matchup fallback");
    return [];
  }

  // Only knockout matches still missing a side need filling.
  const needs = knownMatches.filter(
    m => m.round !== "GROUP" && (m.homeTeam === "TBD" || m.awayTeam === "TBD")
  );
  if (needs.length === 0) return [];

  // normalised name → football-data's exact spelling, from teams we already know.
  const fdSpelling = new Map<string, string>();
  for (const m of knownMatches) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (t && t !== "TBD") fdSpelling.set(normalizeTeam(t), t);
    }
  }
  const toFd = (name: string) => fdSpelling.get(normalizeTeam(name)) ?? name;

  const res = await fetch(`${BASE}/sports/soccer_fifa_world_cup/events?apiKey=${key}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    console.error(`Odds API events error ${res.status}`);
    return [];
  }
  const events: OddsApiEvent[] = await res.json();

  const fills: MatchupFill[] = [];
  for (const m of needs) {
    const t = new Date(m.kickoffUtc).getTime();
    const knownSide =
      m.homeTeam !== "TBD" ? m.homeTeam :
      m.awayTeam !== "TBD" ? m.awayTeam : null;
    const knownNorm = knownSide ? normalizeTeam(knownSide) : null;

    // With a known side, anchor on it (a team has exactly one upcoming fixture),
    // with the kickoff date as a loose sanity bound. Both-TBD slots can only be
    // matched by kickoff time — R32 fixtures are ≥3.5h apart, so it's unambiguous.
    const ev = events.find(e => {
      const within = Math.abs(new Date(e.commence_time).getTime() - t) <= MATCHUP_TOLERANCE_MS;
      if (knownNorm) {
        return within && (normalizeTeam(e.home_team) === knownNorm || normalizeTeam(e.away_team) === knownNorm);
      }
      return within;
    });
    if (!ev) continue;

    const fill: MatchupFill = { matchId: m.matchId };
    if (knownNorm) {
      // Fill the TBD side with the event's *other* team.
      const other = normalizeTeam(ev.home_team) === knownNorm ? ev.away_team : ev.home_team;
      const otherFd = toFd(other);
      if (otherFd && normalizeTeam(otherFd) !== knownNorm) {
        if (m.homeTeam === "TBD") fill.home = otherFd;
        if (m.awayTeam === "TBD") fill.away = otherFd;
      }
    } else {
      // Both sides unknown — orientation doesn't affect advancement scoring.
      fill.home = toFd(ev.home_team);
      fill.away = toFd(ev.away_team);
    }
    if (fill.home || fill.away) fills.push(fill);
  }
  return fills;
}
