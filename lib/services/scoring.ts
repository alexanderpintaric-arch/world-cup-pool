import type { Match, Pick, User, LeaderboardEntry, RoundState, Round } from "../types";
import { ROUND_CONFIG } from "../constants";

export function computeLeaderboard(
  users: User[],
  allPicks: Pick[],
  allMatches: Match[]
): LeaderboardEntry[] {
  const matchMap = new Map(allMatches.map(m => [m.matchId, m]));

  // Group picks by email
  const picksByEmail = new Map<string, Pick[]>();
  for (const p of allPicks) {
    if (!picksByEmail.has(p.email)) picksByEmail.set(p.email, []);
    picksByEmail.get(p.email)!.push(p);
  }

  const entries: LeaderboardEntry[] = users.map(user => {
    const picks = picksByEmail.get(user.email) ?? [];
    const scoreByRound = {} as Record<Round, number>;
    let totalScore = 0;
    let maxPossible = 0;
    let correct = 0;
    let total = 0;

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
        }
      } else if (match.status !== "FINISHED") {
        // Match not yet played — counts toward max possible
        maxPossible += match.pointsValue;
      }
    }

    maxPossible += totalScore;

    return {
      email: user.email,
      name: user.name,
      totalScore,
      maxPossibleScore: maxPossible,
      scoreByRound,
      correctPicks: correct,
      totalPicks: total,
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
  const rounds = Object.keys(ROUND_CONFIG) as Round[];

  return rounds.map(round => {
    const roundMatches = matches.filter(m => m.round === round);
    if (roundMatches.length === 0) {
      return {
        round,
        label: ROUND_CONFIG[round].label,
        pointsValue: ROUND_CONFIG[round].pointsValue,
        isOpen: false,
        isComplete: false,
        deadline: null,
        matchCount: 0,
      };
    }

    const allFinished = roundMatches.every(m => m.status === "FINISHED");
    const anyScheduled = roundMatches.some(m => m.status === "SCHEDULED");
    const now = new Date();

    // Deadline = time of first kickoff in this round
    const kickoffs = roundMatches
      .map(m => new Date(m.kickoffUtc))
      .sort((a, b) => a.getTime() - b.getTime());
    const deadline = kickoffs[0]?.toISOString() ?? null;
    const deadlinePassed = deadline ? now >= new Date(deadline) : false;

    // A round is open if: deadline hasn't passed AND previous round is complete
    // (We compute open state properly in the API layer with prevRoundComplete)
    const isOpen = !deadlinePassed && anyScheduled;

    return {
      round,
      label: ROUND_CONFIG[round].label,
      pointsValue: ROUND_CONFIG[round].pointsValue,
      isOpen,
      isComplete: allFinished,
      deadline,
      matchCount: roundMatches.length,
    };
  });
}

// Returns the current active round (open for picks)
export function getActiveRound(roundStates: RoundState[]): RoundState | null {
  // A knockout round only opens after the previous round is complete
  const ordered = [...roundStates].sort(
    (a, b) => ROUND_CONFIG[a.round].order - ROUND_CONFIG[b.round].order
  );

  for (let i = 0; i < ordered.length; i++) {
    const rs = ordered[i];
    if (rs.matchCount === 0) continue;

    const prevComplete = i === 0 || ordered[i - 1].isComplete || ordered[i - 1].matchCount === 0;
    if (prevComplete && rs.isOpen) return rs;
  }

  return null;
}
