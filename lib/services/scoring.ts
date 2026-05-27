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
  const rounds = (Object.keys(ROUND_CONFIG) as Round[]).sort(
    (a, b) => ROUND_CONFIG[a].order - ROUND_CONFIG[b].order
  );

  // First pass: gather basic facts per round
  const basics = rounds.map(round => {
    const roundMatches = matches.filter(m => m.round === round);
    const allFinished = roundMatches.length > 0 && roundMatches.every(m => m.status === "FINISHED");
    const anyScheduled = roundMatches.some(m => m.status === "SCHEDULED");
    // deadline = next upcoming kickoff (so the countdown stays relevant mid-round)
    const nextKickoff = roundMatches
      .filter(m => m.status === "SCHEDULED")
      .map(m => new Date(m.kickoffUtc))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return { round, roundMatches, allFinished, anyScheduled, deadline: nextKickoff?.toISOString() ?? null };
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

    // Open = available AND at least one match hasn't started yet
    const isOpen = isAvailable && b.anyScheduled;

    return {
      round: b.round,
      label: ROUND_CONFIG[b.round].label,
      pointsValue: ROUND_CONFIG[b.round].pointsValue,
      isOpen,
      isAvailable,
      isComplete: b.allFinished,
      deadline: b.deadline,
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
