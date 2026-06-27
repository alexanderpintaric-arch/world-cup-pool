import type { Match, Pick, BracketPick, User, LeaderboardEntry, RoundState, Round } from "../types";
import { ROUND_CONFIG } from "../constants";
import { KNOCKOUT_ROUNDS, type KnockoutRound } from "./bracket";

/** Winner of a finished knockout match (no draws), else null. */
function knockoutWinner(m: Match): string | null {
  if (m.status !== "FINISHED" || !m.result) return null;
  if (m.result === "H") return m.homeTeam;
  if (m.result === "A") return m.awayTeam;
  return null;
}

/**
 * Among the FINAL-bucket matches, the actual Final is the one with the latest
 * kickoff. (football-data buckets the 3rd-place playoff into the FINAL round too,
 * but the bracket only cares about the champion.)
 */
function finalMatch(matches: Match[]): Match | null {
  const finals = matches
    .filter(m => m.round === "FINAL")
    .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime());
  return finals[0] ?? null;
}

/**
 * Teams that actually advanced out of each knockout round (winners of that
 * round's real matches; the champion for FINAL). Drives advancement-based
 * bracket scoring — opponents don't matter, only who advanced.
 */
export function computeActualAdvancers(matches: Match[]): Record<KnockoutRound, Set<string>> {
  const out = {
    ROUND_OF_32:    new Set<string>(),
    ROUND_OF_16:    new Set<string>(),
    QUARTER_FINALS: new Set<string>(),
    SEMI_FINALS:    new Set<string>(),
    FINAL:          new Set<string>(),
  } as Record<KnockoutRound, Set<string>>;

  for (const round of ["ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS"] as const) {
    for (const m of matches.filter(m => m.round === round)) {
      const w = knockoutWinner(m);
      if (w) out[round].add(w);
    }
  }

  const fm = finalMatch(matches);
  if (fm) {
    const champ = knockoutWinner(fm);
    if (champ) out.FINAL.add(champ);
  }

  return out;
}

/** Whether a knockout round has fully resolved (so its picks are scored/locked-in). */
export function knockoutRoundDecided(round: KnockoutRound, matches: Match[]): boolean {
  if (round === "FINAL") {
    const fm = finalMatch(matches);
    return !!fm && fm.status === "FINISHED" && !!fm.result;
  }
  const roundMatches = matches.filter(m => m.round === round);
  return roundMatches.length > 0 && roundMatches.every(m => m.status === "FINISHED");
}

export function computeLeaderboard(
  users: User[],
  allPicks: Pick[],
  allMatches: Match[],
  allBracketPicks: BracketPick[] = []
): LeaderboardEntry[] {
  const matchMap = new Map(allMatches.map(m => [m.matchId, m]));

  // ── Knockout advancement scoring inputs ─────────────────────────────────
  const advancers = computeActualAdvancers(allMatches);
  const roundDecided = {} as Record<KnockoutRound, boolean>;
  for (const r of KNOCKOUT_ROUNDS) roundDecided[r] = knockoutRoundDecided(r, allMatches);

  const bracketByEmail = new Map<string, BracketPick[]>();
  for (const bp of allBracketPicks) {
    if (!bracketByEmail.has(bp.email)) bracketByEmail.set(bp.email, []);
    bracketByEmail.get(bp.email)!.push(bp);
  }

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

      if (match.status === "FINISHED" && match.result) {
        // Only settled picks count toward the accuracy denominator — picks on
        // matches not yet played shouldn't drag the percentage down.
        total++;
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

    // ── Knockout bracket (advancement-based) ─────────────────────────────
    // One point-bearing pick per filled bracket node. A pick scores its round's
    // points if that team actually advanced from the round; undecided rounds
    // count toward max possible.
    const bracketPicks = bracketByEmail.get(user.email) ?? [];
    for (const bp of bracketPicks) {
      const round = bp.round as KnockoutRound;
      const pts = ROUND_CONFIG[round]?.pointsValue ?? 0;
      if (roundDecided[round]) {
        total++;
        if (advancers[round]?.has(bp.team)) {
          scoreByRound[round] = (scoreByRound[round] ?? 0) + pts;
          totalScore += pts;
          correct++;
        }
      } else {
        // Round not resolved yet — still winnable
        maxPossible += pts;
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

  // Second pass: availability = nearest preceding round with matches must be complete.
  // Exception: ROUND_OF_32 opens as soon as it has matches (don't wait for group stage to finish).
  return basics.map((b, i) => {
    let isAvailable = true;
    if (b.round !== "ROUND_OF_32") {
      for (let j = i - 1; j >= 0; j--) {
        if (basics[j].roundMatches.length > 0) {
          isAvailable = basics[j].allFinished;
          break;
        }
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
