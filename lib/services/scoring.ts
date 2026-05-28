import type { Match, Pick, User, LeaderboardEntry, RoundState, Round } from "../types";
import { ROUND_CONFIG } from "../constants";

export function computeLeaderboard(
  users: User[],
  allPicks: Pick[],
  allMatches: Match[]
): LeaderboardEntry[] {
  const matchMap = new Map(allMatches.map(m => [m.matchId, m]));

  // ── Pool pick counts (used for upset detection) ─────────────────────────
  // Count how many league members picked each outcome per match.
  type PickCount = { H: number; A: number; T: number; total: number };
  const poolCounts = new Map<string, PickCount>();
  for (const p of allPicks) {
    if (!p.pick) continue;
    if (!poolCounts.has(p.matchId)) poolCounts.set(p.matchId, { H: 0, A: 0, T: 0, total: 0 });
    const c = poolCounts.get(p.matchId)!;
    (c[p.pick as "H" | "A" | "T"])++;
    c.total++;
  }

  // ── Finished matches sorted chronologically (for streak calculation) ────
  const finishedSorted = allMatches
    .filter(m => m.status === "FINISHED" && m.result)
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

  // Group picks by email
  const picksByEmail = new Map<string, Pick[]>();
  for (const p of allPicks) {
    if (!picksByEmail.has(p.email)) picksByEmail.set(p.email, []);
    picksByEmail.get(p.email)!.push(p);
  }

  const entries: LeaderboardEntry[] = users.map(user => {
    const picks = picksByEmail.get(user.email) ?? [];
    const pickMap = new Map(picks.map(p => [p.matchId, p]));
    const scoreByRound = {} as Record<Round, number>;
    let totalScore = 0;
    let maxPossible = 0;
    let correct = 0;
    let total = 0;
    let upsets = 0;

    for (const round of Object.keys(ROUND_CONFIG) as Round[]) {
      scoreByRound[round] = 0;
    }

    for (const pick of picks) {
      const match = matchMap.get(pick.matchId);
      if (!match) continue;
      total++;

      if (match.status === "FINISHED" && match.result) {
        if (pick.pick === match.result) {
          const pts = match.pointsValue;
          scoreByRound[pick.round] = (scoreByRound[pick.round] ?? 0) + pts;
          totalScore += pts;
          correct++;

          // Upset: correct AND < 30% of the pool backed this outcome
          const pool = poolCounts.get(pick.matchId);
          if (pool && pool.total > 0) {
            const pct = pool[pick.pick as "H" | "A" | "T"] / pool.total;
            if (pct < 0.30) upsets++;
          }
        }
      } else if (match.status !== "FINISHED") {
        // Match not yet played — counts toward max possible
        maxPossible += match.pointsValue;
      }
    }

    maxPossible += totalScore;

    // ── Streak: walk backwards through finished matches ──────────────────
    // A wrong pick breaks the streak; a missing pick (late joiner) is skipped.
    let streak = 0;
    for (let i = finishedSorted.length - 1; i >= 0; i--) {
      const match = finishedSorted[i];
      const pick = pickMap.get(match.matchId);
      if (!pick) continue;               // no pick for this match — skip
      if (pick.pick === match.result) streak++;
      else break;                        // wrong pick — streak ends
    }

    return {
      email: user.email,
      name: user.name,
      totalScore,
      maxPossibleScore: maxPossible,
      scoreByRound,
      correctPicks: correct,
      totalPicks: total,
      supportedTeam: user.supportedTeam ?? null,
      streak,
      upsets,
    };
  });

  // Sort: total score desc, then max possible desc (tiebreaker logic TBD)
  return entries.sort((a, b) =>
    b.totalScore !== a.totalScore
      ? b.totalScore - a.totalScore
      : b.maxPossibleScore - a.maxPossibleScore
  );
}

export function getRoundStates(matches: Match[]): RoundState[] {
  const rounds = (Object.keys(ROUND_CONFIG) as Round[]).sort(
    (a, b) => ROUND_CONFIG[a].order - ROUND_CONFIG[b].order
  );

  const now = Date.now();

  // First pass: gather basic facts per round
  const basics = rounds.map(round => {
    const roundMatches = matches.filter(m => m.round === round);
    const allFinished = roundMatches.length > 0 && roundMatches.every(m => m.status === "FINISHED");
    // Sort kickoffs lexicographically (ISO strings are chronologically sortable)
    const sortedKickoffs = roundMatches.map(m => m.kickoffUtc).sort();
    const firstKickoff = sortedKickoffs[0] ?? null;
    const lastKickoff  = sortedKickoffs[sortedKickoffs.length - 1] ?? null;
    // The round is locked for picks once the first match kicks off
    const deadlinePassed = firstKickoff ? now >= new Date(firstKickoff).getTime() : false;
    return { round, roundMatches, allFinished, firstKickoff, lastKickoff, deadlinePassed };
  });

  // Second pass: availability = nearest preceding round with matches must be complete
  return basics.map((b, i) => {
    let isAvailable = true;
    for (let j = i - 1; j >= 0; j--) {
      if (basics[j].roundMatches.length > 0) {
        isAvailable = basics[j].allFinished;
        break;
      }
    }

    // Open = available AND the round deadline (first kickoff) hasn't passed
    const isOpen = isAvailable && !b.deadlinePassed && b.roundMatches.length > 0;

    return {
      round: b.round,
      label: ROUND_CONFIG[b.round].label,
      pointsValue: ROUND_CONFIG[b.round].pointsValue,
      isOpen,
      isAvailable,
      isComplete: b.allFinished,
      deadline: b.firstKickoff,    // picks lock at first kickoff of round
      lastKickoff: b.lastKickoff,  // last match in round
      matchCount: b.roundMatches.length,
    };
  });
}

export function getActiveRound(roundStates: RoundState[]): RoundState | null {
  const ordered = [...roundStates].sort(
    (a, b) => ROUND_CONFIG[a.round].order - ROUND_CONFIG[b.round].order
  );
  for (const rs of ordered) {
    if (rs.matchCount > 0 && rs.isAvailable && rs.isOpen) return rs;
  }
  return null;
}
