import type { Match, Pick, BracketPick, LeaderboardEntry } from "../types";
import type { Round } from "../types";
import { earnedTitlesFor, type Title } from "./superlatives";

export interface PlayerStats {
  email: string;
  name: string;
  supportedTeam: string | null;
  leagueName: string;

  rank: number;
  leagueSize: number;
  totalScore: number;
  maxPossibleScore: number;
  pointsBehindLeader: number;
  pointsAheadOfNext: number | null;

  correctPicks: number;
  totalPicks: number;
  accuracy: number;            // 0–100, rounded

  currentStreak: number;
  longestStreak: number;
  upsets: number;

  groupPoints: number;
  bracketPoints: number;
  scoreByRound: Record<Round, number>;

  /** Their predicted champion + whether that team is still alive (null = undecided / not picked). */
  champion: { team: string; alive: boolean | null } | null;
  bracketFilled: number;       // 0–31 nodes filled

  /** Their most against-the-grain correct call. */
  biggestUpset: { matchLabel: string; team: string; poolPct: number } | null;

  titles: Title[];
  /** Pre-baked headline for the shareable card. */
  headline: string;
}

const TEAM_OF = (m: Match, p: Pick["pick"]) =>
  p === "H" ? m.homeTeam : p === "A" ? m.awayTeam : "Draw";

const KNOCKOUT: Round[] = ["ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

/** Teams knocked out (lost a finished knockout match). */
function eliminatedTeams(matches: Match[]): Set<string> {
  const out = new Set<string>();
  for (const m of matches) {
    if (m.status !== "FINISHED" || !m.result) continue;
    if (!KNOCKOUT.includes(m.round)) continue;
    if (m.result === "H") out.add(m.awayTeam);
    else if (m.result === "A") out.add(m.homeTeam);
  }
  return out;
}

export function computePlayerStats(opts: {
  email: string;
  leagueName: string;
  entries: LeaderboardEntry[];
  matches: Match[];
  myPicks: Pick[];
  allLeaguePicks: Pick[];
  myBracketPicks: BracketPick[];
}): PlayerStats | null {
  const { email, leagueName, entries, matches, myPicks, allLeaguePicks, myBracketPicks } = opts;
  const me = entries.find(e => e.email === email);
  if (!me) return null;

  const rank = entries.findIndex(e => e.email === email) + 1;
  const leagueSize = entries.length;
  const leader = entries[0];
  const next = rank > 1 ? entries[rank - 2] : null; // person directly above me

  const accuracy = me.totalPicks > 0 ? Math.round((me.correctPicks / me.totalPicks) * 100) : 0;

  // ── Longest streak ever (walk finished matches chronologically) ───────────
  const myPickMap = new Map(myPicks.map(p => [p.matchId, p.pick]));
  const finished = matches
    .filter(m => m.status === "FINISHED" && m.result)
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  let longest = 0, run = 0;
  for (const m of finished) {
    const pick = myPickMap.get(m.matchId);
    if (pick === undefined) continue;          // no pick — doesn't break the streak
    if (pick === m.result) { run++; longest = Math.max(longest, run); }
    else run = 0;
  }

  // ── Group vs bracket points ───────────────────────────────────────────────
  const groupPoints = me.scoreByRound.GROUP ?? 0;
  const bracketPoints = KNOCKOUT.reduce((s, r) => s + (me.scoreByRound[r] ?? 0), 0);

  // ── Champion pick + alive status ──────────────────────────────────────────
  const champPick = myBracketPicks.find(b => b.nodeId === "F-1")?.team ?? null;
  let champion: PlayerStats["champion"] = null;
  if (champPick) {
    const elim = eliminatedTeams(matches);
    champion = { team: champPick, alive: elim.has(champPick) ? false : (elim.size > 0 ? true : null) };
  }

  // ── Biggest upset: my correct call the fewest others backed ───────────────
  const pool = new Map<string, { H: number; A: number; T: number; total: number }>();
  for (const p of allLeaguePicks) {
    if (!p.pick) continue;
    if (!pool.has(p.matchId)) pool.set(p.matchId, { H: 0, A: 0, T: 0, total: 0 });
    const c = pool.get(p.matchId)!; c[p.pick as "H" | "A" | "T"]++; c.total++;
  }
  const matchById = new Map(matches.map(m => [m.matchId, m]));
  let biggestUpset: PlayerStats["biggestUpset"] = null;
  let lowestPct = 1;
  for (const p of myPicks) {
    if (!p.pick) continue;
    const m = matchById.get(p.matchId);
    if (!m || m.status !== "FINISHED" || p.pick !== m.result) continue;
    const split = pool.get(p.matchId);
    if (!split || split.total < 2) continue;
    const pct = split[p.pick as "H" | "A" | "T"] / split.total;
    if (pct < lowestPct) {
      lowestPct = pct;
      biggestUpset = {
        matchLabel: `${m.homeTeam} v ${m.awayTeam}`,
        team: TEAM_OF(m, p.pick),
        poolPct: Math.round(pct * 100),
      };
    }
  }

  const titles = earnedTitlesFor(email, entries, allLeaguePicks, matches);

  // Headline for the share card: best title, else standing.
  const anyScored = entries.some(e => e.totalScore > 0);
  const headline = titles[0]?.title
    ?? (anyScored && leagueSize > 1 ? `${ordinal(rank)} of ${leagueSize}` : "In the hunt");

  return {
    email, name: me.name, supportedTeam: me.supportedTeam ?? null, leagueName,
    rank, leagueSize,
    totalScore: me.totalScore,
    maxPossibleScore: me.maxPossibleScore,
    pointsBehindLeader: leader ? Math.max(0, leader.totalScore - me.totalScore) : 0,
    pointsAheadOfNext: next ? Math.max(0, me.totalScore - next.totalScore) : null,
    correctPicks: me.correctPicks,
    totalPicks: me.totalPicks,
    accuracy,
    currentStreak: me.streak,
    longestStreak: longest,
    upsets: me.upsets,
    groupPoints, bracketPoints,
    scoreByRound: me.scoreByRound,
    champion,
    bracketFilled: myBracketPicks.length,
    biggestUpset,
    titles,
    headline,
  };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
