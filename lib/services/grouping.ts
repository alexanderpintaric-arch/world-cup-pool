import type { Match } from "../types";

export interface Group {
  letter: string;
  teams: string[];
  matches: Match[];
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/**
 * Official 2026 FIFA World Cup group letters, keyed by the exact team names the
 * match feed (football-data.org) uses. Source of truth: the Final Draw held
 * 5 Dec 2025 in Washington, D.C.
 *
 * The match feed does NOT carry the official group label, so previously we
 * guessed the letter from kickoff order — which mislabels any group whose first
 * match isn't chronologically in letter order. That swapped C<->D and G<->H
 * (e.g. the USA's group kicks off before Brazil's, so it wrongly took "C").
 * This map assigns the real letter instead. Aliases cover known feed spelling
 * variants so a future re-sync doesn't silently regress.
 */
const WC2026_TEAM_GROUP: Record<string, string> = {
  "Mexico": "A", "South Africa": "A", "South Korea": "A", "Korea Republic": "A", "Czechia": "A", "Czech Republic": "A",
  "Canada": "B", "Bosnia-Herzegovina": "B", "Bosnia and Herzegovina": "B", "Qatar": "B", "Switzerland": "B",
  "Brazil": "C", "Morocco": "C", "Haiti": "C", "Scotland": "C",
  "United States": "D", "USA": "D", "Paraguay": "D", "Australia": "D", "Turkey": "D", "Türkiye": "D",
  "Germany": "E", "Curaçao": "E", "Ivory Coast": "E", "Côte d'Ivoire": "E", "Ecuador": "E",
  "Netherlands": "F", "Japan": "F", "Sweden": "F", "Tunisia": "F",
  "Belgium": "G", "Egypt": "G", "Iran": "G", "New Zealand": "G",
  "Spain": "H", "Cape Verde Islands": "H", "Cape Verde": "H", "Saudi Arabia": "H", "Uruguay": "H",
  "France": "I", "Senegal": "I", "Iraq": "I", "Norway": "I",
  "Argentina": "J", "Algeria": "J", "Austria": "J", "Jordan": "J",
  "Portugal": "K", "Congo DR": "K", "DR Congo": "K", "Uzbekistan": "K", "Colombia": "K",
  "England": "L", "Croatia": "L", "Ghana": "L", "Panama": "L",
};

/**
 * The official letter for a cluster, by majority vote of its teams' known
 * letters (robust to a single unrecognised name). Returns null if no team in
 * the cluster is in the map — i.e. mock data or a different tournament.
 */
function authoritativeLetter(teams: string[]): string | null {
  const votes = new Map<string, number>();
  for (const t of teams) {
    const g = WC2026_TEAM_GROUP[t];
    if (g) votes.set(g, (votes.get(g) ?? 0) + 1);
  }
  let best: string | null = null, bestN = 0;
  for (const [g, n] of votes) if (n > bestN) { best = g; bestN = n; }
  return best;
}

/**
 * Infer groups from group-stage match pairings: teams that play each other are
 * in the same group (connected components). Each group is given its official
 * letter from WC2026_TEAM_GROUP; if the teams aren't recognised (mock data /
 * other tournaments), groups fall back to kickoff order assigned A, B, C…
 */
export function inferGroups(allMatches: Match[]): Group[] {
  const groupMatches = allMatches.filter(m => m.round === "GROUP");
  if (groupMatches.length === 0) return [];

  const adj = new Map<string, Set<string>>();
  for (const m of groupMatches) {
    const h = m.homeTeam, a = m.awayTeam;
    if (!h || !a || h === "TBD" || a === "TBD") continue;
    if (!adj.has(h)) adj.set(h, new Set());
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(h)!.add(a);
    adj.get(a)!.add(h);
  }

  const seen = new Set<string>();
  const clusters: string[][] = [];
  for (const team of adj.keys()) {
    if (seen.has(team)) continue;
    const stack = [team];
    const cluster: string[] = [];
    while (stack.length) {
      const t = stack.pop()!;
      if (seen.has(t)) continue;
      seen.add(t);
      cluster.push(t);
      for (const n of adj.get(t) ?? []) if (!seen.has(n)) stack.push(n);
    }
    clusters.push(cluster);
  }

  const withMeta = clusters.map(teams => {
    const set = new Set(teams);
    const matches = groupMatches
      .filter(m => set.has(m.homeTeam) && set.has(m.awayTeam))
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
    const earliest = matches[0]?.kickoffUtc ?? new Date(0).toISOString();
    return { teams: teams.sort(), matches, earliest };
  });

  // Prefer the official group letters. Only trust them when every cluster
  // resolves to a distinct known letter; otherwise the data isn't WC2026 and we
  // fall back to the kickoff-order heuristic.
  const authLetters = withMeta.map(g => authoritativeLetter(g.teams));
  const allKnown  = authLetters.every((l): l is string => l !== null);
  const allUnique = new Set(authLetters).size === authLetters.length;

  if (allKnown && allUnique) {
    return withMeta
      .map((g, i) => ({ letter: authLetters[i]!, teams: g.teams, matches: g.matches }))
      .sort((a, b) => a.letter.localeCompare(b.letter));
  }

  // Fallback: order clusters by earliest kickoff and label A, B, C… positionally.
  withMeta.sort((a, b) => new Date(a.earliest).getTime() - new Date(b.earliest).getTime());

  return withMeta.map((g, i) => ({
    letter: LETTERS[i] ?? `${i + 1}`,
    teams: g.teams,
    matches: g.matches,
  }));
}

export function groupLetterForMatch(matchId: string, groups: Group[]): string | null {
  for (const g of groups) {
    if (g.matches.some(m => m.matchId === matchId)) return g.letter;
  }
  return null;
}
