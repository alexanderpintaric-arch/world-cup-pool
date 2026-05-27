import type { Match } from "../types";

export interface Group {
  letter: string;
  teams: string[];
  matches: Match[];
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/**
 * Infer group letters from group-stage match pairings.
 * Teams that play each other are in the same group (connected components).
 * Groups are sorted by earliest kickoff and assigned A, B, C... in order.
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
